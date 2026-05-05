/**
 * API Middleware — request logging, shutdown guard, error handler, API key auth
 */

const crypto = require("crypto");
const logger = require("../core/logger");
const { errorCodeToHttp } = require("./config");

// API Key authentication — enabled when AIYU_API_KEY env var is set
const API_KEY = process.env.AIYU_API_KEY || null;
const API_KEY_HASH = API_KEY ? crypto.createHash("sha256").update(API_KEY).digest("hex") : null;

function apiKeyAuth(req, res, next) {
  // Skip auth if no API key configured (backward compatible)
  if (!API_KEY) return next();

  // Allow /health without auth (k8s probes)
  if (req.path === "/health") return next();

  // Check Authorization: Bearer <key> or x-api-key header
  const bearerMatch = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/);
  const providedKey = bearerMatch ? bearerMatch[1] : req.headers["x-api-key"];

  if (!providedKey) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "API key required. Set Authorization: Bearer <key> or x-api-key header" } });
  }

  // Constant-time comparison to prevent timing attacks
  const providedHash = crypto.createHash("sha256").update(providedKey).digest("hex");
  if (providedHash.length !== API_KEY_HASH.length || !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(API_KEY_HASH))) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
  }

  next();
}

function wsApiKeyAuth(info, cb) {
  // Skip auth if no API key configured
  if (!API_KEY) return cb(true);

  // Check query param or protocol header
  const url = new URL(info.req.url, `http://${info.req.headers.host || "localhost"}`);
  const token = url.searchParams.get("token") ||
    (info.req.headers.authorization || "").replace(/^Bearer\s+/, "");

  if (!token) {
    logger.warn("WebSocket auth failed: no token provided");
    return cb(false, 401, "Unauthorized: API key required");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash.length !== API_KEY_HASH.length || !crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(API_KEY_HASH))) {
    logger.warn("WebSocket auth failed: invalid token");
    return cb(false, 401, "Unauthorized: Invalid API key");
  }

  cb(true);
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
}

function shutdownGuard(req, res, next) {
  const { isShuttingDown } = require("./shutdown");
  if (isShuttingDown()) {
    return res.status(503).json({ error: { code: "SHUTTING_DOWN", message: "Server is shutting down" } });
  }
  next();
}

function errorHandler(err, req, res, _next) {
  const code = err.code || "INTERNAL_ERROR";
  const { status, message } = errorCodeToHttp(code);
  const detail = err.message !== code ? err.message : undefined;

  if (status >= 500) {
    logger.error(`API Error: ${code} — ${err.message}`);
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(detail && { detail }),
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` } });
}

module.exports = { apiKeyAuth, wsApiKeyAuth, requestLogger, shutdownGuard, errorHandler, notFoundHandler };
