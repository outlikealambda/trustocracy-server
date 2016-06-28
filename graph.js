'use strict';

const
  {reject} = require('bluebird'),
  cq = require('./cypher-query'),
  qb = require('./query-builder'),
  idGenerator = require('./id-generator'),
  log = require('./logger'),
  models = require('./models'),
  _ = require('lodash');


function validateUser(id, saltedSecret) {
  log.info('validating', id, saltedSecret);
  // TODO: actual validation
  return getUser(id).then(user => !user.salt || user.salt === saltedSecret ? user : reject('no user found'));
}

function getUserInfo(id) {
  return cq.query(qb.userInfo(id)).then(transformer.userInfo);
}
function getUserInfo2(id) {
  return cq.query(qb.userInfo2(id)).then(transformer.userInfo2);
}

function getUser(id) {
  return cq.query(qb.user(id)).then(transformer.user);
}

function getUserByFacebookId(fbUserId) {
  return cq.query(qb.fbUser(fbUserId))
    .then(transformer.user);
}

function getUserByGoogleId(gaUserId) {
  return cq.query(qb.gaUser(gaUserId)).then(transformer.user);
}

function createUser(name, email, salt) {
  const
    userByEmail = qb.userByEmail(email);

  let
    userId;

  cq.query(userByEmail)
    .then(transformer.user)
    .then(user => {
      if (user.id) {
        throw 'already exists!';
      }

      // only generate if new user
      userId = idGenerator.nextUserId();

      const upgrade = qb.upgradeContact(email, {
        person: {
          id: userId,
          name,
          salt
        }
      });

      return cq.query(upgrade);
    })
    .then(transformer.user)
    .then(user => {

      // successfully upgraded a contact
      if (user.id) {
        return user;
      }

      const createUser = qb.createUser({
        person: {
          id: userId,
          name,
          salt
        }
      });

      return cq.query(createUser)
        .then(transformer.user)
        .then(user => {
          return cq.query(qb.addEmailToUser(user.id, email))
            .then(() => user);
        });
    });
}

function createUserWithFacebookId(fbUserId, name) {
  const createUser = qb.createUser({
    person : {
      id: idGenerator.nextUserId(),
      fbUserId,
      name
    }
  });

  return cq.query(createUser).then(transformer.user);
}

function createUserWithGoogleId(gaUserId, name, email) {

  const
    userId = idGenerator.nextUserId(),
    upgradeContact = qb.upgradeContactToGaPerson(userId, gaUserId, name, email),
    // createUser = qb.createGoogleUser(userId, gaUserId, name);
    createUser = qb.createUser({
      person: {
        id : userId,
        gaUserId,
        name
      }
    });

  log.info('creating/upgrading google user', gaUserId, name, email);

  return cq.query(upgradeContact)
    .then(transformer.user)
    .then(user => {

      // we successfully upgraded an existing contact; done
      if (user.id) {
        return user;
      }

      // create the user from scratch;
      return cq.query(createUser)
        .then(transformer.user)
        .then(user => {

          // after adding the email, pass through the user
          return cq.query(qb.addEmailToUser(user.id, email))
            .then(() => user);
        });
    });
}

// removes any existing delegate relationships, and adds the new relationship
// TODO: handle topic specific relationships
function delegate(userId, delegate) {
  return cq.query(qb.removeDelegate(userId, delegate))
    .then(() => cq.query(qb.addDelegate(userId, delegate)))
    .then(() => delegate);
}

function getTrusteeByEmail(email) {
  return cq.query(qb.userByEmail(email))
    .then(transformer.trustee);
}

// (Assumes already created opinion)
// 1. un-publish any existing published drafts
// 2. mark the new draft as published
//
// we don't transform the result because we don't use it
function publishOpinion(userId, topicId, opinionId) {
  return cq.query(qb.unpublishOpinion(userId, topicId))
    .then(cq.query(qb.publishOpinion(opinionId)));
}

function saveOpinion(userId, topicId, qualifiedOpinion) {
  const
    // split up the qualified opinion for the graphDb
    opinion = {
      id : idGenerator.nextOpinionId(),
      text : qualifiedOpinion.text,
      influence : 0
    },
    qualifications = qualifiedOpinion.qualifications;

  return cq.queryWithParams(qb.createOpinion(userId, topicId), {opinion, qualifications})
    .then(() => {
      // reconstruct the qualified opinion for the api
      return Object.assign(
        {},
        opinion,
        { qualifications : qualifications},
        { user : qualifiedOpinion.user }
      );
    });
}

