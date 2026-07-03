function attachUser(db) {
  return (req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.clubName = process.env.CLUB_NAME || 'Math Club';
    next();
  };
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireOfficer(req, res, next) {
  const user = req.session.user;
  if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
    return res.status(403).render('error', { message: 'You do not have permission to view this page.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = req.session.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).render('error', { message: 'You do not have permission to view this page.' });
  }
  next();
}

module.exports = { attachUser, requireLogin, requireOfficer, requireAdmin };
