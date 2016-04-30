'use strict';

const
  {reject} = require('bluebird'),
  cq = require('./cypher-query'),
  idGenerator = require('./id-generator'),
  log = require('./logger'),
  rel = require('./relationships'),
  _ = require('lodash');


function validateUser(id, secret) {
  log.info('validating', id, secret);
  // TODO: actual validation
  return getUser(id).then(user => user.name ? user : reject('no user found'));
}

function getUserInfo(id) {
  return cq.query(queryBuilder.userInfo(id)).then(transformer.userInfo);
}

function getUser(id) {
  return cq.query(queryBuilder.user(id)).then(transformer.user);
}

function getUserByFacebookId(fbUserId) {
  return cq.query(queryBuilder.fbUser(fbUserId))
    .then(transformer.user);
}

function getUserByGoogleId(gaUserId) {
  return cq.query(queryBuilder.gaUser(gaUserId)).then(transformer.user);
}

function createUserWithFacebookId(fbUserId, name) {
  const query = queryBuilder.createFacebookUser(idGenerator.nextUserId(), fbUserId, name);

  return cq.query(query).then(transformer.user);
}

function createUserWithGoogleId(gaUserId, name, email) {

  const
    userId = idGenerator.nextUserId(),
    upgradeContact = queryBuilder.upgradeContactToPerson(userId, gaUserId, name, email),
    createUser = queryBuilder.createGoogleUser(userId, gaUserId, name);

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
          return cq.query(queryBuilder.addEmailToUser(user.id, email))
            .then(() => user);
        });
    });
}

// removes any existing delegate relationships, and adds the new relationship
// TODO: handle topic specific relationships
function delegate(userId, delegate) {
  return cq.query(queryBuilder.removeDelegate(userId, delegate))
    .then(() => cq.query(queryBuilder.addDelegate(userId, delegate)))
    .then(() => delegate);
}

function getTrusteeByEmail(email) {
  return cq.query(queryBuilder.userByEmail(email))
    .then(transformer.trustee);
}

