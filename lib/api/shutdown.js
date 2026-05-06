/**
 * Graceful Shutdown — SIGTERM/SIGINT handler with drain support
 */

const logger = require("../core/logger");
const { getDefaultQueue } = require("../core/request-queue");
const apiConfig = require("./config");

let _server = null;
let _isShuttingDown = false;

function setServer(server) {
  _server = server;
}

function isShuttingDown() {
  return _isShuttingDown;
}

function gracefulShutdown(signal) {
  if (_isShuttingDown) return;
  _isShuttingDown = true;

  logger.info(`Received ${signal} — starting graceful shutdown`);

  // 1. Stop accepting new connections
  if (_server) {
    _server.close(() => {
      logger.info("HTTP server closed — no more connections");
    });
  }

  // 2. Terminate all WebSocket connections
  try {
    const { terminateAllConnections } = require("./ws");
    terminateAllConnections();
    logger.info("WebSocket connections terminated");
  } catch { /* ws module may not be loaded */ }

  // 3. Destroy queue (fails pending jobs)
  try {
    const queue = getDefaultQueue();
    queue.destroy();
    logger.info("Request queue destroyed");
  } catch { /* queue may not exist */ }

  // 4. Force exit after timeout
  setTimeout(() => {
    logger.warn(`Force exit after ${apiConfig.SHUTDOWN_TIMEOUT_MS}ms — some connections may not have drained`);
    process.exit(1);
  }, apiConfig.SHUTDOWN_TIMEOUT_MS);

  logger.info(`Graceful shutdown in progress — force exit in ${apiConfig.SHUTDOWN_TIMEOUT_MS / 1000}s`);
}

function registerShutdownHandlers() {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = { setServer, isShuttingDown, gracefulShutdown, registerShutdownHandlers };
