const express = require('express');
const db = require('../db');
const { requireLogin, requireOfficer } = require('../middleware/auth');
const mailer = require('../mailer');

module.exports = function () {
  const router = express.Router();

  function members() {
    return db.prepare('SELECT name, email FROM users ORDER BY name').all();
  }

  router.get('/new', requireLogin, requireOfficer, (req, res) => {
    res.render('mail-form', {
      error: null,
      sent: null,
      configured: mailer.isConfigured(),
      recipientCount: members().length,
      form: {},
    });
  });

  router.post('/send', requireLogin, requireOfficer, async (req, res) => {
    const list = members();
    const { subject, message } = req.body;
    const render = (extra) =>
      res.render('mail-form', {
        error: null,
        sent: null,
        configured: mailer.isConfigured(),
        recipientCount: list.length,
        form: req.body,
        ...extra,
      });

    if (!mailer.isConfigured()) {
      return render({ error: 'Email delivery is not configured yet, so nothing was sent.' });
    }
    if (!subject || !message) {
      return render({ error: 'Subject and message are both required.' });
    }
    if (list.length === 0) {
      return render({ error: 'There are no members to email yet.' });
    }

    try {
      const result = await mailer.sendToMembers(
        list.map((m) => m.email),
        subject.trim(),
        message
      );
      return render({ sent: result });
    } catch (err) {
      return render({ error: 'Failed to send: ' + err.message });
    }
  });

  return router;
};
