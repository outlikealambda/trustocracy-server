'use strict';

const
  crypto = require('crypto'),
  log = require('./logger');

function decodeAndValidate(secret, signedRequest) {

  const
    [ encodedSig, payload ] = signedRequest.split('.'),
    sig = Buffer.from(encodedSig, 'base64').toString('hex'),
    data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

  log.info(data);

  if (data.algorithm === 'HMAC-SHA256') {
    const
      expectedSig = generateSignature('sha256', secret, payload);

    if (sig === expectedSig) {
      return [ null, data ];
    } else {
      return [ 'Signatures do not match', null ];
    }
  } else {
    return [ 'Unknown algorithm', null ];
  }
}

function generateSignature(algorithm, secret, payload) {
  const
    hmac = crypto.createHmac(algorithm, secret);

  return hmac.update(payload).digest('hex');
}

module.exports = {
  decodeAndValidate
};
