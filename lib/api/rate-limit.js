/**
 * Rate Limit Middleware — 10 req/s per IP (reuses guardrails.rateLimit)
 */

const guardrails = require("../core/guardrails");

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  try {
    guardrails.rateLimit(`api:${ip}`, 10); // 10 per second (60/min = 10/s avg, use 60/min window)
  } catch (err) {
    if (err.message.includes("Rate limit")) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded — slow down" } });
    }
    throw err;
  }
  next();
}

module.exports = { rateLimitMiddleware };
