---
id: 3d1c6ad2-8ebb-71ba-8f3f-b60cb1f34a93
key: topic:javascript/memory-gc
subject: javascript
topic: memory-gc
title: Garbage Collection & Memory Leaks
slug: garbage-collection-memory-leaks
order: 1
---

JavaScript frees memory automatically once objects become unreachable. Leaks happen when you <em>accidentally keep them reachable</em>.

# Reachability

The collector starts from <strong>roots</strong> — globals, the current call stack, active closures, pending callbacks — and marks everything reachable from them. Anything not marked is garbage, even if it points to other garbage (so cycles are fine).

1. <strong>Mark</strong>

   Traverse from the roots and mark every reachable object.

2. <strong>Sweep / compact</strong>

   Reclaim unmarked memory; optionally move live objects together.

> [!NOTE] Young generation
>
> New objects are allocated here. Most die young, so it is collected often and cheaply (<em>scavenge</em>).

> [!NOTE] Old generation
>
> Objects that survive a few collections are promoted. Collected less often with incremental / concurrent mark-sweep-compact.

> [!NOTE] Key point
>
> V8's collector (<em>Orinoco</em>) is generational, incremental and mostly concurrent, keeping pauses short. You cannot trigger GC from normal code (`node --expose-gc` gives `global.gc()` for experiments).

# Common leaks

| Leak | Why it stays reachable | Fix |
| --- | --- | --- |
| Forgotten timers | `setInterval` callback (and everything it closes over) is referenced by the timer | `clearInterval` on cleanup |
| Event listeners | Listener closures on long-lived targets (window, document, emitters) | `removeEventListener`, `{ signal }`, `{ once: true }` |
| Unbounded caches / Maps | Keys and values are held strongly forever | LRU limit, `WeakMap`, TTL |
| Closures capturing big data | A small long-lived function keeps a huge outer variable alive | Copy only what's needed; null out references |
| Detached DOM nodes | Removed from the page but still referenced from JS | Drop references; use `WeakMap` for per-node data |
| Accidental globals | Sloppy-mode `x = …` creates a global root | Strict mode / modules |

```javascript filename:JavaScript
import { EventEmitter } from "node:events";
const bus = new EventEmitter();

function subscribeLeaky() {
  const bigBuffer = new Array(1e5).fill("*");      // captured by the listener below
  bus.on("tick", () => bigBuffer.length);
}
for (let i = 0; i < 3; i++) subscribeLeaky();
console.log("listeners after 3 leaky subscribes:", bus.listenerCount("tick"));

function subscribeClean(signal) {
  const handler = () => {};
  bus.on("tock", handler);
  signal.addEventListener("abort", () => bus.off("tock", handler));
}
const ac = new AbortController();
subscribeClean(ac.signal);
ac.abort();                                       // component unmounted
console.log("listeners after cleanup:", bus.listenerCount("tock"));
```

```text filename:Output
listeners after 3 leaky subscribes: 3
listeners after cleanup: 0
```

# Measuring

```javascript filename:JavaScript
const before = process.memoryUsage().heapUsed;
let data = Array.from({ length: 200_000 }, (_, i) => ({ i }));
const during = process.memoryUsage().heapUsed;
console.log("grew by more than 5 MB:", during - before > 5 * 1024 * 1024);
data = null;   // now unreachable — eligible for collection
```

```text filename:Output
grew by more than 5 MB: true
```

- Browser: DevTools → <strong>Memory</strong> → heap snapshots (compare two) and the allocation timeline; look for growing <em>Detached</em> elements.
- Node: `process.memoryUsage()`, `node --inspect` + Chrome DevTools, `--heapsnapshot-signal`, `v8.writeHeapSnapshot()`.

```question
How does garbage collection work in JavaScript?

---

Engines use tracing mark-and-sweep: starting from roots (globals, stack, closures) they mark reachable objects and reclaim the rest. V8 is generational — frequent cheap collection of the young generation, rarer mark-compact of the old — and does much of the work incrementally and concurrently.
```

```question
Can circular references cause memory leaks?

---

Not with mark-and-sweep: a cycle that is unreachable from the roots is collected. (They did leak with old reference-counting collectors, e.g. IE6 DOM/JS cycles.)
```
