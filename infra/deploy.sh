#!/usr/bin/env bash
#
# SpecPad AWS deployment (S3 + CloudFront + ACM + Route 53), per docs/design §5.4.
#
# Architecture:
#   - Private S3 bucket holds versioned static builds under /v01/… (no public access).
#   - CloudFront serves the bucket via Origin Access Control (OAC) over HTTPS.
#   - ACM cert (us-east-1) for specpad.com, DNS-validated in Route 53.
#   - Route 53 hosted zone is authoritative for specpad.com; the registered domain's
#     nameservers are repointed from Google to this zone.
#   - A viewer-request CloudFront Function rewrites "/" and "/v01/" to index.html.
#
# Idempotent: every resource is checked before creation, so re-running after a
# timeout (NS propagation, cert validation, CloudFront deploy) just resumes.
#
# Usage:  infra/deploy.sh            # full run, waits on slow steps
#         infra/deploy.sh --no-wait  # create everything but skip the long waiters
#
set -euo pipefail

DOMAIN="specpad.com"
REGION="us-east-1"
PREFIX="v01"
BUCKET="specpad-web-904915073567"
FUNCTION_NAME="specpad-rewrite"
OAC_NAME="specpad-oac"
CF_CACHE_OPTIMIZED="658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS managed "CachingOptimized"
CF_ZONE_ID="Z2FDTNDATAQYW2"                                # fixed CloudFront hosted-zone id
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WAIT=1
[ "${1:-}" = "--no-wait" ] && WAIT=0

log() { printf '\n=== %s ===\n' "$*"; }

# ---------------------------------------------------------------------------
log "1. Route 53 hosted zone for $DOMAIN"
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN." \
  --query "HostedZones[?Name=='$DOMAIN.'].Id | [0]" --output text)
if [ "$ZONE_ID" = "None" ] || [ -z "$ZONE_ID" ]; then
  ZONE_ID=$(aws route53 create-hosted-zone --name "$DOMAIN" \
    --caller-reference "specpad-$(date +%s)" \
    --hosted-zone-config Comment="SpecPad — managed by infra/deploy.sh" \
    --query 'HostedZone.Id' --output text)
  echo "created hosted zone $ZONE_ID"
else
  echo "hosted zone exists: $ZONE_ID"
fi
ZONE_ID="${ZONE_ID#/hostedzone/}"

# ---------------------------------------------------------------------------
log "2. Repoint registered domain nameservers -> Route 53"
mapfile -t ZONE_NS < <(aws route53 get-hosted-zone --id "$ZONE_ID" \
  --query 'DelegationSet.NameServers' --output text | tr '\t' '\n')
CUR_NS=$(aws route53domains get-domain-detail --region us-east-1 --domain-name "$DOMAIN" \
  --query 'Nameservers[].Name' --output text || echo "")
if echo "$CUR_NS" | grep -q "${ZONE_NS[0]}"; then
  echo "nameservers already point to Route 53"
else
  NS_ARGS=(); for ns in "${ZONE_NS[@]}"; do NS_ARGS+=("Name=$ns"); done
  aws route53domains update-domain-nameservers --region us-east-1 \
    --domain-name "$DOMAIN" --nameservers "${NS_ARGS[@]}"
  echo "repointed nameservers to: ${ZONE_NS[*]}"
  echo "(propagation can take minutes to a few hours)"
fi

