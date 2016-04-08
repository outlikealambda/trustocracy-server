'use strict';

const
  {join} = require('bluebird'),
  cq = require('./cypher-query'),
  idGenerator = require('./id-generator'),
  log = require('./logger');


function getUserInfo(id) {
  return join(getUser(id), getUserNeighbors(id), combineUserAndNeighbors);
}

function getUser(id) {
  return cq.query(queryBuilder.user(id)).then(transformer.user);
}

function getUserByFacebookId(fbUserId) {
  return cq.query(queryBuilder.fbUser(fbUserId)).then(transformer.user);
}

function createUserWithFacebookId(fbUserId, name) {
  const query = `CREATE (p:Person {name: '${name}', id: ${idGenerator.nextUserId()}, fbUserId: ${fbUserId}}) RETURN p`;
  return cq.query(query).then(transformer.user);
}

function getUserNeighbors(id) {
  return cq.query(queryBuilder.neighbors(id)).then(transformer.neighbors);
}

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

const queryBuilder = {

  user: function(id) {
    return `MATCH (u:Person {id:${id}})
            RETURN u`;
  },

  fbUser: function(fbUserId) {
    return `MATCH (u:Person {fbUserId:${fbUserId}})
            RETURN u`;
  },

  neighbors: function(id) {
    return `MATCH (u:Person {id:${id}})-[relationship]->(friend:Person)
            RETURN u, type(relationship) as r, friend`;
  },

  nearest: function(userId, topicId) {
    return `MATCH (p:Person)-[fr:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..2]->(ff:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
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
    return `MATCH (p:Person) -[:OPINES]-> (o:Opinion) --> (t:Topic)
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
    return `MATCH (p:Person)-[:THINKS]->(o:Opinion)-->(t:Topic)
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
              (p)-[:THINKS]->(o:Opinion)-[:ADDRESSES]->(t),
              (q:Qualifications)-[:QUALIFIES]->(o)
            SET
              o = { opinion },
              o.created = timestamp(),
              q = { qualifications }
            RETURN o, p, q`;
  },

  publishOpinion: function(opinionId) {
    return `MATCH (p:Person)-[:THINKS]->(o:Opinion)
            WHERE o.id=${opinionId}
            CREATE (p)-[:OPINES]->(o)
            RETURN o.id`;
  },

  unpublishOpinion: function(userId, topicId) {
    return `MATCH (p:Person)-[r:OPINES]->(:Opinion)-->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            DELETE r`;
  },

  topic: function(topicId) {
    return `MATCH (t:Topic)
            WHERE t.id = ${topicId}
            RETURN t`;
  },

  topics: function() {
    return `MATCH (t:Topic) RETURN t`;
  }
};


const transformer = {
  user : extractFirstResult,

  opinion : neoData => extractFirstData(neoData, extractUserOpinion),

  opinionsByIds : neoData => extractAllData(neoData, extractUserOpinion),

  opinionsByTopic : neoData => extractAllData(neoData, extractUserOpinion),

  topic : extractFirstResult,

  topics : extractFirstResults,

  neighbors2 : neoData => {
    return extractAllData(neoData, row => {
      const [, rel, friend] = row;

      return {
        rel,
        friend
      };
    });
  },

  nearest: neoData => {
    const scoredPaths = extractAllData(neoData, row => {
      const
        [friendRelationship, friend, path, opiner, opinion] = row,
        score = scorePath(path);

      return {
        friendRelationship,
        friend,
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
  const [opinion, user, qualifications] = row;

  return Object.assign(
    {},
    opinion,
    { user : user },
    { qualifications: qualifications }
  );
}

function combineUserAndNeighbors(user, neighbors) {
  return {
    user,
    neighbors
  };
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
  getNearestOpinions,
  getUserInfo,
  getUserByFacebookId,
  createUserWithFacebookId,
  getOpinionById,
  getOpinionsByIds,
  getOpinionsByTopic,
  getOpinionByUserTopic, // returns most recently edited opinion

  saveOpinion, // saves, and returns with saved id attached

  // 1. save the opinion as a draft
  // 2. mark it as published
  // 3. return that opinion
  publishOpinion : function (userId, topicId, qualifiedOpinion) {
    return saveOpinion(userId, topicId, qualifiedOpinion)
      .then(draft => {
        log.info('draft');
        log.info(draft);
        return publishOpinion(userId, topicId, draft.id)
          .then(() => draft);
      });
  },

  getTopic,
  getTopics
};
