const nodemailer = require('nodemailer');

// Email is optional: the app runs fine without it. Sending is only enabled
// when SMTP settings are present in the environment (see .env.example).
function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransport() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // usually false for port 587 (STARTTLS)
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

// Send the same message to each recipient individually (one email per member,
// so addresses aren't exposed to each other and we get per-recipient results).
async function sendToMembers(recipients, subject, message) {
  const t = getTransport();
  if (!t) throw new Error('Email delivery is not configured.');
  const from = fromAddress();
  const result = { sent: 0, failed: 0, errors: [] };
  for (const to of recipients) {
    try {
      await t.sendMail({ from, to, subject, text: message });
      result.sent++;
    } catch (err) {
      result.failed++;
      result.errors.push({ to, message: err.message });
    }
  }
  return result;
}

module.exports = { isConfigured, sendToMembers, fromAddress };
