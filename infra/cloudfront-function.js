// CloudFront viewer-request function: map "directory" URLs to index.html and
// send the bare apex to the marketing site.
//
//   /            -> /index.html        (apex lands on the marketing site)
//   /v01  /v01/  -> /v01/index.html   (directory index)
//   /v01/assets/x.js                  (has an extension -> passes through)
//   /reference/  -> /reference/index.html  (trailing-slash rule handles this)
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '' || uri === '/') {
    request.uri = '/index.html';
    return request;
  }
  if (uri.charAt(uri.length - 1) === '/') {
    request.uri = uri + 'index.html';
    return request;
  }
  var last = uri.substring(uri.lastIndexOf('/') + 1);
  if (last.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
    return request;
  }
  return request;
}
