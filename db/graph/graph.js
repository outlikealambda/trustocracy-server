'use strict';

const {reject} = require('bluebird');
const cq = require('./cypher-query');
const qb = require('./query-builder');
const transformer = require('./transformer');
const idGenerator = require('./id-generator');
const log = require('../../logger');
const models = require('./models');
const _ = require('lodash');

function validateUser (id, saltedSecret) {
  log.info('validating', id, saltedSecret);
  // TODO: actual validation
  return getUser(id).then(user => !user.salt || user.salt === saltedSecret ? user : reject('no user found'));
}

function getUserInfo (id) {
  return cq.query(qb.userInfo(id)).then(transformer.userInfo);
}

function getUserInfoWithLocations (id) {
  return cq.query(qb.getUserInfoWithLocations(id))
    .then(transformer.userInfoWithLocation)
    .then(userInfo => {
      log.info('graph.js basicUser', userInfo);
      return cq.query(qb.locationByUserId(id))
        .then(transformer.location)
        .then(locations => {
          log.info('graph.js locations', locations);
          userInfo.location = locations;
          log.info('graph.js basicUser w/ location', userInfo);
          return userInfo;
        });
    });
}

function getUser (id) {
  return cq.query(qb.user(id)).then(transformer.user);
}

function getUserByFacebookId (fbUserId) {
  return cq.query(qb.fbUser(fbUserId))
    .then(transformer.user);
}

function getUserByGoogleId (gaUserId) {
  return cq.query(qb.gaUser(gaUserId)).then(transformer.user);
}

