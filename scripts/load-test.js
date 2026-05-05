#!/usr/bin/env node

/**
 * Load Test — concurrent POST /jobs with latency + error tracking
 * Usage: node scripts/load-test.js [concurrency] [duration_sec]
 * Requires: API server running on localhost:3000
 */

const http = require("http");

const CONCURRENCY = parseInt(process.argv[2], 10) || 10;
const DURATION_SEC = parseInt(process.argv[3], 10) || 30;
const PORT = parseInt(process.env.PORT, 10) || 3000;
const BASE = `http://localhost:${PORT}`;

const results = { total: 0, success: 0, failed: 0, rateLimited: 0, latencies: [], errors: {} };

function postJob() {
  const start = Date.now();
  return new Promise((resolve) => {
    const body = JSON.stringify({
      input: `load-test-${results.total + 1}`,
      agent_name: "react-developer",
      provider: "mock",
    });
    const opts = {
      method: "POST",
      hostname: "localhost",
      port: PORT,
      path: "/jobs",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        const latency = Date.now() - start;
        results.latencies.push(latency);
        results.total++;
        if (res.statusCode === 202) {
          results.success++;
        } else if (res.statusCode === 429) {
          results.rateLimited++;
        } else {
          results.failed++;
          const code = `HTTP ${res.statusCode}`;
          results.errors[code] = (results.errors[code] || 0) + 1;
        }
        resolve();
      });
    });
    req.on("error", (err) => {
      results.failed++;
      results.total++;
      results.errors[err.code || err.message] = (results.errors[err.code || err.message] || 0) + 1;
      resolve();
    });
    req.setTimeout(30000, () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

async function worker() {
  while (Date.now() - startTime < DURATION_SEC * 1000) {
    await postJob();
    await new Promise(r => setTimeout(r, 50)); // 50ms gap ≈ 20 req/s per worker
  }
}

const startTime = Date.now();

console.log(`\n🚀 Load Test: ${CONCURRENCY} concurrent, ${DURATION_SEC}s duration\n`);

const workers = [];
for (let i = 0; i < CONCURRENCY; i++) {
  workers.push(worker());
}

Promise.all(workers).then(() => {
  const elapsed = (Date.now() - startTime) / 1000;
  const latencies = results.latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const errorRate = results.total > 0 ? ((results.failed / results.total) * 100).toFixed(1) : 0;
  const rps = (results.total / elapsed).toFixed(1);

  console.log("📊 Results:\n");
  console.log(`  Total requests:  ${results.total}`);
  console.log(`  Success (202):   ${results.success}`);
  console.log(`  Rate limited:    ${results.rateLimited}`);
  console.log(`  Failed:          ${results.failed}`);
  console.log(`  Error rate:      ${errorRate}%`);
  console.log(`  Requests/sec:    ${rps}`);
  console.log(`  Avg latency:     ${avg}ms`);
  console.log(`  P50 latency:     ${p50}ms`);
  console.log(`  P95 latency:     ${p95}ms`);
  console.log(`  P99 latency:     ${p99}ms`);

  if (Object.keys(results.errors).length > 0) {
    console.log("\n  Errors:");
    for (const [code, count] of Object.entries(results.errors)) {
      console.log(`    ${code}: ${count}`);
    }
  }

  const pass = results.total > 0 && parseFloat(errorRate) < 5 && p95 < 5000;
  console.log(`\n  ${pass ? "✅ PASS" : "❌ FAIL"}: error rate < 5%, p95 < 5s\n`);
  process.exit(pass ? 0 : 1);
});
