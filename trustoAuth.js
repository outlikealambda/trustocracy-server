const
  bb = require('bluebird'),
  log = require('./logger'),
  jwt = require('jsonwebtoken'),
  jwtVerify = jwt.verify,
  jwtSign = jwt.sign;

function extract(trustoJwt, trustoSecret) {
  try {
    const decoded = jwtVerify(trustoJwt, trustoSecret);
    return bb.resolve(decoded);
  } catch (err) {
    log.info('bad jwt');
    return bb.reject(err);
  }
}

module.exports = function(trustoSecret) {
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
    }
  };
};
