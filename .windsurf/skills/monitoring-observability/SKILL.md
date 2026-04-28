---
name: monitoring-observability
description: Logging, metrics, tracing, and observability best practices for production systems
allowed-tools: Read, Write, Edit, Bash
version: 1.0
priority: HIGH
---

# Monitoring & Observability - See What Your System Is Doing

> You can't fix what you can't see. Observability is debugging production.

---

## The Three Pillars

```
┌─────────────────────────────────────────┐
│           OBSERVABILITY                 │
├─────────────┬─────────────┬─────────────┤
│   METRICS   │    LOGS     │   TRACES    │
├─────────────┼─────────────┼─────────────┤
│  Numerical  │   Events    │  Request    │
│   data      │   over      │   flows     │
│  over time  │   time      │             │
├─────────────┼─────────────┼─────────────┤
│  "What is   │  "What      │  "Where is  │
│ happening?" │ happened?"  │ the issue?" │
└─────────────┴─────────────┴─────────────┘
```

---

## Logging

### Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| **ERROR** | Failures requiring intervention | Database connection failed |
| **WARN** | Unexpected but handled | Retry attempt 3/5 |
| **INFO** | Normal operations | User login successful |
| **DEBUG** | Development troubleshooting | Variable values |
| **TRACE** | Detailed execution flow | Function entry/exit |

### Structured Logging

```python
# ✅ GOOD — Structured, queryable logs
import logging
import json

logger = logging.getLogger(__name__)

logger.info(
    "User action completed",
    extra={
        "user_id": user.id,
        "action": "purchase",
        "item_id": item.id,
        "amount": 99.99,
        "duration_ms": 245
    }
)
# Output: {"message": "User action completed", "user_id": 123, "action": "purchase", ...}

# ❌ BAD — Unstructured, hard to query
logger.info(f"User {user.id} purchased item {item.id} for {amount}")
```

### Log Best Practices

- **Correlation IDs**: Track requests across services
- **Context**: Include relevant identifiers
- **No Sensitive Data**: Never log passwords, tokens
- **Rate Limiting**: Prevent log flooding

---

## Metrics

### The RED Method

| Metric | Description | Example |
|--------|-------------|---------|
| **Rate** | Requests per second | `http_requests_total` |
| **Errors** | Failed requests | `http_errors_total` |
| **Duration** | Request latency | `http_request_duration_seconds` |

### The USE Method

| Metric | Description | Example |
|--------|-------------|---------|
| **Utilization** | Resource busy time | `cpu_usage_percent` |
| **Saturation** | Queue length | `request_queue_size` |
| **Errors** | Resource errors | `disk_io_errors` |

### Metric Types

```python
# Counter — Always increasing
http_requests_total{method="GET", status="200"}

# Gauge — Can go up or down
cpu_usage_percent{core="0"}

# Histogram — Buckets of observations
http_request_duration_seconds_bucket{le="0.1"}

# Summary — Calculates percentiles
http_request_duration_seconds{quantile="0.95"}
```

---

## Distributed Tracing

### Trace Structure

```
Trace: request-abc123
├── Span: API Gateway (2ms)
│   ├── Span: Auth Service (5ms)
│   ├── Span: User Service (15ms)
│   │   └── Span: Database Query (8ms)
│   └── Span: Order Service (25ms)
│       └── Span: Payment Service (20ms)
└── Total: 47ms
```

### Trace Context

```python
# Propagate trace context across services
headers = {
    "traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    "tracestate": "vendor=value"
}

# Start new span
with tracer.start_as_current_span("process_order") as span:
    span.set_attribute("order.id", order_id)
    span.set_attribute("order.amount", amount)
    process_payment(order)
```

---

## Alerting

### Alert Categories

| Type | Response Time | Example |
|------|---------------|---------|
| **Page** | Immediate | Service down, data loss |
| **Ticket** | Business hours | High error rate |
| **Log** | Review later | Minor performance degradation |

### Alert Quality

**Good Alert:**
- Actionable: "Database CPU > 90%, scale up or investigate query"
- Specific: "Payment service latency p95 > 500ms"
- Timely: Sent within 1 minute of threshold breach

**Bad Alert:**
- "Something is wrong"
- Flapping: Triggers and resolves repeatedly
- No clear action to take

---

## Dashboards

### Key Dashboards

| Dashboard | Metrics | Audience |
|-----------|---------|----------|
| **Service Health** | RED metrics, uptime | Everyone |
| **Business Metrics** | Orders, revenue, users | Business |
| **Infrastructure** | CPU, memory, disk | Operations |
| **Error Analysis** | Error rates, types | Developers |

### Visualization Tips

- Use appropriate chart types:
  - **Line charts**: Trends over time
  - **Bar charts**: Comparisons
  - **Heatmaps**: Latency distributions
  - **Single stats**: Current values

---

## Tools

| Category | Tools |
|----------|-------|
| **Metrics** | Prometheus, Grafana, Datadog, New Relic |
| **Logging** | ELK Stack, Splunk, Loki, CloudWatch |
| **Tracing** | Jaeger, Zipkin, OpenTelemetry |
| **APM** | Datadog, Dynatrace, AppDynamics |

---

## Verification Checklist

- [ ] Logs are structured and queryable
- [ ] Correlation IDs propagated across services
- [ ] Key metrics collected (RED/USE methods)
- [ ] Alerts are actionable and specific
- [ ] Dashboards exist for critical services
- [ ] Error rates and latencies monitored
- [ ] Log retention policy defined
- [ ] No sensitive data in logs

---

> 📊 **Remember:** Observability is about asking questions you didn't anticipate. Instrument everything.
