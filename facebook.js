'use strict';

const
  rp = require('request-promise'),
  validate = require('./validate');


function fbGetMe(accessToken) {
  return rp(`https://graph.facebook.com/me?access_token=${accessToken}`);
  //return rp(`https://graph.facebook.com/oauth/access_token?client_id=${apiKey}&client_secret=${secret}&code=${code}`);
}


module.exports = {
  fbDecodeAndValidate : validate.decodeAndValidate,
  fbGetMe
};
