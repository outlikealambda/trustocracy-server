'use strict';

const
  generateName = require('sillyname'),
  cq = require('./cypher-query'),
  faker = require('faker'),
  log = require('./logger'),
  graphSize = 10000,
  nodesPerOpinion = 400,
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

// recursively creates users, as neo doesn't like creating 10000 in a single
// statement -- MUCH slower though.  let's try batching 500 per call
function createUser(id, createStatements) {
  if (id >= graphSize) {
    return createStatements.length ? finishCreateQuery(createStatements) : null;
  }

  logCreation(id, 'users');

  const
    name = generateName(),
    query = `(:Person {name: '${name}', id: ${id}})`;

  createStatements.push(query);

  if (id % 500 === 0) {
    return finishCreateQuery(createStatements).then(() => createUser(id + 1, []));
  } else {
    return createUser(id + 1, createStatements);
  }
}

function finishCreateQuery(createStatements) {
  return cq.query('CREATE ' + createStatements.join());
}

createUser(0, [])
  .then(() => buildRelationships(0, 'TRUSTS_EXPLICITLY', explicitProbability))
  .then(() => buildRelationships(0, 'TRUSTS', regularProbability))
  .then(assignOpinions)
  .catch(error => {
    log.info(error);
  });

// recursive call
function buildRelationships(id, relationship, probs) {
  if (id >= graphSize) {
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
    ids.push(generateNewId(sourceId, existingIds, ids, graphSize));
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

function assignOpinions() {
  const
    opinionCount = Math.ceil(graphSize/nodesPerOpinion),
    opinionIds = [];

  for (let i=0; i < opinionCount; i++) {
    opinionIds.push(generateNewId(-1, opinionIds, [], graphSize));
  }

  return createTopic().then(() => opinionIds.map(createOpinion));
}

function createTopic() {
  const query =
    `CREATE (t:Topic {id:0, text: "The Biggest Thing"})`;

  return cq.query(query).then(() => 0);
}

function createOpinion(userId, opinionId) {
  const
    text = faker.lorem.paragraphs(generateRandomInt(1, 5)),
    query =
      `MATCH (a:Person), (t:Topic) WHERE a.id=${userId} AND t.id=0
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
