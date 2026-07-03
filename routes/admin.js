const express = require('express');
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  router.get('/roster', requireLogin, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, name, email, grade, role, created_at FROM users ORDER BY name').all();
    res.render('admin/roster', { users });
  });

  router.post('/roster/:id/role', requireLogin, requireAdmin, (req, res) => {
    const { role } = req.body;
    if (!['member', 'officer', 'admin'].includes(role)) {
      return res.status(400).render('error', { message: 'Invalid role.' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.redirect('/admin/roster');
  });

  router.post('/roster/:id/delete', requireLogin, requireAdmin, (req, res) => {
    if (parseInt(req.params.id, 10) === req.session.user.id) {
      return res.status(400).render('error', { message: 'You cannot remove your own account.' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.redirect('/admin/roster');
  });

  return router;
};
