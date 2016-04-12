'use strict';

const
  crypto = require('crypto');

function decodeAndValidate(secret, signedRequest) {

  const
    [ encodedSig, payload ] = signedRequest.split('.'),
    sig = Buffer.from(encodedSig, 'base64').toString('hex'),
    data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

  if (data.algorithm === 'HMAC-SHA256') {
    const
      hmac = crypto.createHmac('sha256', secret),
      expectedSig = hmac.update(payload).digest('hex');

    if (sig === expectedSig) {
      return [ null, data ];
    } else {
      return [ 'Signatures do not match', null ];
    }
  } else {
    return [ `Unknown algorithm: ${data.algorithm}`, null ];
  }
}

module.exports = {
  decodeAndValidate
};
