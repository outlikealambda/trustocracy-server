'use strict';

const
 crypto = require('crypto'),
 rp = require('request-promise');


function fbDecodeAndValidate(secret, signedRequest) {

  const [ encodedSig, payload ] = signedRequest.split('.');
  const sig = Buffer.from(encodedSig, 'base64').toString('hex');
  const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

  if (data.algorithm === 'HMAC-SHA256') {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSig = hmac.digest('hex');
    if (sig === expectedSig) {
      return [ null, data ];
    } else {
      return [ 'Signatures do not match', null ];
    }
  } else {
    return [ `Unknown algorithm: ${data.algorithm}`, null ];
  }
}

function fbGetMe(accessToken) {
  return rp(`https://graph.facebook.com/me?access_token=${accessToken}`)
  //return rp(`https://graph.facebook.com/oauth/access_token?client_id=${apiKey}&client_secret=${secret}&code=${code}`);
}


module.exports = {
  fbDecodeAndValidate,
  fbGetMe
};