//gets location by user id
function getLocationById(userId) {
  return cq.query(qb.locationByUserId(userId))
    .then(transformer.location);
}

function getOpinionById(opinionId) {
  return cq.query(qb.opinionById(opinionId))
    .then(transformer.opinion);
}

function getOpinionsByIds(ids) {
  return cq.query(qb.opinionsByIds(ids))
    .then(transformer.opinionsByIds);
}

function getOpinionsByTopic(topicId) {
  return cq.query(qb.opinionsByTopic(topicId))
    .then(transformer.opinionsByTopic);
}


// returns the most recently saved opinion for a user/topic
function getOpinionByUserTopic(userId, topicId) {
  return cq.query(qb.opinionDraftByUserTopic(userId, topicId))
    .then(transformer.opinion)
    .then(opinion => opinion ? opinion : models.opinion );
}

function getNearestOpinions(userId, topicId) {
  log.time('opinions');
  return cq.query(qb.nearest(userId, topicId))
    .then(neoData => {
      log.timeEnd('opinions');
      return neoData;
    })
    .then(transformer.nearest);
}

function getConnectedOpinions(userId, topicId) {
  return cq.query(qb.connected(userId, topicId))
    .then(transformer.connected);
}

function getTopic(id) {
  return cq.query(qb.topic(id))
    .then(transformer.topic);
}

function getTopics() {
  return cq.query(qb.topics())
    .then(transformer.topics);
}

// given a user and a list of emails, connect the user to any existing
// contacts or people on that list, and create (and connect) new contacts for
// any emails not in the graph
function connectUserToEmails(userId, emailsWithDups) {
  const emails = _.uniq(emailsWithDups);

  return cq.query(qb.emailsInGraph(emails))
    .then(transformer.emails)
    .then(log.promise('existing'))
    .then(existing => _.difference(emails, existing))
    .then(log.promise('difference'))
    .then(newEmails => newEmails.length ? cq.query(qb.addEmailsToGraph(newEmails)) : null)
    .then(() => cq.query(qb.knowAllUnconnectedEmails(userId, emails)));
}

/*
given userId, and string values for:
location, country, city
and number:
postal
a user to location relationship is created
*/
function connectUserToLocation(userId, locationName, country, city, postal) {
  const
    locationId = idGenerator.nextLocationId();
  return cq.query(qb.addFullLocationToUser(userId, locationId, locationName, country, city, postal));
}

function removeLocation(locationId) {
  return cq.query(qb.removeLocation(locationId));
}

function updateLocation(locationId, userId, locationName, country, city, postal) {
  const
    newLocationId = idGenerator.nextLocationId();
  return cq.query(qb.removeLocation(locationId))
    .then(() => cq.query(qb.addFullLocationToUser(userId, newLocationId, locationName, country, city, postal)));
}

const transformer = {
  user : extractFirstResult,

  trustee : neoData => extractFirstData(neoData, row => {
    const [user] = row;

    return {
      name: user.name,
      id: user.id
    };
  }),

  userInfo : neoData => extractFirstData(neoData, row => {
    log.info(row);

    const
      [user, emails, neighbors] = row,
      trustees =
        neighbors
          // if we have no friends, OPTIONAL MATCH returns an empty neighbor
          // so filter those out here
          .filter(neighbor => neighbor.friend)
          .map(neighbor => {
            return {
              name: neighbor.friend.name,
              id: neighbor.friend.id,
              relationship: neighbor.relationship
            };
          });

    return {
      name: user.name,
      id: user.id,
      trustees: trustees,
      emails : emails
    };
  }),

  userInfo2 : neoData => extractFirstData(neoData, extractFullUser),

  emails : neoData => extractAllData(neoData, row => row[0].email),

  location : neoData => extractAllData(neoData, extractUserLocation),

  opinion : neoData => extractFirstData(neoData, extractUserOpinion),

  opinionsByIds : neoData => extractAllData(neoData, extractUserOpinion),

  opinionsByTopic : neoData => extractAllData(neoData, extractUserOpinion),

  topic : extractFirstResult,

  topics : extractFirstResults,

  connected : neoData => extractAllData(neoData, row => {
    const
      [opinion, author, rawConnections] = row,
      connections = rawConnections.map(rawConnection => {
        const [relationship, friend, hops] = rawConnection;

        return {
          friend: Object.assign(friend, {relationship: relationship}),
          hops
        };
      });

    return {
      opinion,
      author,
      connections
    };
  }),

  nearest: neoData => {
    const scoredPaths = extractAllData(neoData, row => {
      const
        [friendRelationship, friend, path, opiner, opinion] = row,
        score = scorePath(path);

      return {
        friend: Object.assign(
          {},
          friend,
          { relationship: friendRelationship }
        ),
        path,
        opiner,
        opinion: opinion.id,
        score,
        key: friend.id + ':' + opiner.id
      };
    });

    return {
      paths: getUniqueStartFinishCombos(scoredPaths)
    };
  }
};

