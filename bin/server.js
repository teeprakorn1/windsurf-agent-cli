#!/usr/bin/env node

/**
 * aiyu-multi-agent serve — HTTP API + WebSocket server
 */

const { createApp } = require("../lib/api/server");
const apiConfig = require("../lib/api/config");
const { setServer, registerShutdownHandlers } = require("../lib/api/shutdown");
const { mountWebSocket } = require("../lib/api/ws");
const logger = require("../lib/core/logger");

const app = createApp();
const server = app.listen(apiConfig.PORT, () => {
  const healthCheck = require("../lib/core/health-check");
  healthCheck.markInitialized();
  logger.info(`aiyu-multi-agent API listening on port ${apiConfig.PORT}`);
  console.log(`✅ API server started — http://localhost:${apiConfig.PORT}`);
  console.log(`   /health  — System health check`);
  console.log(`   /metrics — Prometheus metrics`);
  console.log(`   /traces  — Distributed traces`);
  console.log(`   /ws      — WebSocket real-time streaming`);
});

// Mount WebSocket on the same HTTP server
mountWebSocket(server);

setServer(server);
registerShutdownHandlers();
