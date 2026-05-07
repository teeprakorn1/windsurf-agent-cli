/**
 * Circuit Breaker — Prevents cascade failures when external services (LLM, tools) are down
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests are rejected immediately
 * - HALF_OPEN: Testing if service recovered, allows limited requests
 */

const logger = require("./logger");

const STATE = { CLOSED: "closed", OPEN: "open", HALF_OPEN: "half_open" };

const breakers = new Map();

function createBreaker(name, options = {}) {
  const failureThreshold = options.failureThreshold || 5;
  const resetTimeoutMs = options.resetTimeoutMs || 30000;
  const halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;

  const breaker = {
    name,
    state: STATE.CLOSED,
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
    lastFailureError: null,
    halfOpenAttempts: 0,
    options: { failureThreshold, resetTimeoutMs, halfOpenMaxAttempts },
  };

  breakers.set(name, breaker);
  return breaker;
}

function getBreaker(name) {
  return breakers.get(name);
}

function canExecute(name) {
  const breaker = breakers.get(name);
  if (!breaker) return true;

  switch (breaker.state) {
    case STATE.CLOSED:
      return true;

    case STATE.OPEN: {
      if (!breaker.lastFailureTime) return false;
      const elapsed = Date.now() - breaker.lastFailureTime;
      if (elapsed >= breaker.options.resetTimeoutMs) {
        // Atomically transition + claim a probe slot to prevent double-entry
        breaker.state = STATE.HALF_OPEN;
        breaker.halfOpenAttempts = 1;
        logger.info(`Circuit breaker [${name}] transitioned: OPEN → HALF_OPEN`);
        return true;
      }
      return false;
    }

    case STATE.HALF_OPEN:
      if (breaker.halfOpenAttempts < breaker.options.halfOpenMaxAttempts) {
        breaker.halfOpenAttempts++;
        return true;
      }
      return false;

    default:
      return true;
  }
}

function recordSuccess(name) {
  const breaker = breakers.get(name);
  if (!breaker) return;

  breaker.successCount++;
  breaker.failureCount = 0;

  if (breaker.state === STATE.HALF_OPEN) {
    breaker.state = STATE.CLOSED;
    breaker.successCount = 1;
    breaker.halfOpenAttempts = 0;
    breaker.lastFailureTime = null; // prevent stale cleanup from deleting recovered breaker
    logger.info(`Circuit breaker [${name}] transitioned: HALF_OPEN → CLOSED (service recovered)`);
  }
}

function recordFailure(name, error) {
  const breaker = breakers.get(name);
  if (!breaker) return;

  breaker.failureCount++;
  breaker.lastFailureTime = Date.now();
  breaker.lastFailureError = error?.message || String(error);

  if (breaker.state === STATE.HALF_OPEN) {
    breaker.state = STATE.OPEN;
    breaker.halfOpenAttempts = 0;
    logger.warn(`Circuit breaker [${name}] transitioned: HALF_OPEN → OPEN (service still failing)`);
    return;
  }

  if (breaker.failureCount >= breaker.options.failureThreshold) {
    breaker.state = STATE.OPEN;
    logger.warn(`Circuit breaker [${name}] transitioned: CLOSED → OPEN (${breaker.failureCount} failures)`);
  }
}

function getBreakerStatus(name) {
  const breaker = breakers.get(name);
  if (!breaker) return { name, state: "not_found" };
  return {
    name,
    state: breaker.state,
    failureCount: breaker.failureCount,
    successCount: breaker.successCount,
    lastFailureTime: breaker.lastFailureTime,
    lastFailureError: breaker.lastFailureError,
  };
}

function getAllBreakerStatuses() {
  cleanupStaleBreakers();
  return [...breakers.keys()].map(getBreakerStatus);
}

function resetBreaker(name) {
  const breaker = breakers.get(name);
  if (!breaker) return;
  breaker.state = STATE.CLOSED;
  breaker.failureCount = 0;
  breaker.successCount = 0;
  breaker.halfOpenAttempts = 0;
  breaker.lastFailureTime = null;
  breaker.lastFailureError = null;
  logger.info(`Circuit breaker [${name}] manually reset to CLOSED`);
}

function removeBreaker(name) {
  breakers.delete(name);
}

function cleanupStaleBreakers() {
  const now = Date.now();
  for (const [name, breaker] of breakers) {
    // Only remove breakers that have had activity and then gone stale
    // Never remove breakers that were never used (lastFailureTime is null)
    if (breaker.state === STATE.CLOSED && breaker.failureCount === 0 && breaker.lastFailureTime !== null) {
      const staleThreshold = breaker.options.resetTimeoutMs * 2;
      if (now - breaker.lastFailureTime > staleThreshold) {
        breakers.delete(name);
      }
    }
  }
}

module.exports = {
  STATE,
  createBreaker,
  getBreaker,
  canExecute,
  recordSuccess,
  recordFailure,
  getBreakerStatus,
  getAllBreakerStatuses,
  resetBreaker,
  removeBreaker,
  cleanupStaleBreakers,
};
