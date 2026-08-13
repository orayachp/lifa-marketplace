const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// Verifies the "Authorization: Bearer <token>" header, attaches req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, displayName }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Use after requireAuth: requireRole("seller") or requireRole("admin", "seller")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed for your account type" });
    }
    next();
  };
}

// Like requireAuth, but never rejects — attaches req.user if a valid token
// is present, otherwise leaves it undefined. Use for routes guests can view
// but that behave differently when logged in (e.g. coupon "collected" status).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // ignore invalid/expired token for optional routes
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
