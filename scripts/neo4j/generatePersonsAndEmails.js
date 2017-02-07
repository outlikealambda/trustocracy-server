const fs = require('fs');

const generateName = require('node-random-name');

const nodeCount = parseInt(process.argv[2], 10);
const pathToPersonsCsv = process.argv[3] || 'persons.csv';
const pathToEmailsCsv = process.argv[4] || 'emails.csv';
const pathToHasEmailsCsv = process.argv[5] || 'hasEmail.csv';

console.log(nodeCount);

const personsCsv = fs.createWriteStream(pathToPersonsCsv);
const emailsCsv = fs.createWriteStream(pathToEmailsCsv);
const hasEmailsCsv = fs.createWriteStream(pathToHasEmailsCsv);

personsCsv.write('id:ID(Person),name\n');
emailsCsv.write('id:ID(Email),email \n');
hasEmailsCsv.write(':START_ID(Person),:END_ID(Email)');

Array(nodeCount)
  .fill(1)
  .map(() => Object.assign({name: generateName({ random: Math.random })}))
  .forEach((person, index) => {
    const email = person.name.replace(' ', '.').toLowerCase() + '@gmail.com';
    personsCsv.write(`${index},${person.name}\n`);
    emailsCsv.write(`${index},${email}\n`);
    hasEmailsCsv.write(`${index},${index}\n`);
  });

personsCsv.end();
emailsCsv.end();
hasEmailsCsv.end();
