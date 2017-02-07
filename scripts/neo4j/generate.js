'use strict';

const generateName = require('sillyname');
const faker = require('faker');
const forcem = require('forcem-ipsum');
const idGenerator = require('../db/graph/id-generator');
const cq = require('../db/graph/cypher-query');
const log = require('../logger');
const startingUserId = 0;
const startingTopicId = 0;
const finalTopicId = 0;
const USER_COUNT = 10000;
const NODES_PER_OPINION = 300;
const regularProbability = {
  reciprocity: 0.3,
  ltOne: () => 1,
  ltThree: () => 0.92,
  gteThree: count => Math.pow(0.86, count - 2)
};

createUser(startingUserId, [])
  .then(() => buildRelationships(startingUserId, 'RANKED', regularProbability))
  .then(() => assignOpinions(startingTopicId, finalTopicId))
  .catch(error => {
    log.info(error);
  });

// recursively creates users, as neo doesn't like creating 10000 in a single
// statement -- MUCH slower though.  let's try batching 500 per call
function createUser (id, createStatements) {
  if (id >= USER_COUNT) {
    return createStatements.length ? finishCreateQuery(createStatements) : null;
  }

  logCreation(id, 'users');

  const name = generateName();
  const email = name.replace(' ', '.').toLowerCase() + '@gmail.com';
  const query = `(:Person {name: '${name}', id: ${id}})-[:HAS_EMAIL]->(:Email {email: '${email}'})`;

  createStatements.push(query);

  if (id % 500 === 0) {
    return finishCreateQuery(createStatements)
      .then(() => createUser(id + 1, []));
  } else {
    return createUser(id + 1, createStatements);
  }
}

function finishCreateQuery (createStatements) {
  return cq.query('CREATE ' + createStatements.join());
}

// recursive call
function buildRelationships (id, relationship, probs) {
  if (id >= USER_COUNT) {
    return;
  }

  logCreation(id, `users' ${relationship} relationships`);

  return getRanked(id, relationship)
    .then(trusterIds => getReciprocalTargets(trusterIds, probs))
    .then(reciprocalIds => generateNewIds(id, reciprocalIds, probs))
    .map((newTrusteeId, rank) => createRelationship(id, newTrusteeId, relationship, rank))
    .then(() => buildRelationships(id + 1, relationship, probs));
}

// returns [{id, name}]
function getRanked (id, relationship) {
  const neighborQuery =
    `MATCH (u:Person)<-[r:${relationship}]-(p:Person)
     WHERE u.id=${id}
     RETURN p`;

  return cq.query(neighborQuery).then(processIds);
}

function processIds (neoData) {
  const [{data}] = neoData.results;
  return data.map(datum => datum.row[0].id);
}

function getReciprocalTargets (trusterIds, probability) {
  const reciprocalIds = trusterIds.reduce((acc, trusterId) => {
    if (isHappens(probability.reciprocity)) {
      acc.push(trusterId);
    }

    return acc;
  }, []);

  return reciprocalIds;
}

function generateNewIds (sourceId, existingIds, probability) {
  while (shouldGenerateNewId(existingIds.length, probability)) {
    existingIds.push(generateNewId(sourceId, existingIds, USER_COUNT));
  }

  return existingIds;
}

function shouldGenerateNewId (relationshipCount, probability) {
  if (relationshipCount === 0) {
    return isHappens(probability.ltOne());
  }

  if (relationshipCount < 3) {
    return isHappens(probability.ltThree());
  }

  return isHappens(probability.gteThree(relationshipCount));
}

// recursively tries until it gets an unused id.
// there is no guard against this running out of ids, but...
function generateNewId (sourceId, oldIds, maxVal) {
  const newId = generateRandomInt(0, maxVal);

  if (newId !== sourceId && !oldIds.includes(newId)) {
    return newId;
  }

  // id already is related, try again.
  // log.info('failed with ' + newId);
  return generateNewId(sourceId, oldIds, maxVal);
}

// [min, max)
function generateRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function createRelationship (sourceId, targetId, relationship, rank) {
  const maybeRank = rank || rank === 0 ? `{rank:${rank}}` : '';
  const query =
    `MATCH (a:Person), (b:Person)
     WHERE a.id = ${sourceId} AND b.id = ${targetId}
     CREATE (a)-[r:${relationship}${maybeRank}]->(b)`;

  return cq.query(query).then(() => targetId);
}

function getTimestampOneYearAgo () {
  const today = new Date();

  return today.setFullYear(today.getFullYear() - 1);
}

function assignOpinions (topicId, finalTopicId) {
  const opinionCount = Math.ceil(USER_COUNT / (NODES_PER_OPINION + faker.random.number(USER_COUNT / 20)));
  const userIds = [];

  const topicTimestamp = generateRandomInt(getTimestampOneYearAgo(), Date.now());

  log.info('opinionCount: ' + opinionCount);

  if (topicId > finalTopicId) {
    return null;
  }

  // find some users who can have an opinion
  for (let i = 0; i < opinionCount; i++) {
    userIds.push(generateNewId(-1, userIds, USER_COUNT));
  }

  log.info('users for opinions: ' + userIds);

  return createTopic(topicId, topicTimestamp)
    .then(() => {
      const opinions = userIds
        .map(userId => {
          return {
            userId,
            opinionId: idGenerator.nextOpinionId(),
            topicId: topicId,
            created: generateRandomInt(topicTimestamp, Date.now())
          };
        });

      return oneAtATime(createOpinion, opinions, 0);
    })
    .then(() => assignOpinions(topicId + 1, finalTopicId));
}

function oneAtATime (fnPromise, items, index) {
  if (index >= items.length) {
    return;
  }

  return fnPromise(items[index]).then(() => oneAtATime(fnPromise, items, index + 1));
}

function createTopic (topicId, timestamp) {
  const title = topics[topicId];
  const query =
    `CREATE (t:Topic {id:${topicId}, text:"${title}", created:${timestamp}})`;

  return cq.query(query);
}

const topics = [
  'Hillary vs. Donald',
  'The TMT',
  'Honolulu\'s Rail project',
  'Visitor Drownings',
  'The Zika Virus',
  'The Houseless',
  'Police Accountability',
  'Kakaako Development',
  'Housing Prices'
];

function createOpinion ({userId, opinionId, topicId, created}) {
  const paragraphs = forcem('e' + generateRandomInt(4, 7), generateRandomInt(1, 6));
  const text = paragraphs.join('\n\n');
  const query =
      `MATCH (a:Person), (t:Topic)
       WHERE a.id=${userId} AND t.id=${topicId}
       CREATE (o:Opinion {id:${opinionId}, text:"${text}", created:${created}}),
              (o)-[:ADDRESSES]->(t)`;

  return cq.query(query)
    .then(() => cq.query(`CALL clean.opinion.set(${userId}, ${opinionId}, ${topicId})`))
    .then(() => opinionId);
}

function isHappens (probability) {
  return Math.random() > (1 - probability);
}

function logCreation (id, label) {
  if ((id + 1) % 100 === 0) {
    log.info(`finished creating ${id + 1} ${label}`);
  }
}
