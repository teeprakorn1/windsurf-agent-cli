/**
 * Smoke Tests — CLI commands + API endpoints
 * Run: node lib/test/smoke/api.test.js
 */

const http = require("http");

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}

async function fetchJSON(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { "Content-Type": "application/json" } };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAPI() {
  console.log("\n🧪 API Smoke Tests\n");

  // Health
  const health = await fetchJSON("GET", "/health");
  assert(health.status === 200 || health.status === 503, `GET /health → ${health.status}`);

  // Metrics
  const metrics = await fetchJSON("GET", "/metrics");
  assert(metrics.status === 200, `GET /metrics → ${metrics.status}`);
  assert(metrics.headers["content-type"]?.includes("text/plain"), `GET /metrics content-type → ${metrics.headers["content-type"]}`);

  // Traces
  const traces = await fetchJSON("GET", "/traces");
  assert(traces.status === 200, `GET /traces → ${traces.status}`);

  // Not found
  const notFound = await fetchJSON("GET", "/nonexistent");
  assert(notFound.status === 404, `GET /nonexistent → ${notFound.status}`);
  assert(notFound.body.error?.code === "NOT_FOUND", `404 error code → ${notFound.body.error?.code}`);

  // POST /jobs — missing input
  const badJob = await fetchJSON("POST", "/jobs", {});
  assert(badJob.status === 400, `POST /jobs (no input) → ${badJob.status}`);

  // POST /jobs — valid mock
  const job = await fetchJSON("POST", "/jobs", { input: "hello", agent_name: "react-developer", provider: "mock" });
  assert(job.status === 202, `POST /jobs (mock) → ${job.status}`);
  assert(!!job.body.jobId, `Job has jobId → ${job.body.jobId}`);

  // GET /jobs/:id
  if (job.body.jobId) {
    // Wait a bit for job to process
    await new Promise(r => setTimeout(r, 1000));
    const jobStatus = await fetchJSON("GET", `/jobs/${job.body.jobId}`);
    assert(jobStatus.status === 200, `GET /jobs/:id → ${jobStatus.status}`);
    assert(["queued", "running", "completed", "failed"].includes(jobStatus.body.status), `Job status → ${jobStatus.body.status}`);
  }

  // GET /jobs list
  const jobsList = await fetchJSON("GET", "/jobs");
  assert(jobsList.status === 200, `GET /jobs → ${jobsList.status}`);
}

testAPI()
  .then(() => {
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error("Smoke test error:", err.message);
    console.log("\n⚠️  Make sure the API server is running: node bin/server.js\n");
    process.exit(1);
  });
