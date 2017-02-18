const connectionString = 'postgres://trusto:@localhost/trusto';
const logger = require('../../logger');
const db = require('pg-promise')()(connectionString);

// Topic 0
const hillaryVDonald = {
  topic_id: 0,
  prompt: 'Do over?',
  prompt_short: 'Do over?',
  options: [
    {
      sortOrder: 0,
      description: 'Hillary'
    },
    {
      sortOrder: 1,
      description: 'Donald'
    }
  ]
};

const electoralCollege = {
  topic_id: 0,
  prompt: 'Electoral College?',
  prompt_short: 'Electoral College?',
  options: [
    {
      sortOrder: 0,
      description: 'No. Go popular'
    },
    {
      sortOrder: 1,
      description: 'Yes. Founders had it right'
    }
  ]
};

// Topic 1
const tmt = {
  topic_id: 1,
  prompt: 'Build it?',
  prompt_short: 'Build it?',
  options: [
    {
      sortOrder: 0,
      description: 'Yes'
    },
    {
      sortOrder: 1,
      description: 'No'
    }
  ]
};

// Topic 2
const rail = {
  topic_id: 2,
  prompt: 'Tax extension?',
  prompt_short: 'Tax extension?',
  options: [
    {
      sortOrder: 0,
      description: 'Yes'
    },
    {
      sortOrder: 1,
      description: 'No'
    }
  ]
};

// Topic 3
// TODO...

// populate the db...
const questions = [
  hillaryVDonald,
  electoralCollege,
  tmt,
  rail
];

const insertQuestionStatement =
  `insert into question(topic_id, prompt, prompt_short)
   values($<topic_id>, $<prompt>, $<prompt_short>)
   returning id`;

const insertOptionStatement =
  'insert into option(description, sort_order, question_id) values($1, $2, $3) returning id';

Promise.all(
  questions.map(question =>
    db.one(insertQuestionStatement, question)
      .then(data => data.id)
      .then(questionId =>
        db.task(t =>
          t.batch(
            question.options.map(({ sortOrder, description }) =>
              t.one(insertOptionStatement, [description, sortOrder, questionId])))))
      .then(data => logger.info(data))))
  .then(() => {
    logger.info('Finished loading questions');
    process.exit(0);
  })
  .catch(err => {
    logger.error('Error loading questions', err);
    process.exit(1);
  });
