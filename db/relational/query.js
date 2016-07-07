module.exports = {
  questions:
    `SELECT question.* FROM question
      JOIN topic_question
      ON question.id = topic_question.question_id
      WHERE topic_question.topic_id = $<topicId>
    `,
  pickOneQuestions:
    `SELECT question.* FROM question
      JOIN topic_question
      ON question.id = topic_question.question_id
      WHERE topic_question.topic_id = $<topicId>
      AND question.type = 'PICK_ONE'
    `
};