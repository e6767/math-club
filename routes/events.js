const express = require('express');
const db = require('../db');
const { requireLogin, requireOfficer } = require('../middleware/auth');

module.exports = function () {
  const router = express.Router();

  // Public list
  router.get('/', (req, res) => {
    const events = db
      .prepare("SELECT * FROM events WHERE date(event_date) >= date('now', '-1 day') ORDER BY event_date ASC")
      .all();
    const past = db
      .prepare("SELECT * FROM events WHERE date(event_date) < date('now', '-1 day') ORDER BY event_date DESC LIMIT 10")
      .all();

    let rsvpMap = {};
    if (req.session.user) {
      const rows = db.prepare('SELECT event_id, status FROM rsvps WHERE user_id = ?').all(req.session.user.id);
      rows.forEach((r) => (rsvpMap[r.event_id] = r.status));
    }

    res.render('events', { events, past, rsvpMap });
  });

  router.get('/new', requireLogin, requireOfficer, (req, res) => {
    res.render('event-form', { error: null, event: {}, mode: 'create' });
  });

  router.post('/new', requireLogin, requireOfficer, (req, res) => {
    const { title, description, event_date, location } = req.body;
    if (!title || !event_date) {
      return res.render('event-form', { error: 'Title and date are required.', event: req.body, mode: 'create' });
    }
    db.prepare('INSERT INTO events (title, description, event_date, location, created_by) VALUES (?, ?, ?, ?, ?)').run(
      title.trim(),
      description || '',
      event_date,
      location || '',
      req.session.user.id
    );
    res.redirect('/events');
  });

  router.get('/:id/edit', requireLogin, requireOfficer, (req, res) => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).render('error', { message: 'Event not found.' });
    res.render('event-form', { error: null, event, mode: 'edit' });
  });

  router.post('/:id/edit', requireLogin, requireOfficer, (req, res) => {
    const { title, description, event_date, location } = req.body;
    db.prepare('UPDATE events SET title=?, description=?, event_date=?, location=? WHERE id=?').run(
      title.trim(),
      description || '',
      event_date,
      location || '',
      req.params.id
    );
    res.redirect('/events');
  });

  router.post('/:id/delete', requireLogin, requireOfficer, (req, res) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.redirect('/events');
  });

  router.post('/:id/rsvp', requireLogin, (req, res) => {
    const { status } = req.body; // going | maybe | not_going
    const eventId = req.params.id;
    const userId = req.session.user.id;
    db.prepare(
      `INSERT INTO rsvps (event_id, user_id, status) VALUES (?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`
    ).run(eventId, userId, status);
    res.redirect('/events');
  });

  // Roster of who RSVP'd, for officers
  router.get('/:id/attendees', requireLogin, requireOfficer, (req, res) => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).render('error', { message: 'Event not found.' });
    const attendees = db
      .prepare(
        `SELECT u.name, u.email, r.status FROM rsvps r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? ORDER BY r.status, u.name`
      )
      .all(req.params.id);
    res.render('admin/attendees', { event, attendees });
  });

  return router;
};
