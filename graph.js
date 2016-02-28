'use strict';

const
  {join} = require('bluebird'),
  cq = require('./cypher-query'),
  models = require('./models'),
  idGenerator = require('./id-generator'),
  log = require('./logger');


function getUserInfo(id) {
  return join(getUser(id), getUserNeighbors(id), combineUserAndNeighbors);
}

function getUser(id) {
  return cq.query(queryBuilder.user(id)).then(transformer.user);
}

function getUserNeighbors(id) {
  return cq.query(queryBuilder.neighbors(id)).then(transformer.neighbors);
}

function publishOpinion(userId, topicId, opinion) {
  // update/build the OPINES relationship with a timestamp
  return cq.query(queryBuilder.markPublished(userId, topicId))
    // write the new vals
    .then(() => cq.queryWithParams(queryBuilder.writeOpinion(opinion.id), opinion))
    .then(transformer.opinion);
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

function getOrCreateOpinion(userId, topicId) {
  return cq.query(queryBuilder.getOpinionByUserTopic(userId, topicId))
    .then(transformer.opinion)
    // if it doesn't exist, create it
    .then(opinion => opinion ? opinion : createOpinion(userId, topicId))
    // add in any missing fields.  lazy migrations could eventually run here
    .then(log.promise('post-creation'))
    .then(opinion => Object.assign({}, models.opinion, opinion));
}

function createOpinion(userId, topicId) {
  return cq.query(queryBuilder.createOpinion(userId, topicId, idGenerator.nextOpinionId()))
    .then(transformer.opinion);
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
  neighbors: function(id) {
    return `MATCH (u:Person {id:${id}})-[relationship]->(friend:Person)
            RETURN u, type(relationship) as r, friend`;
  },
  nearest: function(userId, topicId) {
    return `MATCH (p:Person)-[:TRUSTS_EXPLICITLY|:TRUSTS]->(f:Person)-[rs:TRUSTS_EXPLICITLY|:TRUSTS*0..3]->(ff:Person)-[:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            RETURN f, extract(r in rs | type(r)) as extracted, ff, o`;
  },
  opinionsByIds: function(ids) {
    const idList = ids.join();
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id IN [${idList}]
            RETURN o, p`;
  },
  opinionsByTopic: function (topicId) {
    return `MATCH (p:Person) --> (o:Opinion) --> (t:Topic)
            WHERE t.id = ${topicId}
            RETURN o, p`;

  },
  createOpinion: function(userId, topicId, opinionId) {
    return `MATCH (u:Person), (t:Topic)
            WHERE u.id=${userId} AND t.id=${topicId}
            CREATE (o:Opinion { id: ${opinionId} }),
            (u)-[:THINKS]->(o)-[:ADDRESSES]->(t)
            RETURN o, u`;
  },
  opinionById: function(opinionId) {
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id = ${opinionId}
            RETURN o, p`;
  },
  opinionByUserTopic: function(userId, topicId) {
    return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            RETURN o, p`;
  },
  markPublished: function(userId, topicId) {
    return `MATCH (p:Person)-[:THINKS|:OPINES]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            MERGE (p)-[opines:OPINES]->(o)
            ON CREATE SET opines.created = timestamp(), opines.updated = timestamp()
            ON MATCH SET opines.updated = timestamp()
            RETURN opines`;
  },
  // props are passed in via queryWithParams 2nd arg
  writeOpinion: function(opinionId) {
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id = ${opinionId}
            SET o = { props }
            RETURN o, p`;
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
        [friend, path, opiner, opinion] = row,
        score = scorePath(path);

      return {
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
  const [opinion, user] = row;

  return Object.assign({}, opinion, { user : user });
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
  getOpinionById,
  getOpinionsByIds,
  getOpinionsByTopic,
  getOrCreateOpinion,
  publishOpinion,
  getTopic,
  getTopics
};
