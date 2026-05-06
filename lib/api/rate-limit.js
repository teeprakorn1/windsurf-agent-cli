/**
 * Rate Limit Middleware — 10 req/s per IP (reuses guardrails.rateLimit)
 */

const guardrails = require("../core/guardrails");

function rateLimitMiddleware(req, res, next) {
  // Use req.ip as primary — Express sets this correctly when trust proxy is configured.
  // Only use X-Forwarded-For when AIYU_TRUST_PROXY is explicitly enabled to prevent spoofing.
  let ip;
  if (process.env.AIYU_TRUST_PROXY === "true") {
    ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.connection.remoteAddress || "unknown";
  } else {
    ip = req.ip || req.connection.remoteAddress || "unknown";
  }
  try {
    guardrails.rateLimit(`api:${ip}`, 10, 1000); // 10 per second, 1-second window
  } catch (err) {
    if (err.message.includes("Rate limit")) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded — slow down" } });
    }
    throw err;
  }
  next();
}

module.exports = { rateLimitMiddleware };
