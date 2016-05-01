'use strict';

const
  jwt = require('jsonwebtoken'),
  bb = require('bluebird'),
  rp = require('request-promise'),
  _ = require('lodash'),
  log = require('./logger'),
  certFetchOptions = {
    method: 'GET',
    uri: 'https://www.googleapis.com/oauth2/v1/certs',
    resolveWithFullResponse: true
  };


let
  certificateExpiry = null,
  certificateCache = {},
  gaApiKey;


function asyncValidate(idToken, accessToken, callback) {
  getCerts().then(certObj => {
    let
      error = null,
      certs = _.values(certObj);

    log.info(idToken);

    for (let i = 0; i < certs.length; i++) {
      try {
        let payload = jwt.verify(
          idToken,
          certs[i],
          { algorithms: ['RS256'] }
        );

        log.info(payload);

        // found a valid cert
        callback(null, payload);
        return;

      } catch (err) {
        // only relevant if all certs fail, then we'll fall through to the
        // lower callback
        error = err;
      }
    }

    // no valid certs found
    callback(error, null);
  });
}

function retrieveContacts(accessToken, oldContacts, nextPageToken) {
  const emailAccessOpts = {
    method: 'GET',
    // via stackoverflow, we need the requestMask.  eff google's documentation
    // http://stackoverflow.com/questions/36466050/why-cant-i-retrieve-emails-addresses-and-phone-numbers-with-google-people-api
    uri: 'https://people.googleapis.com/v1/people/me/connections',
    qs: {
      'requestMask.includeField': 'person.names,person.emailAddresses',
      key: gaApiKey
    },
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    json: true
  };

  if (nextPageToken) {
    emailAccessOpts.qs.pageToken = nextPageToken;
  }

  return rp(emailAccessOpts)
    .then(res => {

      // console.log(res);
      log.info('response', res.connections.length, res.nextPageToken);

      const
        newContacts = res.connections.map(contacts => Object.assign(
          {},
          {
            names: getNames(contacts),
            emails: getEmails(contacts)
          })
        ),
        totalContacts = oldContacts.concat(newContacts);



      // no more contacts, stop
      if (!res.nextPageToken) {
        return totalContacts;
      }

      return retrieveContacts(accessToken, totalContacts, res.nextPageToken);

    })
    .catch(err => log.info('error', err));

}


function getNames(contacts) {
  return (contacts.names || [])
    .map(name => name.displayName)
    .filter(name => name);
}


function getEmails(contacts) {
  return (contacts.emailAddresses || [])
    .map(email => email.value)
    .filter(email => email);
}


function getCerts() {
  if (certificateExpiry && Date.now() < certificateExpiry.getTime()) {
    return bb.resolve(certificateCache);
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


module.exports = function(initGaApiKey) {
  gaApiKey = initGaApiKey;

  return {
    asyncValidate,
    retrieveContacts : accessToken => retrieveContacts(accessToken, []),
    retrieveFakeContacts : () => {
      return bb.resolve([
        {
          names: [],
          emails: ['will.reppun@gmail.com', 'test@gmail.com', 'a.duplicate@gmail.com']
        },
        {
          names: [],
          emails: ['a.duplicate@gmail.com']
        },
        {
          names: [],
          emails: ['shadechill.gargoyle@gmail.com']
        },
        {
          names: [],
          emails: ['magentahide.giver@gmail.com']
        },
        {
          names: [],
          emails: ['mirrordeer.python@gmail.com']
        }
      ]);
    }
  };
};
