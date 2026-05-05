/**
 * Rate Limit Middleware — 10 req/s per IP (reuses guardrails.rateLimit)
 */

const guardrails = require("../core/guardrails");

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  try {
    guardrails.rateLimit(`api:${ip}`, 600); // 10 per second × 60 = 600 per minute window
  } catch (err) {
    if (err.message.includes("Rate limit")) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded — slow down" } });
    }
    throw err;
  }
  next();
}

module.exports = { rateLimitMiddleware };