// (Assumes already created opinion)
// 1. un-publish any existing published drafts
// 2. mark the new draft as published
//
// we don't transform the result because we don't use it
function publishOpinion(userId, topicId, opinionId) {
  return cq.query(queryBuilder.unpublishOpinion(userId, topicId))
    .then(cq.query(queryBuilder.publishOpinion(opinionId)));
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

  return cq.queryWithParams(queryBuilder.createOpinion(userId, topicId), {opinion, qualifications})
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

function getOpinionById(opinionId) {
  return cq.query(queryBuilder.opinionById(opinionId))
    .then(transformer.opinion);
}

function getOpinionsByIds(ids) {
  return cq.query(queryBuilder.opinionsByIds(ids))
    .then(transformer.opinionsByIds);
}

function getOpinionsByTopic(topicId) {
  return cq.query(queryBuilder.opinionsByTopic(topicId))
    .then(transformer.opinionsByTopic);
}


// returns the most recently saved opinion for a user/topic
function getOpinionByUserTopic(userId, topicId) {
  return cq.query(queryBuilder.opinionDraftByUserTopic(userId, topicId))
    .then(transformer.opinion)
    .then(opinion => opinion ? opinion : {} );
}

function getNearestOpinions(userId, topicId) {
  log.time('opinions');
  return cq.query(queryBuilder.nearest(userId, topicId))
    .then(neoData => {
      log.timeEnd('opinions');
      return neoData;
    })
    .then(transformer.nearest);
}

function getTopic(id) {
  return cq.query(queryBuilder.topic(id))
    .then(transformer.topic);
}

function getTopics() {
  return cq.query(queryBuilder.topics())
    .then(transformer.topics);
}

// given a user and a list of emails, connect the user to any existing
// contacts or people on that list, and create (and connect) new contacts for
// any emails not in the graph
function connectUserToEmails(userId, emailsWithDups) {
  const emails = _.uniq(emailsWithDups);

  return cq.query(queryBuilder.emailsInGraph(emails))
    .then(transformer.emails)
    .then(log.promise('existing'))
    .then(existing => _.difference(emails, existing))
    .then(log.promise('difference'))
    .then(newEmails => newEmails.length ? cq.query(queryBuilder.addEmailsToGraph(newEmails)) : null)
    .then(() => cq.query(queryBuilder.knowAllUnconnectedEmails(userId, emails)));
}

const queryBuilder = {

  user: function(id) {
    return `MATCH (u:Person {id:${id}})
            RETURN u`;
  },

  // returns [ user, [emails], [neighbors: {user, relationship}] ]
  // speed: unknown, possibly unimportant
  userInfo: function(id) {
    return `MATCH (u:Person)-[${rel.personEmail.hasEmail}]->(e:Email)
            WHERE u.id = ${id}
            WITH u, collect(e.email) as emails
            OPTIONAL MATCH (u)-[r]->(f:Person)
            RETURN u as user, emails, collect({friend: f, relationship: type(r)}) as neighbors`;
  },

  userByEmail: function (email) {
    return `MATCH (e:Email)<-[${rel.personEmail.hasEmail}]-(u:Person)
            WHERE e.email = '${email}'
            RETURN u`;
  },

  emailsInGraph: function(emails) {
    return `MATCH (e:Email)<-[${rel.personEmail.hasEmail}]-(n)
            WHERE e.email IN [${wrapEmailsInQuotes(emails).join(', ')}]
            RETURN e`;
  },

  addEmailsToGraph: function(emails) {
    return 'CREATE ' +
      emails
        .map(email => `(:Contact)-[${rel.personEmail.hasEmail}]->(:Email{email:'${email}'})`)
        .join(', ');
  },

  // adds a :KNOWS relationship to all people (users/contacts) who aren't
  // already related to userId
  knowAllUnconnectedEmails: function(userId, emails) {
    return `MATCH (u:Person), (e:Email)<-[${rel.personEmail.hasEmail}]-(n)
            WHERE e.email IN [${wrapEmailsInQuotes(emails).join(', ')}] AND u.id = ${userId} AND NOT (u)-->(n)
            CREATE (u)-[${rel.personPerson.knows}]->(n)`;
  },

  fbUser: function(fbUserId) {
    return `MATCH (u:Person {fbUserId:${fbUserId}})
            RETURN u`;
  },

  gaUser: function(gaUserId) {
    // google id is too long as an int, so convert it to a string
    return `MATCH (u:Person {gaUserId:'${gaUserId}'})
            RETURN u`;
  },

  nearest: function(userId, topicId) {
    return `MATCH (p:Person)-[fr${rel.personPerson.follows}]->(f:Person)-[rs${rel.personPerson.follows}*0..2]->(ff:Person)-[${rel.personOpinion.opines}]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            RETURN type(fr), f, extract(r in rs | type(r)) as extracted, ff, o`;
  },

  opinionsByIds: function(ids) {
    const idList = ids.join();
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id IN [${idList}]
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q`;
  },

  // published only
  opinionsByTopic: function (topicId) {
    return `MATCH (p:Person) -[${rel.personOpinion.opines}]-> (o:Opinion) --> (t:Topic)
            WHERE t.id = ${topicId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q`;

  },

  opinionById: function(opinionId) {
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id = ${opinionId}
            OPTIONAL MATCH (o) <-[:QUALIFIES]- (q:Qualifications)
            RETURN o, p, q`;
  },

  opinionDraftByUserTopic: function(userId, topicId) {
    return `MATCH (p:Person)-[${rel.personOpinion.thinks}]->(o:Opinion)-->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q
            ORDER BY o.created DESC
            LIMIT 1`;
  },

  // actual opinion and qualifications are passed as params
  // via queryWithParams
  createOpinion: function(userId, topicId) {
    return `MATCH (p:Person), (t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            CREATE
              (p)-[${rel.personOpinion.thinks}]->(o:Opinion)-[${rel.opinionTopic.addresses}]->(t),
              (q:Qualifications)-[:QUALIFIES]->(o)
            SET
              o = { opinion },
              o.created = timestamp(),
              q = { qualifications }
            RETURN o, p, q`;
  },

  createFacebookUser: function(userId, facebookId, name) {
    return `CREATE (p:Person {name: '${name}', id: ${userId}, fbUserId: ${facebookId}}) RETURN p`;
  },

  createGoogleUser: function(userId, googleId, name) {
    // google id is too long as an int, so convert it to a string
    return `CREATE (p:Person {name: '${name}', id: ${userId}, gaUserId: '${googleId}'}) RETURN p`;
  },

  upgradeContactToPerson: function (userId, gaUserId, name, email) {
    return `MATCH (c:Contact)-[${rel.personEmail.hasEmail}]->(e:Email {email:'${email}'})
            REMOVE c:Contact
            SET c :Person, c.name = '${name}', c.id = ${userId}, c.gaUserId = '${gaUserId}'
            RETURN c`;
  },

  addEmailToUser: function(userId, email) {
    return `MATCH (u:Person)
            WHERE u.id = ${userId}
            CREATE (u)-[${rel.personEmail.hasEmail}]->(e:Email {email:'${email}'})`;
  },

  publishOpinion: function(opinionId) {
    return `MATCH (p:Person)-[${rel.personOpinion.thinks}]->(o:Opinion)
            WHERE o.id=${opinionId}
            CREATE (p)-[${rel.personOpinion.opines}]->(o)
            RETURN o.id`;
  },

  unpublishOpinion: function(userId, topicId) {
    return `MATCH (p:Person)-[r:${rel.personOpinion.opines}]->(:Opinion)-->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            DELETE r`;
  },

  topic: function(topicId) {
    return `MATCH (t:Topic)
            WHERE t.id = ${topicId}
            RETURN t`;
  },

  topics: function() {
    return 'MATCH (t:Topic) RETURN t';
  },

  addDelegate: function (userId, delegate) {
    return `MATCH (u:Person), (d:Person)
            WHERE u.id = ${userId} AND d.id = ${delegate.id}
            CREATE (u)-[:${delegate.relationship}]->(d)`;
  },

  removeDelegate: function (userId, delegate) {
    return `MATCH (u:Person)-[r]->(d:Person)
            WHERE u.id = ${userId} AND d.id = ${delegate.id}
            DELETE r`;
  }
};

function wrapEmailsInQuotes(emails) {
  return emails.map(email => `'${email}'`);
}

const transformer = {
  user : extractFirstResult,

  trustee : neoData => extractFirstData(neoData, row => {
    const [user] = row;

    return Object.assign(
      {},
      {
        name: user.name,
        id: user.id
      }
    );
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
          .map(neighbor => Object.assign({}, {
            name: neighbor.friend.name,
            id: neighbor.friend.id,
            relationship: neighbor.relationship
          }));

    return Object.assign({},
      {
        name: user.name,
        id: user.id,
        trustees: trustees,
        emails : emails
      }
    );
  }),

  emails : neoData => extractAllData(neoData, row => row[0].email),

  opinion : neoData => extractFirstData(neoData, extractUserOpinion),

  opinionsByIds : neoData => extractAllData(neoData, extractUserOpinion),

  opinionsByTopic : neoData => extractAllData(neoData, extractUserOpinion),

  topic : extractFirstResult,

  topics : extractFirstResults,

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
  getUserByGoogleId,
  getUserByFacebookId,
  createUserWithFacebookId,
  createUserWithGoogleId,
  getNearestOpinions,
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

  validateUser,

  connectUserToEmails
};
