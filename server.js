require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./db');
const { attachUser, requireLogin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
    },
  })
);

app.use(attachUser(db));

// Routes
app.use('/', require('./routes/auth')());
app.use('/events', require('./routes/events')());
app.use('/calendar', require('./routes/calendar')());
app.use('/resources', require('./routes/resources')());
app.use('/announcements', require('./routes/announcements')());
app.use('/questions', require('./routes/questions')());
app.use('/mail', require('./routes/mail')());
app.use('/admin', require('./routes/admin')());

app.get('/', (req, res) => {
  const upcoming = db
    .prepare("SELECT * FROM events WHERE date(event_date) >= date('now') ORDER BY event_date ASC LIMIT 3")
    .all();
  const latestAnnouncements = db
    .prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 3')
    .all();
  res.render('index', { upcoming, latestAnnouncements });
});

app.get('/dashboard', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const myEvents = db
    .prepare(
      `SELECT e.*, r.status FROM events e JOIN rsvps r ON r.event_id = e.id
       WHERE r.user_id = ? AND date(e.event_date) >= date('now') ORDER BY e.event_date ASC`
    )
    .all(userId);
  const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5').all();
  res.render('dashboard', { myEvents, announcements });
});

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

app.listen(PORT, () => {
  console.log(`Math club app running at http://localhost:${PORT}`);
});
