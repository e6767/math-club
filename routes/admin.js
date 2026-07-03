const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  const allUsers = () =>
    db.prepare('SELECT id, name, email, grade, role, created_at FROM users ORDER BY name').all();

  router.get('/roster', requireLogin, requireAdmin, (req, res) => {
    res.render('admin/roster', { users: allUsers(), error: null, notice: null });
  });

  // Admin sets a new password for a member (for locked-out members; no email needed).
  router.post('/roster/:id/password', requireLogin, requireAdmin, (req, res) => {
    const { password } = req.body;
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).render('error', { message: 'Member not found.' });
    if (!password || password.length < 8) {
      return res.status(400).render('admin/roster', {
        users: allUsers(),
        error: 'New password must be at least 8 characters.',
        notice: null,
      });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.render('admin/roster', {
      users: allUsers(),
      error: null,
      notice: `Password updated for ${user.name}.`,
    });
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
