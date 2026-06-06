// CloudFront viewer-request function: map "directory" URLs to index.html and
// send the bare apex to the version-pinned editor build.
//
//   /            -> /v01/index.html   (apex lands on the current editor)
//   /v01  /v01/  -> /v01/index.html   (directory index)
//   /v01/assets/x.js                  (has an extension -> passes through)
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '' || uri === '/') {
    request.uri = '/v01/index.html';
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
