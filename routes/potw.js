const express = require('express');
const db = require('../db');
const { requireLogin, requireOfficer } = require('../middleware/auth');
const { notifyMembers, siteUrl } = require('../notify');

module.exports = function () {
  const router = express.Router();

  const isOfficer = (u) => u && (u.role === 'officer' || u.role === 'admin');

  // List problems (active first), with the member's own submission/grade status.
  router.get('/', requireLogin, (req, res) => {
    const problems = db
      .prepare(
        `SELECT p.*, u.name AS author_name,
           (SELECT COUNT(*) FROM submissions s WHERE s.problem_id = p.id) AS submission_count
         FROM problems p LEFT JOIN users u ON u.id = p.created_by
         ORDER BY p.active DESC, p.created_at DESC`
      )
      .all();
    const mine = {};
    db.prepare('SELECT problem_id, awarded_points FROM submissions WHERE user_id = ?')
      .all(req.session.user.id)
      .forEach((s) => (mine[s.problem_id] = s));
    res.render('potw', { problems, mine });
  });

  // Points leaderboard.
  router.get('/leaderboard', requireLogin, (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.name, SUM(s.awarded_points) AS points, COUNT(s.awarded_points) AS solved
         FROM submissions s JOIN users u ON u.id = s.user_id
         WHERE s.awarded_points IS NOT NULL
         GROUP BY s.user_id
         HAVING points > 0
         ORDER BY points DESC, u.name ASC`
      )
      .all();
    res.render('potw-leaderboard', { rows });
  });

  router.get('/new', requireLogin, requireOfficer, (req, res) => {
    res.render('potw-form', { error: null, problem: {} });
  });

  router.post('/new', requireLogin, requireOfficer, (req, res) => {
    const { title, body, points } = req.body;
    if (!title || !body) {
      return res.render('potw-form', { error: 'Title and problem statement are required.', problem: req.body });
    }
    const pts = Math.max(0, parseInt(points, 10) || 10);
    const info = db
      .prepare('INSERT INTO problems (title, body, points, created_by) VALUES (?, ?, ?, ?)')
      .run(title.trim(), body.trim(), pts, req.session.user.id);
    notifyMembers(
      `New Problem of the Week: ${title.trim()}`,
      `A new problem is up (worth ${pts} points):\n\n${title.trim()}\n\n${body.trim()}\n\nSubmit your solution: ${siteUrl('/potw/' + info.lastInsertRowid) || '/potw'}`.trim()
    );
    res.redirect('/potw/' + info.lastInsertRowid);
  });

  router.get('/:id', requireLogin, (req, res) => {
    const problem = db
      .prepare('SELECT p.*, u.name AS author_name FROM problems p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?')
      .get(req.params.id);
    if (!problem) return res.status(404).render('error', { message: 'Problem not found.' });

    const officer = isOfficer(req.session.user);
    const mySubmission = db
      .prepare('SELECT * FROM submissions WHERE problem_id = ? AND user_id = ?')
      .get(problem.id, req.session.user.id);
    let submissions = [];
    if (officer) {
      submissions = db
        .prepare(
          `SELECT s.*, u.name AS author_name FROM submissions s JOIN users u ON u.id = s.user_id
           WHERE s.problem_id = ? ORDER BY s.created_at ASC`
        )
        .all(problem.id);
    }
    const submissionCount = db
      .prepare('SELECT COUNT(*) AS c FROM submissions WHERE problem_id = ?')
      .get(problem.id).c;

    res.render('potw-detail', { problem, officer, mySubmission, submissions, submissionCount });
  });

  // Member submits or updates their solution (only while the problem is active).
  router.post('/:id/submit', requireLogin, (req, res) => {
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
    if (!problem) return res.status(404).render('error', { message: 'Problem not found.' });
    if (!problem.active) {
      return res.status(400).render('error', { message: 'This problem is closed for submissions.' });
    }
    const { body } = req.body;
    if (body && body.trim()) {
      db.prepare(
        `INSERT INTO submissions (problem_id, user_id, body) VALUES (?, ?, ?)
         ON CONFLICT(problem_id, user_id) DO UPDATE SET body = excluded.body,
           awarded_points = NULL, feedback = NULL, graded_by = NULL`
      ).run(problem.id, req.session.user.id, body.trim());
    }
    res.redirect('/potw/' + problem.id);
  });

  // Officer grades a submission.
  router.post('/:id/submissions/:sid/grade', requireLogin, requireOfficer, (req, res) => {
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
    if (!problem) return res.status(404).render('error', { message: 'Problem not found.' });
    const points = Math.max(0, parseInt(req.body.points, 10) || 0);
    const feedback = (req.body.feedback || '').trim();
    db.prepare(
      'UPDATE submissions SET awarded_points = ?, feedback = ?, graded_by = ? WHERE id = ? AND problem_id = ?'
    ).run(points, feedback, req.session.user.id, req.params.sid, problem.id);
    res.redirect('/potw/' + problem.id);
  });

  // Officer opens/closes submissions.
  router.post('/:id/toggle', requireLogin, requireOfficer, (req, res) => {
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
    if (!problem) return res.status(404).render('error', { message: 'Problem not found.' });
    db.prepare('UPDATE problems SET active = ? WHERE id = ?').run(problem.active ? 0 : 1, problem.id);
    res.redirect('/potw/' + problem.id);
  });

  router.post('/:id/delete', requireLogin, requireOfficer, (req, res) => {
    db.prepare('DELETE FROM problems WHERE id = ?').run(req.params.id);
    res.redirect('/potw');
  });

  return router;
};
