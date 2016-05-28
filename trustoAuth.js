const
  db = require('./graph'),
  bb = require('bluebird'),
  log = require('./logger'),
  jwt = require('jsonwebtoken'),
  jwtVerify = jwt.verify,
  jwtSign = jwt.sign,
  crypto = require('crypto');

function extract(trustoJwt, trustoSecret) {
  try {
    const decoded = jwtVerify(trustoJwt, trustoSecret);
    return bb.resolve(decoded);
  } catch (err) {
    log.info('bad jwt');
    return bb.reject(err);
  }
}

function saltSecret(secret, options) {
  return crypto.pbkdf2Sync(
    secret,
    options.salt,
    options.iterations,
    options.keylen,
    options.digest
  ).toString('hex');
}

module.exports = (trustoSecret, saltOptions) => {
  return {

    validateMiddleware : (req, res, next) => {
      extract(req.cookies.trustoToken, trustoSecret)
        .then(claims => {
          req.userId = claims.sub;
          next();
        })
        .catch(() => res.status(401).send('please log in').end());
    },

    getUserId : (req) => {
      // handle error at endpoint
      return extract(req.cookies.trustoToken, trustoSecret)
        .then(claims => claims.sub);
    },

    createJwt: userInfo => {
      const options =
        {
          algorithm: 'HS256',
          subject: userInfo.id,
          issuer: 'trustocracy.org',
          audience: 'trustocracy.org',
          expiresIn: 3600
        };

      return jwtSign({}, trustoSecret, options);
    },

    validateUser: (userHandle, userSecret) => {
      return db.validateUser(userHandle, saltSecret(userSecret, saltOptions));
    },

    createUser: (name, email, secret) => {
      return db.createUser(name, email, saltSecret(secret, saltOptions));
    }
  };
};