# ---------------------------------------------------------------------------
log "3. ACM certificate for $DOMAIN (DNS-validated)"
CERT_ARN=$(aws acm list-certificates --region "$REGION" \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn | [0]" --output text)
if [ "$CERT_ARN" = "None" ] || [ -z "$CERT_ARN" ]; then
  CERT_ARN=$(aws acm request-certificate --region "$REGION" --domain-name "$DOMAIN" \
    --validation-method DNS --query 'CertificateArn' --output text)
  echo "requested cert $CERT_ARN"
  sleep 5
else
  echo "cert exists: $CERT_ARN"
fi
# Upsert the DNS validation record into the zone.
RR=$(aws acm describe-certificate --region "$REGION" --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output json)
VAL_NAME=$(echo "$RR" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Name"])')
VAL_VALUE=$(echo "$RR" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Value"])')
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "{
  \"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{
    \"Name\":\"$VAL_NAME\",\"Type\":\"CNAME\",\"TTL\":300,
    \"ResourceRecords\":[{\"Value\":\"$VAL_VALUE\"}]}}]}" >/dev/null
echo "validation record upserted: $VAL_NAME"

# ---------------------------------------------------------------------------
log "4. Private S3 bucket $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "bucket exists"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  echo "created bucket"
fi
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ---------------------------------------------------------------------------
log "5. Build and upload to s3://$BUCKET/$PREFIX/"
( cd "$ROOT_DIR" && npm run build )
aws s3 sync "$ROOT_DIR/dist/" "s3://$BUCKET/$PREFIX/" --delete
echo "uploaded build"

# ---------------------------------------------------------------------------
log "6. CloudFront Function (URL rewrite)"
FUNC_ARN=$(aws cloudfront list-functions \
  --query "FunctionList.Items[?Name=='$FUNCTION_NAME'].FunctionMetadata.FunctionARN | [0]" \
  --output text 2>/dev/null || echo "None")
if [ "$FUNC_ARN" = "None" ] || [ -z "$FUNC_ARN" ]; then
  aws cloudfront create-function --name "$FUNCTION_NAME" \
    --function-config Comment="SpecPad URL rewrite",Runtime="cloudfront-js-2.0" \
    --function-code "fileb://$SCRIPT_DIR/cloudfront-function.js" >/dev/null
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG" >/dev/null
  echo "created + published function"
else
  echo "function exists"
fi
FUNC_ARN=$(aws cloudfront describe-function --name "$FUNCTION_NAME" \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)

# ---------------------------------------------------------------------------
log "7. Origin Access Control"
OAC_ID=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='$OAC_NAME'].Id | [0]" --output text 2>/dev/null || echo "None")
if [ "$OAC_ID" = "None" ] || [ -z "$OAC_ID" ]; then
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
    "Name=$OAC_NAME,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query 'OriginAccessControl.Id' --output text)
  echo "created OAC $OAC_ID"
else
  echo "OAC exists: $OAC_ID"
fi

# ---------------------------------------------------------------------------
log "8. CloudFront distribution"
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Aliases.Items, '$DOMAIN')].Id | [0]" --output text 2>/dev/null || echo "None")
if [ "$DIST_ID" = "None" ] || [ -z "$DIST_ID" ]; then
  echo "ensuring certificate is ISSUED before creating the distribution…"
  echo "(blocks on Route 53 nameserver propagation; safe to re-run if it times out)"
  aws acm wait certificate-validated --region "$REGION" --certificate-arn "$CERT_ARN"
  echo "certificate ISSUED"
  ORIGIN_DOMAIN="$BUCKET.s3.$REGION.amazonaws.com"
  CFG=$(cat <<JSON
{
  "CallerReference": "specpad-$(date +%s)",
  "Aliases": { "Quantity": 1, "Items": ["$DOMAIN"] },
  "DefaultRootObject": "",
  "Origins": { "Quantity": 1, "Items": [{
    "Id": "s3-$BUCKET",
    "DomainName": "$ORIGIN_DOMAIN",
    "OriginAccessControlId": "$OAC_ID",
    "S3OriginConfig": { "OriginAccessIdentity": "" }
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-$BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "$CF_CACHE_OPTIMIZED",
    "Compress": true,
    "FunctionAssociations": { "Quantity": 1, "Items": [{
      "EventType": "viewer-request", "FunctionARN": "$FUNC_ARN" }]},
    "AllowedMethods": { "Quantity": 2, "Items": ["GET","HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] } }
  },
  "Comment": "SpecPad editor",
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "HttpVersion": "http2and3",
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
JSON
)
  DIST_ID=$(aws cloudfront create-distribution --distribution-config "$CFG" \
    --query 'Distribution.Id' --output text)
  echo "created distribution $DIST_ID"
else
  echo "distribution exists: $DIST_ID"
fi
DIST_ARN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.ARN' --output text)
DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)

# ---------------------------------------------------------------------------
log "9. Bucket policy: allow only this distribution via OAC"
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{
    \"Sid\":\"AllowCloudFrontOAC\",
    \"Effect\":\"Allow\",
    \"Principal\":{\"Service\":\"cloudfront.amazonaws.com\"},
    \"Action\":\"s3:GetObject\",
    \"Resource\":\"arn:aws:s3:::$BUCKET/*\",
    \"Condition\":{\"StringEquals\":{\"AWS:SourceArn\":\"$DIST_ARN\"}}
  }]
}"
echo "bucket policy set"

# ---------------------------------------------------------------------------
log "10. Route 53 ALIAS records -> CloudFront"
for TYPE in A AAAA; do
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "{
    \"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{
      \"Name\":\"$DOMAIN.\",\"Type\":\"$TYPE\",
      \"AliasTarget\":{\"HostedZoneId\":\"$CF_ZONE_ID\",\"DNSName\":\"$DIST_DOMAIN\",\"EvaluateTargetHealth\":false}}}]}" >/dev/null
  echo "$TYPE ALIAS -> $DIST_DOMAIN"
done

# ---------------------------------------------------------------------------
log "11. Invalidate CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null
echo "invalidation requested"

if [ "$WAIT" = "1" ]; then
  log "Waiting for distribution to deploy (a few minutes)…"
  aws cloudfront wait distribution-deployed --id "$DIST_ID"
fi

log "DONE"
echo "Distribution: $DIST_ID ($DIST_DOMAIN)"
echo "Site:         https://$DOMAIN/$PREFIX/"
echo "Apex:         https://$DOMAIN/  (rewrites to /$PREFIX/index.html)"
