const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

module.exports = function () {
  const router = express.Router();

  router.get('/register', (req, res) => {
    res.render('register', { error: null, form: {} });
  });

  router.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword, grade } = req.body;
    const domain = (process.env.SCHOOL_EMAIL_DOMAIN || '').trim();

    if (!name || !email || !password) {
      return res.render('register', { error: 'All fields are required.', form: req.body });
    }
    if (password.length < 8) {
      return res.render('register', { error: 'Password must be at least 8 characters.', form: req.body });
    }
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match.', form: req.body });
    }
    if (domain && !email.toLowerCase().endsWith('@' + domain.toLowerCase())) {
      return res.render('register', { error: `Please use your school email ending in @${domain}.`, form: req.body });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.render('register', { error: 'An account with that email already exists.', form: req.body });
    }

    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const role = userCount === 0 ? 'admin' : 'member'; // first registered user becomes admin

    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, grade, role) VALUES (?, ?, ?, ?, ?)')
      .run(name.trim(), email.toLowerCase().trim(), hash, grade || null, role);

    req.session.user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), role };
    res.redirect('/dashboard');
  });

  router.get('/login', (req, res) => {
    res.render('login', { error: null, email: '' });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
    if (!user) {
      return res.render('login', { error: 'Invalid email or password.', email });
    }
    const valid = await bcrypt.compare(password || '', user.password_hash);
    if (!valid) {
      return res.render('login', { error: 'Invalid email or password.', email });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    const dest = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(dest);
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  return router;
};
