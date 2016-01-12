var
  rp = require('request-promise'),
  // request = require('request'),
  auth = {
    auth: { username: 'neo4j', password: 'graphdb'}
  };

function getBaseUrl() {
  return 'http://localhost:7474/';
}

function getCypherUrl() {
  return getBaseUrl() + 'db/data/transaction/commit';
}

// function getUser(id) {
//   var url = getBaseUrl() + 'db/data/node/' + id;
//   console.log('getting id: ' + id + ' @' + url);
  // var stream = needle.get(url, options);

  // stream
  //   .on('readable', function() {
  //     console.log('got a readable');
  //
  //     var chunk;
  //
  //     while(chunk = this.read()) {
  //       // console.log(chunk);
  //     }
  //   })
  //   .on('end', function() {
  //     console.log('pau');
  //   });

  // console.log(needle.get(url, options));
  // needle.get('https://google.com/images/logo.png').pipe(process.stdout);

  // var outStream = needle.get(url, options);
  //
  // console.log('isPaused? ', outStream.isPaused());
  //
  // return request(url).auth('neo4j', 'graphdb', true);

  // outStream.pipe(process.stdout);

  // return outStream;

// }

function getUserInfo(id) {
  return queryNeo4j(createUserQuery(id)).then(transformUserData);
}

function getNearestOpinions(userId, topicId) {
  return queryNeo4j(createNearestOpinionsQuery(userId, topicId)).then(transformNearestOpinionsData);
}

function getOpinions(ids) {
  return queryNeo4j(createOpinionsQuery(ids));
}

function queryNeo4j(cypherQuery) {
  var options = Object.assign({
    method:'POST',
    url: getCypherUrl(),
    json: createStatement(cypherQuery)
  }, auth);

  return rp(options);
}

function createUserQuery(id) {
  return `MATCH (u:Person {id:${id}})-[relationship]->(friend)
          RETURN u, type(relationship) as r, friend`;
}

function createNearestOpinionsQuery(userId, topicId) {
  return `MATCH (p:Person)-[]->(f:Person)-[rs:TRUSTS_EXPLICITLY*0..]->(ff:Person)-[:OPINES]->(o:Opinion)-[:SIDES_WITH]->(s:Stance)<-[:ADDRESSED_BY]-(t:Topic)
          WHERE p.id=${userId} AND t.id=${topicId}
          RETURN f, extract(r in rs | type(r)) as extracted, ff, o, s`;
}

function createOpinionsQuery(ids) {
  var idList = ids.join();
  return `MATCH (o:Opinion)
          WHERE o.id IN [${idList}]
          RETURN o`;
}

function createStatement(query) {
  return {
    statements: [
      {
        statement: query
      }
    ]
  };
}

function transformUserData(neoData) {
  // destructuring: node needs to run with --harmony_destructuring flag
  var
    [{data}] = neoData.results,
    [{row: [user]}] = data;

  return {
    user,
    relationships: data.map(datum => {
      var [, rel, friend] = datum.row;

      return {
        rel,
        friend
      };
    })
  };
}

function transformNearestOpinionsData(neoData) {
  var [{data}] = neoData.results;

  return {
    paths: data.map(datum => {
      var [friend, path, opiner, opinion] = datum.row;

      return {
        friend,
        path,
        opiner,
        opinion: opinion.id
      };
    })
  };
}


module.exports = {
  getNearestOpinions,
  getOpinions,
  getUserInfo
};
