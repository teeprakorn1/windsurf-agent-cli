/**
 * Request Queue — Concurrency control and async job processing
 *
 * Prevents system overload by:
 * - Limiting concurrent agent executions
 * - Queuing excess requests with priority
 * - Providing backpressure when queue is full
 * - Tracking queue metrics
 */

const logger = require("./logger");
const crypto = require("crypto");
const { EventEmitter } = require("events");

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_QUEUE_SIZE = 100;
const DEFAULT_JOB_TIMEOUT_MS = 300000; // 5 minutes

class RequestQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || DEFAULT_CONCURRENCY;
    this.maxQueueSize = options.maxQueueSize || DEFAULT_QUEUE_SIZE;
    this.jobTimeoutMs = options.jobTimeoutMs || DEFAULT_JOB_TIMEOUT_MS;

    this.running = 0;
    this.queue = [];
    this.jobs = new Map();
    this._activeTimers = new Set(); // Track timers for cleanup
    this._destroyed = false;
    this.metrics = {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalTimedOut: 0,
      totalRejected: 0,
      totalWaitTimeMs: 0,
      totalRunTimeMs: 0,
    };
  }

  enqueue(fn, options = {}) {
    if (this._destroyed) {
      const err = new Error("Queue is destroyed");
      err.code = "QUEUE_DESTROYED";
      throw err;
    }
    const priority = options.priority || 0;
    const timeout = options.timeout !== undefined ? options.timeout : this.jobTimeoutMs;
    const id = `job-${crypto.randomUUID()}`;

    const totalLoad = this.running + this.queue.length;
    if (totalLoad >= this.concurrency + this.maxQueueSize) {
      this.metrics.totalRejected++;
      const err = new Error(`Queue full (${this.running} running, ${this.queue.length} queued). Try again later.`);
      err.code = "QUEUE_FULL";
      throw err;
    }

    const job = {
      id,
      fn,
      priority,
      timeout,
      enqueuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      status: "queued",
      result: null,
      error: null,
    };

    this.jobs.set(id, job);

    // Insert by priority (higher = first)
    let insertIdx = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priority > this.queue[i].priority) {
        insertIdx = i;
        break;
      }
    }
    this.queue.splice(insertIdx, 0, job);
    this.metrics.totalEnqueued++;

    logger.debug(`Queue: enqueued ${id} (priority=${priority}, queue=${this.queue.length}, running=${this.running})`);

    this._processNext();
    return id;
  }

  async enqueueAsync(fn, options = {}) {
    const id = this.enqueue(fn, options);
    return this.waitFor(id);
  }

  waitFor(id) {
    return new Promise((resolve, reject) => {
      if (this._destroyed) return reject(new Error(`Queue is destroyed`));
      const job = this.jobs.get(id);
      if (!job) return reject(new Error(`Job ${id} not found`));

      if (job.status === "completed") return resolve(job.result);
      if (job.status === "failed") return reject(new Error(job.error));

      let settled = false;
      const onCompleted = (completedJob) => {
        if (completedJob.id !== id) return;
        if (settled) return;
        settled = true;
        this.off("completed", onCompleted);
        this.off("failed", onFailed);
        clearTimeout(timeoutTimer);
        resolve(completedJob.result);
      };
      const onFailed = (failedJob) => {
        if (failedJob.id !== id) return;
        if (settled) return;
        settled = true;
        this.off("completed", onCompleted);
        this.off("failed", onFailed);
        clearTimeout(timeoutTimer);
        reject(new Error(failedJob.error));
      };

      this.on("completed", onCompleted);
      this.on("failed", onFailed);

      const timeoutTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.off("completed", onCompleted);
        this.off("failed", onFailed);
        reject(new Error(`Wait timeout for job ${id}`));
      }, (job.timeout !== undefined ? job.timeout : this.jobTimeoutMs) + 1000);
      this._activeTimers.add(timeoutTimer);
    });
  }

  getJobStatus(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      waitTimeMs: job.startedAt ? job.startedAt - job.enqueuedAt : Date.now() - job.enqueuedAt,
      runTimeMs: job.completedAt && job.startedAt ? job.completedAt - job.startedAt : null,
    };
  }

  getJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.status === "completed" ? job.result : undefined,
      error: job.status === "failed" ? job.error : undefined,
    };
  }

  getRecentJobs(limit = 20) {
    const entries = [...this.jobs.entries()]
      .sort((a, b) => (b[1].enqueuedAt || 0) - (a[1].enqueuedAt || 0))
      .slice(0, limit);
    return entries.map(([, job]) => ({
      id: job.id,
      status: job.status,
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }));
  }

  _processNext() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this._executeJob(job);
    }
  }

  async _executeJob(job) {
    this.running++;
    job.startedAt = Date.now();
    job.status = "running";
    const waitTime = job.startedAt - job.enqueuedAt;
    this.metrics.totalWaitTimeMs += waitTime;

    logger.debug(`Queue: executing ${job.id} (waited=${waitTime}ms, running=${this.running})`);

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      if (job.status === "running") {
        settled = true;
        job.status = "failed";
        job.error = `Job timed out after ${job.timeout}ms`;
        this.metrics.totalTimedOut++;
        this._activeTimers.delete(timer);
        this._finishJob(job);
      }
    }, job.timeout);
    this._activeTimers.add(timer);

    try {
      job.result = await job.fn();
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      this._activeTimers.delete(timer);
      job.status = "completed";
      job.completedAt = Date.now();
      this.metrics.totalCompleted++;
      this.metrics.totalRunTimeMs += job.completedAt - job.startedAt;
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      this._activeTimers.delete(timer);
      job.status = "failed";
      job.error = err.message;
      job.completedAt = Date.now();
      this.metrics.totalFailed++;
      this.metrics.totalRunTimeMs += job.completedAt - job.startedAt;
    }

    this._finishJob(job);
  }

  _finishJob(job) {
    this.running--;

    if (job.status === "completed") {
      this.emit("completed", job);
    } else {
      this.emit("failed", job);
    }

    this._processNext();

    // Cleanup old jobs (keep last 200) — only remove completed/failed jobs to avoid breaking waitFor promises
    if (this.jobs.size > 200) {
      const completedEntries = [...this.jobs.entries()]
        .filter(([, j]) => j.status === "completed" || j.status === "failed")
        .sort((a, b) => (a[1].enqueuedAt || 0) - (b[1].enqueuedAt || 0));
      const toRemove = completedEntries.slice(0, completedEntries.length - 200);
      toRemove.forEach(([id]) => this.jobs.delete(id));
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      running: this.running,
      queued: this.queue.length,
      avgWaitTimeMs: this.metrics.totalCompleted > 0
        ? Math.round(this.metrics.totalWaitTimeMs / this.metrics.totalCompleted)
        : 0,
      avgRunTimeMs: this.metrics.totalCompleted > 0
        ? Math.round(this.metrics.totalRunTimeMs / this.metrics.totalCompleted)
        : 0,
    };
  }

  getHealth() {
    const m = this.getMetrics();
    const recentFailRate = m.totalCompleted + m.totalFailed > 0
      ? m.totalFailed / (m.totalCompleted + m.totalFailed)
      : 0;
    return {
      status: recentFailRate > 0.5 ? "unhealthy" : recentFailRate > 0.2 ? "degraded" : "healthy",
      running: m.running,
      queued: m.queued,
      recentFailRate: Math.round(recentFailRate * 100) / 100,
      avgWaitTimeMs: m.avgWaitTimeMs,
    };
  }

  destroy() {
    this._destroyed = true;
    this.queue.length = 0;
    // Clear all active timers
    for (const timer of this._activeTimers) {
      clearTimeout(timer);
    }
    this._activeTimers.clear();
    // Fail all pending jobs so waitFor() resolves/rejects
    const pendingJobs = [];
    for (const [, job] of this.jobs) {
      if (job.status === "queued" || job.status === "running") {
        job.status = "failed";
        job.error = "Queue destroyed";
        pendingJobs.push(job);
      }
    }
    // Emit events AFTER all statuses updated to avoid race with listeners
    for (const job of pendingJobs) {
      this.emit("failed", job);
    }
    this.running = 0;
    this.removeAllListeners();
    // Reset singleton so getDefaultQueue() can create a fresh instance
    if (_defaultQueue === this) _defaultQueue = null;
  }
}

// Singleton for agent execution queue
let _defaultQueue = null;

function getDefaultQueue() {
  if (!_defaultQueue) {
    _defaultQueue = new RequestQueue({ concurrency: 5, maxQueueSize: 100 });
  }
  return _defaultQueue;
}

module.exports = { RequestQueue, getDefaultQueue };
