---
id: d4b6495d-621d-7e48-b405-13d22269c76a
key: topic:javascript/timers
subject: javascript
topic: timers
title: Timers & Cancellation
slug: timers-cancellation
order: 1
---

`setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask` and `AbortController` — scheduling work and cancelling it.

| API | Schedules | Cancel with |
| --- | --- | --- |
| `setTimeout(fn, ms, ...args)` | Once, after at least `ms` | `clearTimeout(id)` |
| `setInterval(fn, ms)` | Repeatedly every `ms` | `clearInterval(id)` |
| `setImmediate(fn)` (Node) | Once, in the check phase | `clearImmediate(id)` |
| `queueMicrotask(fn)` | As a microtask | — |
| `requestAnimationFrame(fn)` (browser) | Before the next repaint | `cancelAnimationFrame(id)` |

```javascript filename:JavaScript
const id = setTimeout(() => console.log("never printed"), 10);
clearTimeout(id);

setTimeout((a, b) => console.log("args:", a, b), 5, "x", "y");

let n = 0;
const iv = setInterval(() => {
  n++;
  console.log("tick", n);
  if (n === 3) clearInterval(iv);
}, 5);
```

```text filename:Output
args: x y
tick 1
tick 2
tick 3
```

# Delays are minimums

- The callback runs <strong>at least</strong> `ms` later — later if the stack is busy.
- Browsers clamp nested timers (5+ levels deep) to ≥ 4 ms and throttle background tabs to ≥ 1 s.
- `setInterval` does not wait for slow callbacks; prefer a recursive `setTimeout` when each run must finish before the next is scheduled.

```javascript filename:JavaScript
const start = performance.now();
setTimeout(() => {
  console.log("waited at least 20ms:", performance.now() - start >= 20);
}, 10);
while (performance.now() - start < 20) {}   // block the thread for 20ms
```

```text filename:Output
waited at least 20ms: true
```

# Promise-based timers

```javascript filename:JavaScript
import { setTimeout as sleep } from "node:timers/promises";
const sleepAnywhere = (ms) => new Promise((r) => setTimeout(r, ms));   // browser version

console.log(await sleep(5, "node timers/promises"));
await sleepAnywhere(5);
console.log("slept");
```

```text filename:Output
node timers/promises
slept
```

# Cancellation with AbortController

```javascript filename:JavaScript
function cancellableDelay(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms, "finished");
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}
const controller = new AbortController();
setTimeout(() => controller.abort(new Error("user cancelled")), 10);
try {
  await cancellableDelay(1000, { signal: controller.signal });
} catch (e) {
  console.log(e.message);
}
try {
  await cancellableDelay(1000, { signal: AbortSignal.timeout(10) });
} catch (e) {
  console.log(e.name);
}
```

```text filename:Output
user cancelled
TimeoutError
```

> [!NOTE] Key point
>
> `fetch(url, { signal })`, `addEventListener(…, { signal })`, Node streams and `timers/promises` all accept an `AbortSignal` — one controller can cancel a whole group of operations.

```question
Why might setTimeout(fn, 0) not run immediately?

---

It only queues a macrotask. It runs after the current synchronous code, after all microtasks, and after any earlier timers — and browsers may clamp the delay.
```
