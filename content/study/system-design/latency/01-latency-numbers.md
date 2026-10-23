---
id: bcfc9422-9fe9-73a2-9934-c727b59f46a2
key: topic:system-design/latency
subject: system-design
topic: latency
title: Latency Numbers
slug: latency-numbers
order: 1
---

Google's famous table — memorize these. They justify every architecture decision. Why cache? RAM is 300,000× faster than disk.

| Operation | Latency | In Human Terms | Category |
| --- | --- | --- | --- |
| L1 cache reference | 0.5 ns | Blink of an eye = 0.5 ns here | Instant |
| Branch mispredict | 5 ns | 10× L1 | Instant |
| L2 cache reference | 7 ns | 14× L1 | Very fast |
| Mutex lock/unlock | 100 ns | — | Fast |
| Main memory (RAM) reference | 100 ns | 200× L1 | Fast |
| Compress 1K bytes (Snappy) | 10,000 ns | 10 µs | Medium |
| Send 2KB over 1 Gbps network | 20,000 ns | 20 µs | Medium |
| Read 1MB sequentially from RAM | 250,000 ns | 250 µs | Medium |
| Round trip within same datacenter | 500,000 ns | 0.5 ms | Noticeable |
| Disk seek (HDD) | 10,000,000 ns | 10 ms — 20,000× RAM | Slow |
| Read 1MB sequentially from network | 10,000,000 ns | 10 ms | Slow |
| Read 1MB sequentially from disk | 30,000,000 ns | 30 ms | Slow |
| Packet: California → Netherlands → CA | 150,000,000 ns | 150 ms | Very slow |

# Key Takeaways

> [!NOTE] Why Caching Matters
>
> RAM (100 ns) is <strong>300,000× faster</strong> than disk (30 ms). If your hot data fits in RAM, never let it hit disk. This is why Redis is so transformative.

> [!NOTE] Why CDNs Matter
>
> Cross-continent = 150ms. CDN edge node = 10–20ms. A <strong>10× improvement</strong> in perceived load time for static assets.

> [!NOTE] Why SSD Matters
>
> SSD eliminates disk seek: 10ms → 0.1ms. Random reads improve by 100×. Modern databases default to SSD-backed storage for this reason.

> [!NOTE] Minimize Network Calls
>
> Each datacenter round trip = 0.5ms. 100 micro-calls = 50ms of pure network overhead. Batch your calls aggressively.
