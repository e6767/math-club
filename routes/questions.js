const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  const isOfficer = (u) => u && (u.role === 'officer' || u.role === 'admin');
  const canManage = (u, q) => u && (u.id === q.asked_by || isOfficer(u));

  // List all questions (members only).
  router.get('/', requireLogin, (req, res) => {
    const questions = db
      .prepare(
        `SELECT q.*, u.name AS asker_name,
           (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answer_count
         FROM questions q LEFT JOIN users u ON u.id = q.asked_by
         ORDER BY q.solved ASC, q.created_at DESC`
      )
      .all();
    res.render('questions', { questions });
  });

  router.get('/new', requireLogin, (req, res) => {
    res.render('question-form', { error: null, question: {} });
  });

  router.post('/new', requireLogin, (req, res) => {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.render('question-form', {
        error: 'Title and details are both required.',
        question: req.body,
      });
    }
    const info = db
      .prepare('INSERT INTO questions (title, body, asked_by) VALUES (?, ?, ?)')
      .run(title.trim(), body.trim(), req.session.user.id);
    res.redirect('/questions/' + info.lastInsertRowid);
  });

  router.get('/:id', requireLogin, (req, res) => {
    const question = db
      .prepare(
        'SELECT q.*, u.name AS asker_name FROM questions q LEFT JOIN users u ON u.id = q.asked_by WHERE q.id = ?'
      )
      .get(req.params.id);
    if (!question) return res.status(404).render('error', { message: 'Question not found.' });

    const answers = db
      .prepare(
        `SELECT a.*, u.name AS author_name
         FROM answers a LEFT JOIN users u ON u.id = a.answered_by
         WHERE a.question_id = ?
         ORDER BY (a.id = ?) DESC, a.created_at ASC`
      )
      .all(question.id, question.accepted_answer_id || 0);

    res.render('question-detail', {
      question,
      answers,
      canManage: canManage(req.session.user, question),
    });
  });

  router.post('/:id/answers', requireLogin, (req, res) => {
    const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
    if (!question) return res.status(404).render('error', { message: 'Question not found.' });
    const { body } = req.body;
    if (body && body.trim()) {
      db.prepare('INSERT INTO answers (question_id, body, answered_by) VALUES (?, ?, ?)').run(
        question.id,
        body.trim(),
        req.session.user.id
      );
    }
    res.redirect('/questions/' + question.id);
  });

  router.post('/:id/answers/:answerId/accept', requireLogin, (req, res) => {
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) return res.status(404).render('error', { message: 'Question not found.' });
    if (!canManage(req.session.user, question)) {
      return res
        .status(403)
        .render('error', { message: 'Only the person who asked (or an officer) can accept an answer.' });
    }
    const answer = db
      .prepare('SELECT id FROM answers WHERE id = ? AND question_id = ?')
      .get(req.params.answerId, question.id);
    if (answer) {
      db.prepare('UPDATE questions SET accepted_answer_id = ?, solved = 1 WHERE id = ?').run(
        answer.id,
        question.id
      );
    }
    res.redirect('/questions/' + question.id);
  });

  router.post('/:id/reopen', requireLogin, (req, res) => {
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) return res.status(404).render('error', { message: 'Question not found.' });
    if (!canManage(req.session.user, question)) {
      return res.status(403).render('error', { message: 'Not allowed.' });
    }
    db.prepare('UPDATE questions SET accepted_answer_id = NULL, solved = 0 WHERE id = ?').run(question.id);
    res.redirect('/questions/' + question.id);
  });

  router.post('/:id/delete', requireLogin, (req, res) => {
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) return res.status(404).render('error', { message: 'Question not found.' });
    if (!canManage(req.session.user, question)) {
      return res.status(403).render('error', { message: 'Not allowed.' });
    }
    db.prepare('DELETE FROM questions WHERE id = ?').run(question.id);
    res.redirect('/questions');
  });

  return router;
};
