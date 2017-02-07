const fs = require('fs');

const forcem = require('forcem-ipsum');

const nodeCount = parseInt(process.argv[2], 10);
const pathToOpinionsCsv = process.argv[3] || 'opinions.csv';

const opinionsCsv = fs.createWriteStream(pathToOpinionsCsv);

Array(parseInt(nodeCount)).fill(0)
  .forEach((ignored, index) => {
    const text = forcem('e' + generateRandomInt(4, 7), generateRandomInt(1, 6)).join('\n\n');
    const created = generateRandomInt(getTimestampOneYearAgo(), Date.now());

    opinionsCsv.write(`${index},${created},'${text}'\n`);
  });

// [min, max)
function generateRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function getTimestampOneYearAgo () {
  const today = new Date();

  return today.setFullYear(today.getFullYear() - 1);
}
