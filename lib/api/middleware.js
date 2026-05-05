/**
 * API Middleware — request logging, shutdown guard, error handler
 */

const logger = require("../core/logger");
const { errorCodeToHttp } = require("./config");

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

module.exports = { requestLogger, shutdownGuard, errorHandler, notFoundHandler };
