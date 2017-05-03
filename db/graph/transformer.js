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

function extractAllRows (mapFn = (row => row), defaultResult = []) {
  return neoData => {
    const [{data}] = neoData.results;

    return noResults(neoData) ? defaultResult : data.map(datum => mapFn(datum.row));
  };
}

/**
 * returns the result of mapFn applied to the first element of the results
 */
function extractFirstRow (mapFn, defaultResult = {}) {
  return neoData => extractAllRows(mapFn, defaultResult)(neoData)[0];
}

// pulls out the first item from the first row of results
function extractFirstResult (neoData) {
  return extractFirstRow(row => row[0], {})(neoData);
}

// null checks a couple of places in the results data
// see @extractAllData for the neo4j data structure
function noResults (neoData) {
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

const extractor = {
  fullUser (row) {
    const [user, emails] = row;

    return {
      name: user.name,
      id: user.id,
      emails: emails
    };
  },

  user (row) {
    const [user] = row;

    return {
      name: user.name,
      id: user.id
    };
  },

  userLocation (row) {
    const [location, country, city, postal] = row;

    return {
      id: location.id,
      name: location.name,
      country: country.name,
      city: city.name,
      postal: postal.name
    };
  },

  // Record specific extractions
  userOpinion (row) {
    const [opinion, author, topic] = row;
    return { author, opinion, topic };
  },

  topic (row) {
    const [topic, opinionCount, lastUpdated] = row;
    topic.created = new Date(topic.created);
    return Object.assign(
      {},
      topic,
      {
        opinionCount,
        lastUpdated: new Date(lastUpdated)
      }
    );
  }
};

module.exports = {
  user: extractFirstResult,

  trustee: extractFirstRow(extractor.user),

  userInfo: extractFirstRow(row => {
    const [user, emails, neighbors] = row;
    const trustees =
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
      emails: emails
    };
  }),

  basicUser: extractFirstRow(extractor.user),

  userInfoWithLocation: extractFirstRow(extractor.fullUser),

  emails: extractAllRows(row => row[0].email),

  location: extractAllRows(extractor.userLocation),

  authoredOpinion: extractFirstResult,

  opinion: extractFirstRow(extractor.userOpinion),

  opinionsByIds: extractAllRows(extractor.userOpinion),

  opinionsByTopic: extractAllRows(extractor.userOpinion),

  topic: extractFirstRow(extractor.topic),

  topics: extractAllRows(extractor.topic),

  connected: extractAllRows(row => {
    let [friend, author, opinion] = row;
    if (!Object.keys(opinion).length) {
      opinion = null;
    } else {
      opinion.created = new Date(opinion.created);
    }
    if (!Object.keys(author).length) {
      author = null;
    }
    return { friend, author, opinion };
  }),

  friends: extractAllRows(([friend]) => friend),

  friendsAuthors: extractAllRows(([friend, author]) => ({friend, author})),

  influence: extractFirstRow(([influence]) => ({influence}))
};
