'use strict';

const
  jwt = require('jsonwebtoken');

function asyncValidate(token, certs, callback) {

  jwt.verify(
    token,
    certs['bdb7149ce3018a17a225db0abc4939bea50573b2'],
    { algorithms: ['RS256'] },
    tryAgainIfWrongKey
  );

  function tryAgainIfWrongKey(err, payload) {
    if (!err) {
      callback(err, payload);
      return;
    }

    jwt.verify(
      token,
      certs['4cb1c44619bc972cb746d6095fe82afcce4e62e9'],
      { algorithms: ['RS256'] },
      callback
    );
  }
}

module.exports = {
  asyncValidate
};
