var
  rp = require('request-promise');

function getBaseUrl() {
  return 'http://localhost:8000/';
}

function proxyGet(requestPath) {
  return rp.get(getBaseUrl() + requestPath);
}

module.exports = {
  proxyGet
};
