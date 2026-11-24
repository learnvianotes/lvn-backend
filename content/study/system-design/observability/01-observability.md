---
id: 1ad67807-1c18-77cf-8ef0-caaee4af3e31
key: topic:system-design/observability
subject: system-design
topic: observability
title: Observability
slug: observability
order: 1
---

Pillars of observability (Logs, Metrics, Traces), Prometheus, Grafana, Jaeger, OpenTelemetry, and SLA/SLO/SLI error budgets.

# Three Pillars of Observability

> [!NOTE] Structured Logging
>
> JSON formatted log events enriched with context (`trace_id`, `user_id`). Aggregated via Fluentd/Logstash into Elasticsearch/Loki.

> [!NOTE] Metrics
>
> Numeric time-series data.<br> • <strong>Counter:</strong> Monotonically increasing (e.g., total requests).<br> • <strong>Gauge:</strong> Instantaneous value (e.g., memory usage).<br> • <strong>Histogram:</strong> Samples observations into buckets (e.g., latency P99).

> [!NOTE] Distributed Tracing
>
> Tracks request lifecycle across microservice boundaries. Uses `Trace ID`, `Span ID`, and W3C Trace Context headers.

# OpenTelemetry (OTel) Ecosystem

> [!INFO]
>
> <strong>OpenTelemetry (OTel):</strong> Vendor-neutral CNCF framework providing unified APIs, SDKs, and the <strong>OTel Collector</strong> (Receiver → Processor → Exporter pipeline) to collect and route telemetry data to Prometheus, Jaeger, Datadog, or Grafana.

# SLA, SLO, SLI &amp; Error Budgets

> [!NOTE]
>
> <strong>SLI (Service Level Indicator)</strong>: Quantifiable metric (e.g., Successful Requests / Total Requests)
>
> <strong>SLO (Service Level Objective)</strong>: Target reliability goal (e.g., 99.99% success rate)
>
> <strong>SLA (Service Level Agreement)</strong>: Legal contract with financial penalty (e.g., 99.9%)
>
> <strong>Monthly Downtime at 99.99%</strong>: 4.38 Minutes / Month
