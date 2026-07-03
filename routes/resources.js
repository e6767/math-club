const express = require('express');
const db = require('../db');
const { requireLogin, requireOfficer } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  router.get('/', requireLogin, (req, res) => {
    const resources = db.prepare('SELECT * FROM resources ORDER BY category, created_at DESC').all();
    const byCategory = {};
    resources.forEach((r) => {
      byCategory[r.category] = byCategory[r.category] || [];
      byCategory[r.category].push(r);
    });
    res.render('resources', { byCategory });
  });

  router.get('/new', requireLogin, requireOfficer, (req, res) => {
    res.render('resource-form', { error: null, resource: {}, mode: 'create' });
  });

  router.post('/new', requireLogin, requireOfficer, (req, res) => {
    const { title, description, url, category } = req.body;
    if (!title || !url) {
      return res.render('resource-form', { error: 'Title and URL are required.', resource: req.body, mode: 'create' });
    }
    db.prepare('INSERT INTO resources (title, description, url, category, uploaded_by) VALUES (?, ?, ?, ?, ?)').run(
      title.trim(),
      description || '',
      url.trim(),
      category || 'General',
      req.session.user.id
    );
    res.redirect('/resources');
  });

  router.post('/:id/delete', requireLogin, requireOfficer, (req, res) => {
    db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
    res.redirect('/resources');
  });

  return router;
};
