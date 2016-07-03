const
  connectionString = 'postgres://wr:@localhost/trusto',
  logger = require('../../logger'),
  db = require('pg-promise')()(connectionString);

const
  // hillaryDonald = {
  //   type: 'PICK_ONE',
  //   label: 'SPECIFIC',
  //   options: {
  //     a: 'Hillary',
  //     b: 'Donald'
  //   }
  // },
  balanced = {
    type: 'ASSESS',
    label: 'STANDARD',
    options: {
      a: 'Focused',
      b: 'Balanced'
    }
  },
  leaning = {
    type: 'ASSESS',
    label: 'STANDARD',
    options: {
      a: 'Agree',
      b: 'Disagree'
    }
  },
  standard = [balanced, leaning],
  topics = [0,1,2,3,4,5,6,7,8];


standard.forEach(question => {
  const insertStatement = 'insert into question(type, label, options) values($<type>, $<label>, $<options>) returning id';

  db.one(insertStatement, question)
    .then(data => data.id)
    .then(qid => {
      return db.batch(topics.map(tid => db.one('insert into topic_question(topic_id, question_id) values($1, $2) returning id', [tid, qid])));
    })
    .then(data => logger.info(data));
});
