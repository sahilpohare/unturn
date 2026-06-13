# ADR-0009: Queue-depth-driven autoscaling via Prometheus + Kubernetes HPA

**Status:** Accepted
**Date:** 2025-01-01

## Context

Worker pods need to scale in response to load. Standard Kubernetes HPA scales on CPU or memory. For Temporal workloads these are poor signals: a worker polling an empty queue has near-zero CPU but is correctly sized; a worker processing LLM calls may have low CPU while blocked on network I/O but high latency.

The correct signal is Temporal's `temporal_activity_task_queue_depth` — the number of tasks waiting to be picked up by a worker on a given queue. If this grows, it means workers cannot keep up and more replicas are needed.

## Decision

**Metric pipeline:**

```
Temporal server (:9090/metrics)
    → Prometheus (scrapes every 15s)
    → prometheus-adapter (exposes as Kubernetes external metric)
    → HPA reads external metric
    → scales Deployment replicas
```

Temporal is configured with `PROMETHEUS_ENDPOINT=0.0.0.0:9090`. Prometheus scrapes it and retains queue depth, schedule-to-start latency, and failure rate metrics. The Grafana dashboard (`queue-depth.json`) visualises all three panels auto-provisioned at startup.

**HPA target:** `averageValue: 5` — scale up when average queue depth per pod exceeds 5 tasks. This means:
- 1 pod handles up to 5 queued tasks before a second pod is added
- Scales linearly: 10 tasks → 2 pods, 50 tasks → 10 pods (capped at `maxReplicas`)

**Scale-down:** Kubernetes default 5-minute stabilisation window prevents thrashing when queue drains quickly.

## Consequences

- **Good:** Scaling signal is directly tied to user-visible latency (schedule-to-start time), not proxy metrics like CPU.
- **Good:** Per-queue metrics mean free, pro, and enterprise worker pools scale independently. A pro queue spike does not trigger free worker scaling.
- **Good:** Grafana dashboard is auto-provisioned — no manual setup. p99 schedule-to-start latency panel immediately shows when a tier is undersized.
- **Bad:** Requires prometheus-adapter installed in the cluster. This is an additional operational dependency beyond standard kube-prometheus-stack.
- **Bad:** The `averageValue: 5` threshold is a starting point. The correct value depends on activity duration (LLM calls ~5s → different from HTTP calls ~200ms). Tune per tier after observing real traffic.
- **Tradeoff:** Prometheus scrape interval is 15s. HPA poll interval is 15s by default. Total lag from queue spike to scale decision is up to 30s. For bursty UGC flows this is acceptable — flows are minutes long, not millisecond latency.