/**
 * returns a list of mapFn applied to each row of data
 * mapFn: maps over each data[i].row
 * defaultResult: returned if there are no results
data generally comes back in the form:

{
  results: [
    {
      data: [
        {
          row: [
            {
              id: someId,
              text: "or whatever fields"
            }
          ]
        }, {
          row: [
            {
              id: 2,
              text: "or whatever fields"
            }
          ]
        }
      ]
    }
  ]
}
 */
function extractAllData(neoData, mapFn = (row => row), defaultResult = []) {
  const [{data}] = neoData.results;

  return noResults(neoData) ? defaultResult : data.map(datum => mapFn(datum.row));
}

/**
 * returns the result of mapFn applied to the first element of the results
 */
function extractFirstData(neoData, mapFn, defaultResult) {
  return extractAllData(neoData, mapFn, [])[0] || defaultResult;
}

// pulls out the first item from the first row of results
function extractFirstResult(neoData) {
  return extractFirstData(neoData, row => row[0], {});
}

// pulls out the first item from each row of results
function extractFirstResults(neoData) {
  return extractAllData(neoData, row => row[0], []);
}

// null checks a couple of places in the results data
// see @extractAllData for the neo4j data structure
function noResults(neoData) {
  const [result] = neoData.results;

  if (!result) {
    return true;
  }

  const {data: [firstRow]} = result;

  if (!firstRow) {
    return true;
  }

  // has results
  return false;
}
function extractFullUser(row){
  const [user, emails, location, country, city, postal] = row;

  return(
    { name: user.name,
      id: user.id,
      emails: emails,
      location :
        { name: location.name,
          id: location.id,
          country: country.name,
          city: city.name,
          postal: postal.name
        }
    }
  );
}
function extractUserLocation(row) {
  const [location, country, city, postal] = row;

  return(
    { id: location.id,
      name: location.name,
      country: country.name,
      city: city.name,
      postal: postal.name
    }
  );
}

// Record specific extractions
function extractUserOpinion(row) {
  const [opinion, opiner, qualifications] = row;

  return Object.assign(
    {},
    opinion,
    { opiner : opiner },
    { qualifications: qualifications }
  );
}

function getUniqueStartFinishCombos(scoredPaths) {
  const map = new Map();

  for (let sp of scoredPaths) {
    const existingPath = map.get(sp.key);

    if (!existingPath || sp.score < existingPath.score) {
      map.set(sp.key, sp);
    }
  }

  return [...map.values()];
}

function scorePath(path) {
  return path.reduce((score, step) => {
    switch (step) {
    case 'TRUSTS_EXPLICITLY':
      return score + 1;
    case 'TRUSTS':
      return score + 2;
    default:
      log.info(`What kind of path is this: ${step}?`);
      return score;
    }
  }, 0);
}

module.exports = {
  getUserInfo,
  getUserInfo2,
  getUserByGoogleId,
  getUserByFacebookId,
  connectUserToLocation,
  createUser,
  createUserWithFacebookId,
  createUserWithGoogleId,
  getNearestOpinions,
  getConnectedOpinions,
  getLocationById,
  getOpinionById,
  getOpinionsByIds,
  getOpinionsByTopic,
  getOpinionByUserTopic, // returns most recently edited opinion

  getTrusteeByEmail,

  saveOpinion, // saves, and returns with saved id attached


  // 1. save the opinion as a draft
  // 2. mark it as published
  // 3. return that opinion
  publishOpinion : function (userId, topicId, qualifiedOpinion) {
    return saveOpinion(userId, topicId, qualifiedOpinion)
      .then(draft => {
        return publishOpinion(userId, topicId, draft.id)
          .then(() => draft);
      });
  },

  getTopic,
  getTopics,

  delegate,
  updateLocation,
  removeLocation,
  validateUser,

  connectUserToEmails
};
