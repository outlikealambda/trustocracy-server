const
  bb = require('bluebird'),
  log = require('./logger'),
  jwt = require('jsonwebtoken'),
  jwtVerify = jwt.verify,
  jwtSign = jwt.sign;

function validate(trustoJwt, userId, trustoSecret) {
  return extract(trustoJwt, trustoSecret)
    .then(claims => {
      if (claims.sub === parseInt(userId, 10)) {
        return claims;
      } else {
        log.info('user doesn\'t match jwt!');
        return bb.reject('user doesn\'t match jwt!');
      }
    });
}

function extract(trustoJwt, trustoSecret) {
  try {
    const decoded = jwtVerify(trustoJwt, trustoSecret);
    return bb.resolve(decoded);
  } catch (err) {
    log.info('bad jwt', err);
    return bb.reject(err);
  }
}

module.exports = function(trustoSecret) {
  return {
    validateJwt : (req, res, next) => {
      validate(req.cookies.trustoToken, req.params.userId, trustoSecret)
        .then(() => next())
        .catch(() => res.status(401).send('please log in').end());
    },
    getUserId : (req) => {
      // handle error at endpoint
      return extract(req.cookies.trustoToken, trustoSecret)
        .then(claims => {
          log.info('checking user', claims);
          return claims;
        })
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
    }
  };
};
