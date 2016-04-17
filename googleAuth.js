'use strict';

const
  jwt = require('jsonwebtoken'),
  rp = require('request-promise'),
  _ = require('lodash'),
  certFetchOptions = {
    method: 'GET',
    uri: 'https://www.googleapis.com/oauth2/v1/certs',
    resolveWithFullResponse: true
  };


let
  certificateExpiry = null,
  certificateCache = {};


function asyncValidate(token, callback) {
  getCerts().then(certObj => {

    let
      error = null,
      certs = _.values(certObj);

    for (let i = 0; i < certs.length; i++) {
      try {
        let payload = jwt.verify(
          token,
          certs[i],
          { algorithms: ['RS256'] }
        );

        // found a valid cert
        callback(null, payload);
        return;

      } catch (err) {
        error = err;
      }

    }

    // no valid certs found
    callback(error, null);
  });
}


function getCerts() {
  if (certificateExpiry && Date.now() < certificateExpiry.getTime()) {
    return certificateCache;
  }

  return rp(certFetchOptions).then(res => {
    const
      cacheControl = res.headers['cache-control'],
      cacheAge = !cacheControl ? -1 : extractAge(cacheControl),
      body = JSON.parse(res.body);

    // set cache expiry, and save certs for future requests
    certificateExpiry = cacheAge === -1 ? null : new Date(Date.now() + cacheAge);
    certificateCache = body;

    return body;
  });
}


function extractAge(cacheControl) {
  const
    pattern = new RegExp('max-age=([0-9]*)'),
    matches = pattern.exec(cacheControl);

  return matches.length === 2 ? matches[1] * 1000 : -1;
}


module.exports = {
  asyncValidate
};
