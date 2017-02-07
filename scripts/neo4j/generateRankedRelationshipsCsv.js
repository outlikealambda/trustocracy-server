const fs = require('fs');

const nodeCount = process.argv[2];
const pathToFile = process.argv[3];
const matrix = initializeMatrix(nodeCount, false);

function initializeMatrix (sideLength, initialValue) {
  const m = [];

  for (let i = 0; i < sideLength; i++) {
    let fullRow = [];

    for (let j = 0; j < sideLength; j++) {
      fullRow.push(initialValue);
    }

    m.push(fullRow);
  }

  return m;
}

const relationships = (function () {
  return {
    add,
    incoming,
    outgoing,
    print,
    printAverage,
    writeToCsv
  };

  // exposed
  function add (source, target, m) {
    m[source][target] = true;

    return m;
  }

  function outgoing (source, m) {
    return m[source].reduce(trueOnly, []);
  }

  function incoming (target, m) {
    return m.map(row => row[target]).reduce(trueOnly, []);
  }

  function print (m) {
    m.forEach(row => {
      let count = countInRow(row);
      console.log(row.map(isConnected => isConnected ? 1 : 0).join(' ') + ' ' + count);
    });
  }

  function printAverage (m) {
    let totalCount = m.reduce((agg, row) => agg + countInRow(row), 0);
    console.log(totalCount);
    console.log(totalCount / m.length);
    console.log(totalCount / (m.length * m.length));
  }

  function writeToCsv (path, m) {
    const writable = fs.createWriteStream(path);

    m.map(row => row.reduce(trueOnly, []))
      .map(shuffleArray) // shuffle to randomize the rank
      .forEach((row, rowIdx) => {
        row.forEach((colIdx, rank) => writable.write(`${rowIdx}, ${rank}, ${colIdx}\n`));
      });

    writable.end();
  }

  // HELPERS

  // From http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  function shuffleArray (array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  function trueOnly (rels, isConnected, col) {
    return isConnected ? rels.concat(col) : rels;
  }

  function countInRow (row) {
    return row.reduce((agg, isConnected) => agg + (isConnected ? 1 : 0), 0);
  }
}());

const probability = (function () {
  // 1, 0.92, 0.92 give an average of 6 outgoing relationships per node
  const ltOne = 1;
  const ltThree = 0.92;
  const gteThree = 0.92;

  const reciprocity = 0.3;

  return {
    shouldAddRelationship,

    chooseReciprocal: incoming => pickSome(reciprocity, incoming)
  };

  function shouldAddRelationship (numExisting) {
    if (numExisting < 1) {
      return happens(ltOne);
    }

    if (numExisting < 3) {
      return happens(ltThree);
    }

    if (numExisting >= 3) {
      return happens(Math.pow(gteThree, numExisting - 2));
    }
  }

  function happens (withProbability) {
    return Math.random() > (1 - withProbability);
  }

  function pickSome (withProbability, original) {
    return original.reduce((aggregator, id) => happens(withProbability) ? aggregator.concat(id) : aggregator, []);
  }
}());

const idPicker = (function (exclusiveMax) {
  return {
    any,
    excluding
  };

  function any () {
    return Math.floor(Math.random() * (exclusiveMax));
  }

  function excluding (excluded) {
    var id;

    do {
      id = any();
    } while (excluded.includes(id));

    return id;
  }
}(nodeCount));

for (let source = 0; source < nodeCount; source++) {
  // get incoming
  let incoming = relationships.incoming(source, matrix);

  // make reciprocal
  let outgoing = probability.chooseReciprocal(incoming, matrix);

  // add outgoing
  while (probability.shouldAddRelationship(outgoing.length)) {
    let target = idPicker.excluding(outgoing);

    outgoing.push(target);
  }

  // update matrix
  outgoing.forEach(target => relationships.add(source, target, matrix));
}

relationships.writeToCsv(pathToFile, matrix);

/*
 * Once we have the starting graph:
 *
 * 1. Randomly pick some nodes to be authors
 * 2. Add those authors in using unwind + walk
 * 3. Save the connected relationships (should be < NODE_COUNT)
 * 4. Delete the opinions + connected
 * 5. Re-insert those opinions using new algorithm
 * 6. Compare connected relationships to saved version
 *
 */
