'use strict';

const
  generateName = require('sillyname'),
  faker = require('faker'),
  forcem = require('forcem-ipsum'),
  idGenerator = require('./id-generator'),
  cq = require('./cypher-query'),
  log = require('./logger'),
  startingUserId = 0,
  startingTopicId = 0,
  finalTopicId = 9,
  USER_COUNT = 3000,
  NODES_PER_OPINION = 300,
  explicitProbability = {
    reciprocity: 0.7,
    ltOne: () => 1,
    ltThree: () => 0.9,
    gteThree: count => Math.pow(0.8, count - 2)
  },
  regularProbability = {
    reciprocity: 0.3,
    ltOne: () => 1,
    ltThree: () => 0.92,
    gteThree: count => Math.pow(0.86, count - 2)
  };

createUser(startingUserId, [])
  .then(() => buildRelationships(startingUserId, 'TRUSTS_EXPLICITLY', explicitProbability))
  .then(() => buildRelationships(startingUserId, 'TRUSTS', regularProbability))
  .then(() => assignOpinions(startingTopicId, finalTopicId))
  .catch(error => {
    log.info(error);
  });

// recursively creates users, as neo doesn't like creating 10000 in a single
// statement -- MUCH slower though.  let's try batching 500 per call
function createUser(id, createStatements) {
  if (id >= USER_COUNT) {
    return createStatements.length ? finishCreateQuery(createStatements) : null;
  }

  logCreation(id, 'users');

  const
    name = generateName(),
    query = `(:Person {name: '${name}', id: ${id}})`;

  createStatements.push(query);

  if (id % 500 === 0) {
    return finishCreateQuery(createStatements)
      .then(() => createUser(id + 1, []));
  } else {
    return createUser(id + 1, createStatements);
  }
}

function finishCreateQuery(createStatements) {
  return cq.query('CREATE ' + createStatements.join());
}

// recursive call
function buildRelationships(id, relationship, probs) {
  if (id >= USER_COUNT) {
    return;
  }

  logCreation(id, `users' ${relationship} relationships`);

  return getTrusters(id, relationship)
    .then(trusterIds => getReciprocalTargets(trusterIds, probs))
    .map(reciprocalId => createRelationship(id, reciprocalId, relationship))
    .then(getTrustees(id))
    .then(existingTrusteeIds => generateNewIds(id, existingTrusteeIds, probs))
    .map(newTrusteeId => createRelationship(id, newTrusteeId, relationship))
    .then(() => buildRelationships(id + 1, relationship, probs));
}

// returns [{id, name}]
function getTrusters(id, relationship) {
  const neighborQuery =
    `MATCH (u:Person)<-[r:${relationship}]-(p:Person)
     WHERE u.id=${id}
     RETURN p`;

  return cq.query(neighborQuery).then(processIds);
}

function getTrustees(id, relationship) {
  const relationshipLabel = relationship ? ':' + relationship : '',
    neighborQuery =
      `MATCH (u:Person)-[r${relationshipLabel}]->(p:Person)
       WHERE u.id=${id}
       RETURN p`;

  return cq.query(neighborQuery).then(processIds);
}

function processIds(neoData) {
  const [{data}] = neoData.results;
  return data.map(datum => datum.row[0].id);
}

function getReciprocalTargets(trusterIds, probability) {
  // console.log('possible reciprocal: ', trusterIds);

  const res = trusterIds.reduce((acc, trusterId) => {
    if (isHappens(probability.reciprocity)) {
      acc.push(trusterId);
    }

    return acc;
  }, []);

  // console.log('reciprocal: ', res);

  return res;
}

function generateNewIds(sourceId, existingIds, probability) {
  const ids = [];

  // console.log('sourceId: ' + sourceId + ', reciprocal relationships: ', existingIds);

  while(shouldGenerateNewId(ids.length + existingIds.length, probability)) {
    ids.push(generateNewId(sourceId, existingIds, ids, USER_COUNT));
  }

  // console.log('Creating new relationships for ' + sourceId, ids);

  return ids;
}

function shouldGenerateNewId(idCount, probability) {
  if (idCount === 0) {
    return isHappens(probability.ltOne());
  }

  if (idCount < 3) {
    return isHappens(probability.ltThree());
  }

  return isHappens(probability.gteThree(idCount));
}

// recursively tries until it gets an unused id.
// there is no guard against this running out of ids, but...
function generateNewId(sourceId, oldIds, newIds, maxVal) {
  const newId = generateRandomInt(0, maxVal);

  if (newId !== sourceId &&
      oldIds.indexOf(newId) === -1 &&
      newIds.indexOf(newId) === -1) {

    return newId;
  }

  // id already is related, try again.
  return generateNewId(sourceId, oldIds, newIds, maxVal);
}

// [min, max)
function generateRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function createRelationship(sourceId, targetId, relationship) {
  const query =
    `MATCH (a:Person), (b:Person)
     WHERE a.id = ${sourceId} AND b.id = ${targetId}
     CREATE (a)-[r:${relationship}]->(b)`;

  return cq.query(query).then(() => targetId);
}

function assignOpinions(topicId, finalTopicId) {
  const
    opinionCount = Math.ceil(USER_COUNT/(NODES_PER_OPINION + faker.random.number(200))),
    userIds = [];

  if (topicId > finalTopicId) {
    return null;
  }

  // find some users who can have an opinion
  for (let i = 0; i < opinionCount; i++) {
    userIds.push(generateNewId(-1, userIds, [], USER_COUNT));
  }

  return createTopic(topicId)
    .then(() =>
      userIds
        .map(userId => {
          return {
            userId,
            opinionId: idGenerator.nextOpinionId(),
            topicId: topicId
          };
        })
        .map(createOpinion))
    .then(() => assignOpinions(topicId + 1, finalTopicId));
}

function createTopic(topicId) {
  const
    title = faker.lorem.words(faker.random.number(6) + 3).join(' '),
    query = `CREATE (t:Topic {id:${topicId}, text:"${title}"})`;

  return cq.query(query);
}

function createOpinion({userId, opinionId, topicId}) {
  const
    paragraphs = forcem('e' + generateRandomInt(4, 7), generateRandomInt(1, 6)),
    text = paragraphs.join('\n\n'),
    query =
      `MATCH (a:Person), (t:Topic)
       WHERE a.id=${userId} AND t.id=${topicId}
       CREATE (o:Opinion {id:${opinionId}, text:"${text}"}),
              (a)-[:OPINES]->(o)-[:ADDRESSES]->(t)`;

  // console.log('user: ' + userId + ', opinion: ' + opinionId);

  return cq.query(query).then(() => opinionId);
}

function isHappens(probability) {
  return Math.random() > (1 - probability);
}

function logCreation(id, label) {
  if ((id + 1) % 100 === 0) {
    log.info(`finished creating ${id+1} ${label}`);
  }
}
