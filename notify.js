const db = require('./db');
const mailer = require('./mailer');

// Best-effort broadcast to every member. No-op when email isn't configured,
// and never throws into the request path (fire-and-forget).
function notifyMembers(subject, text) {
  if (!mailer.isConfigured()) return;
  const emails = db
    .prepare('SELECT email FROM users')
    .all()
    .map((u) => u.email)
    .filter(Boolean);
  if (!emails.length) return;
  mailer.sendToMembers(emails, subject, text).catch((err) => {
    console.error('notifyMembers failed:', err.message);
  });
}

function siteUrl(path) {
  const base = (process.env.SITE_URL || '').replace(/\/$/, '');
  return base ? base + path : '';
}

module.exports = { notifyMembers, siteUrl };
