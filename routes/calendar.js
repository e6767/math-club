const express = require('express');
const db = require('../db');

module.exports = function () {
  const router = express.Router();

  // Public monthly calendar of events. /calendar?year=YYYY&month=MM (month 1-12)
  router.get('/', (req, res) => {
    const now = new Date();
    let year = parseInt(req.query.year, 10);
    let month = parseInt(req.query.month, 10); // 1-12
    if (!Number.isInteger(year)) year = now.getFullYear();
    if (!Number.isInteger(month) || month < 1 || month > 12) month = now.getMonth() + 1;

    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const events = db
      .prepare(
        "SELECT id, title, event_date, location FROM events WHERE strftime('%Y-%m', event_date) = ? ORDER BY event_date"
      )
      .all(ym);

    // Group events by day-of-month (read the day straight from the stored string).
    const byDay = {};
    events.forEach((e) => {
      const day = parseInt(String(e.event_date).slice(8, 10), 10);
      (byDay[day] = byDay[day] || []).push(e);
    });

    // Build the weeks grid (leading/trailing blanks are null).
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = [];
    let week = new Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const todayDay =
      year === now.getFullYear() && month === now.getMonth() + 1 ? now.getDate() : null;

    res.render('calendar', {
      weeks,
      byDay,
      monthLabel,
      prev,
      next,
      todayDay,
      eventCount: events.length,
    });
  });

  return router;
};