function createUser (name, email, salt) {
  const userByEmail = qb.userByEmail(email);

  let userId;

  cq.query(userByEmail)
    .then(transformer.user)
    .then(user => {
      if (user.id) {
        throw new Error('already exists!');
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

function createUserWithFacebookId (fbUserId, name) {
  const createUser = qb.createUser({
    person: {
      id: idGenerator.nextUserId(),
      fbUserId,
      name
    }
  });

  return cq.query(createUser).then(transformer.user);
}

function createUserWithGoogleId (gaUserId, name, email) {
  const userId = idGenerator.nextUserId();
  const upgradeContact = qb.upgradeContactToGaPerson(userId, gaUserId, name, email);
    // createUser = qb.createGoogleUser(userId, gaUserId, name);
  const createUser = qb.createUser({
    person: {
      id: userId,
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
function delegate (userId, delegate) {
  return cq.query(qb.removeDelegate(userId, delegate))
    .then(() => cq.query(qb.addDelegate(userId, delegate.id)))
    .then(() => delegate);
}

function getTrusteeByEmail (email) {
  return cq.query(qb.userByEmail(email))
    .then(transformer.trustee);
}

// (Assumes already created opinion)
// 1. un-publish any existing published drafts
// 2. mark the new draft as published
//
// we don't transform the result because we don't use it
function publishOpinion (draftId, opinionId) {
  return cq.query(qb.unpublishOpinion(opinionId))
    .then(() => cq.query(qb.publishOpinion(draftId)));
}

function saveOpinion (userId, topicId, qualifiedOpinion) {
  // split up the qualified opinion for the graphDb
  // always increment the draftId;
  // reuse the opinionId if it's there;
  const opinion = {
    id: qualifiedOpinion.id || idGenerator.nextOpinionId(),
    draftId: idGenerator.nextDraftId(),
    text: qualifiedOpinion.text,
    influence: 0
  };
  const qualifications = qualifiedOpinion.qualifications;

  return cq.queryWithParams(qb.createOpinion(userId, topicId), {opinion, qualifications})
    .then(() => {
      // reconstruct the qualified opinion for the api
      return Object.assign(
        {},
        opinion,
        { qualifications: qualifications },
        { user: qualifiedOpinion.user }
      );
    });
}

// gets location by user id
function getLocationByUserId (userId) {
  return cq.query(qb.locationByUserId(userId))
    .then(transformer.location);
}

function getUserByLocation (locationId) {
  return cq.query(qb.userByLocation(locationId))
    .then(transformer.basicUser);
}

function getOpinionById (opinionId) {
  return cq.query(qb.opinionById(opinionId))
    .then(transformer.opinion)
    .then(({ author, opinion, topic }) =>
      getInfluence(author.id, topic.id)
        .then(({ influence }) => {
          topic.created = new Date(topic.created);
          return {
            author,
            topic,
            id: opinion.id,
            created: new Date(opinion.created),
            influence,
            text: opinion.text
          };
        }));
}

function getAuthoredOpinion (authorId, topicId) {
  return cq.query(qb.authoredOpinion(authorId, topicId))
    .then(transformer.authoredOpinion);
}

function getOpinionsByIds (ids) {
  return cq.query(qb.opinionsByIds(ids))
    .then(transformer.opinionsByIds);
}

function getOpinionsByTopic (topicId) {
  return cq.query(qb.opinionsByTopic(topicId))
    .then(transformer.opinionsByTopic)
    .then(opinions => {
      log.info(`found ${opinions.length} opinions for topic ${topicId}`);
      return opinions;
    })
    .then(opinions =>
      Promise.all(
        opinions.map(({ author, opinion }) =>
          getInfluence(author.id, topicId)
            .then(({ influence }) => (
              { author,
                id: opinion.id,
                created: new Date(opinion.created),
                influence
              })))))
    .then(opinionsWithInfluence =>
      opinionsWithInfluence.sort((opinion1, opinion2) =>
        opinion2.influence - opinion1.influence));
}

function getOpinionIdsByTopic (topicId) {
  return cq.query(qb.opinionIdsByTopic(topicId))
    .then(transformer.opinionIdsByTopic);
}

// returns the most recently saved opinion for a user/topic
function getOpinionByUserTopic (userId, topicId) {
  return cq.query(qb.opinionDraftByUserTopic(userId, topicId))
    .then(transformer.opinion)
    .then(opinion => opinion || models.opinion);
}

// Queries for friend + author combos, and then attaches influence
// and opinion with separate queries.
// Inefficient for now, but opinion and influence should both be straightforward
// to cache when optimization is needed.
function getConnectedOpinions (userId, topicId) {
  log.time('connected opinions time');
  return cq.query(qb.friendsAuthors(userId, topicId))
    .then(neoData => {
      log.timeEnd('connected opinions time');
      return neoData;
    })
    .then(transformer.friendsAuthors)
    .then(fas => {
      // group by author...
      const authorsById = {};
      const authorIds = [];
      const authorlessFriends = [];

      for (const { friend, author } of fas) {
        if (!author) {
          authorlessFriends.push(friend);
        } else {
          let existingAuthor = authorsById[author.id];
          if (existingAuthor) {
            existingAuthor.friends.push(friend);
          } else {
            existingAuthor = { author, friends: [ friend ] };
            authorsById[author.id] = existingAuthor;
            authorIds.push(author.id);
          }
        }
      }

      // Sort friends by rank
      authorIds.forEach(aid => authorsById[aid].friends.sort((a, b) => {
        if (a.isRanked && !b.isRanked) return -1;
        if (b.isRanked && !a.isRanked) return 1;
        return a.rank - b.rank;
      }));

      // Sort author groups by highest ranked friend.
      // Assumes friends have already been sorted.
      authorIds.sort((a, b) => getFirstFriendRank(authorsById[a]) - getFirstFriendRank(authorsById[b]));

      log.info(`found ${authorIds.length} authors`);

      // Get influence and opinion and attach to result
      return Promise.all(
        authorIds.map(authorId =>
          Promise.all([
            getInfluence(authorId, topicId).then(r => r.influence),
            getAuthoredOpinion(authorId, topicId)
          ])
          .then(results => {
            const [influence, opinion] = results;

            return Object.assign(
              { influence, opinion },
              authorsById[authorId]
            );
          })
        )
      )
      .then(results => results.concat({
        friends: authorlessFriends
      }));
    });
}

function getFriends (userId) {
  return cq.query(qb.friends(userId))
    .then(transformer.friends);
}

function getFirstFriendRank (authorObj) {
  const friends = authorObj.friends || [];
  const first = friends[0] || {};

  return first.rank || first.rank === 0 ? first.rank : 1000;
}

function getInfluence (userId, topicId) {
  return cq.query(qb.measureInfluence(userId, topicId))
    .then(transformer.influence);
}

function setTarget (userId, targetId, topicId) {
  return cq.query(qb.setTarget(userId, targetId, topicId));
}

function clearTarget (userId, topicId) {
  return cq.query(qb.clearTarget(userId, topicId));
}

// empty object when no user?
// TODO: Haskell/Clojure/Ocaml/Something-functional
function addToPool (userId, friendEmail) {
  return cq.query(qb.userByEmail(friendEmail))
    .then(transformer.user)
    .then(friend => {
      if (!friend.name) {
        // no user with that email
        return {};
      }

      return cq.query(qb.addToPool(userId, friend.id))
        // return the added friend
        .then(() => friend);
    });
}

function removeFromPool (userId, friendId) {
  return cq.query(qb.removeFromPool(userId, friendId));
}

function getPooled (userId) {
  return cq.query(qb.getPooled(userId))
    .then(transformer.friends);
}

function rankDelegates (userId, rankedDelegates) {
  const delegateIds = rankedDelegates.map(({id}) => id);

  return cq.query(qb.rankDelegates(userId, delegateIds));
}

function getTopic (id) {
  return cq.query(qb.topic(id))
    .then(transformer.topic);
}

function getTopics () {
  return cq.query(qb.topics())
    .then(transformer.topics)
    .then(topics =>
      topics.sort((topic1, topic2) =>
        topic1.lastUpdated > topic2.lastUpdated
          ? -1
          : topic1.lastUpdated < topic2.lastUpdated
            ? 1
            : 0));
}

// given a user and a list of emails, connect the user to any existing
// contacts or people on that list, and create (and connect) new contacts for
// any emails not in the graph
function connectUserToEmails (userId, emailsWithDups) {
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
function connectUserToLocation (userId, name, country, city, postal) {
  const locationId = idGenerator.nextLocationId();
  // log.info('graph.js location name:', name, country, city, postal);
  return cq.query(qb.connectUserToLocation(userId, locationId, name, country, city, postal))
  .then(transformer.location);
}

function removeLocation (locationId) {
  return cq.query(qb.removeLocation(locationId))
    .then(val => log.info(val));
}

function updateLocation (locationId, name, country, city, postal) {
  return cq.query(qb.userByLocation(locationId))
    .then(transformer.basicUser)
    .then(result => {
      cq.query(qb.removeLocation(locationId));
      log.info('graph.js basicUser: ', result);
      return result.id;
    })
    .then(userId => {
      log.info('graph.js userId post remove', userId);
      log.info('graph.js location name post remove', name);
      cq.query(qb.connectUserToLocation(userId, locationId, name, country, city, postal));
    })
    .then(() => ({name, id: locationId, country, city, postal}));
}

module.exports = {
  getUser,
  getUserInfo,
  getUserInfoWithLocations,
  getUserByGoogleId,
  getUserByFacebookId,
  connectUserToLocation,
  createUser,
  createUserWithFacebookId,
  createUserWithGoogleId,

  getFriends,
  getConnectedOpinions,
  setTarget,
  clearTarget,
  addToPool,
  removeFromPool,
  getPooled,
  rankDelegates,

  getLocationByUserId,
  getUserByLocation,
  getOpinionById,
  getOpinionsByIds,
  getOpinionsByTopic,
  getOpinionIdsByTopic, // for prompts in postgres
  getOpinionByUserTopic, // returns most recently edited opinion

  getInfluence,

  getTrusteeByEmail,

  saveOpinion, // saves, and returns with saved id attached

  // 1. save the opinion as a draft
  // 2. mark it as published
  // 3. return that opinion
  publishOpinion: function (userId, topicId, qualifiedOpinion) {
    return saveOpinion(userId, topicId, qualifiedOpinion)
      .then(newDraft => {
        return publishOpinion(newDraft.draftId, newDraft.opinionId)
          .then(() => newDraft);
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
