const express = require('express');
const db = require('../db');
const { requireLogin, requireOfficer } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  router.get('/', (req, res) => {
    const announcements = db
      .prepare(
        `SELECT a.*, u.name as author_name FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC`
      )
      .all();
    res.render('announcements', { announcements });
  });

  router.get('/new', requireLogin, requireOfficer, (req, res) => {
    res.render('announcement-form', { error: null, announcement: {}, mode: 'create' });
  });

  router.post('/new', requireLogin, requireOfficer, (req, res) => {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.render('announcement-form', { error: 'Title and body are required.', announcement: req.body, mode: 'create' });
    }
    db.prepare('INSERT INTO announcements (title, body, created_by) VALUES (?, ?, ?)').run(
      title.trim(),
      body.trim(),
      req.session.user.id
    );
    res.redirect('/announcements');
  });

  router.post('/:id/delete', requireLogin, requireOfficer, (req, res) => {
    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
    res.redirect('/announcements');
  });

  return router;
};
