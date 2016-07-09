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
    `,

  answer : {

    create :
      `INSERT INTO answer(topic_id, opinion_id, user_id, question_id, pick_one, assess)
       VALUES($<topicId>, $<opinionId>, $<userId>, $<questionId>, $<pickOne>, $<assess>)
       returning id`,

    update :
      `UPDATE answer
       SET pick_one = $<pickOne>, assess = $<assess>
       WHERE answer.id = $<answerId>`,

    remove :
      `DELETE FROM answer
       WHERE answer.id = $<answerId>`,

    byUser:
      `SELECT * FROM answer
        WHERE answer.topic_id = $<topicId>
        AND answer.opinion_id = $<opinionId>
        AND answer.user_id = $<userId>
      `
  }
};
