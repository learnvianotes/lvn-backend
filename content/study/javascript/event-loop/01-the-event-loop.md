---
id: e778be0f-5072-7f26-826f-10bd444316d4
key: topic:javascript/event-loop
subject: javascript
topic: event-loop
title: The Event Loop
slug: the-event-loop
order: 1
---

One thread, one call stack — and a loop that, whenever the stack is empty, drains <em>all</em> microtasks and then takes the next macrotask. Predicting output order is a top interview skill.

# The moving parts

> [!NOTE] Call stack
>
> Where synchronous code runs, one frame at a time. Nothing else runs until it is empty.

> [!NOTE] Web / runtime APIs
>
> Timers, network, file I/O, DOM events — handled outside the JS thread by the browser or libuv (Node).

> [!NOTE] Macrotask (task) queue
>
> `setTimeout`, `setInterval`, `setImmediate`, I/O callbacks, UI events, `MessageChannel`.

> [!NOTE] Microtask queue
>
> Promise reactions (`then`/`catch`/`finally`, code after `await`), `queueMicrotask`, `MutationObserver`. Node's `process.nextTick` has its own even-higher-priority queue.

# One turn of the loop

1. <strong>Run a task</strong>

   Take the oldest macrotask (the initial script is the first) and run it to completion.

2. <strong>Drain microtasks</strong>

   Run <strong>every</strong> microtask — including ones queued while draining — until the queue is empty.

3. <strong>Render (browsers)</strong>

   If it's time for a frame: `requestAnimationFrame` callbacks, style, layout, paint.

4. <strong>Repeat</strong>

   Pick the next macrotask.

# Predict the output

```javascript filename:JavaScript
console.log("1: sync start");
setTimeout(() => console.log("6: timeout (macrotask)"), 0);
Promise.resolve()
  .then(() => console.log("3: promise then (microtask)"))
  .then(() => console.log("5: chained then (microtask)"));
queueMicrotask(() => console.log("4: queueMicrotask"));
console.log("2: sync end");
```

```text filename:Output
1: sync start
2: sync end
3: promise then (microtask)
4: queueMicrotask
5: chained then (microtask)
6: timeout (macrotask)
```

> [!NOTE] Key point
>
> A `setTimeout(fn, 0)` never runs before microtasks queued in the same task. `0` means “as soon as possible after at least 0 ms”, not “now”.

# async/await in the ordering

```javascript filename:JavaScript
async function task() {
  console.log("B: task starts (sync part)");
  await null;                               // everything after this is a microtask
  console.log("E: task resumes after await");
}
console.log("A: script start");
setTimeout(() => console.log("G: timeout"), 0);
task();
new Promise((resolve) => {
  console.log("C: executor runs synchronously");
  resolve();
}).then(() => console.log("F: then"));
console.log("D: script end");
```

```text filename:Output
A: script start
B: task starts (sync part)
C: executor runs synchronously
D: script end
E: task resumes after await
F: then
G: timeout
```

# Microtasks can starve the loop

```javascript filename:JavaScript
let count = 0;
setTimeout(() => console.log("timeout finally runs, microtasks ran:", count), 0);
function spin() {
  if (++count < 1000) queueMicrotask(spin);   // keeps refilling the queue
}
queueMicrotask(spin);
```

```text filename:Output
timeout finally runs, microtasks ran: 1000
```

> [!WARNING] Watch out
>
> Because the microtask queue is drained completely, an endless chain of microtasks blocks timers, I/O and rendering just like a `while(true)` loop. Long synchronous work does the same — split it up or move it to a Worker.

# Node specifics: nextTick, setImmediate

| Node phase / queue | Runs |
| --- | --- |
| `process.nextTick` queue | After the current operation, before promise microtasks (from CommonJS/callbacks) |
| Promise microtasks | Right after the nextTick queue |
| timers | Expired `setTimeout` / `setInterval` |
| poll | I/O callbacks (fs, network) |
| check | `setImmediate` |
| close | `'close'` events |

```javascript filename:JavaScript
setTimeout(() => {
  console.log("inside a timer callback:");
  setTimeout(() => console.log("  4. setTimeout 0 (next timers phase)"), 0);
  setImmediate(() => console.log("  3. setImmediate (check phase comes first)"));
  Promise.resolve().then(() => console.log("  2. promise microtask"));
  process.nextTick(() => console.log("  1. process.nextTick"));
}, 0);
```

```text filename:Output
inside a timer callback:
  1. process.nextTick
  2. promise microtask
  3. setImmediate (check phase comes first)
  4. setTimeout 0 (next timers phase)
```

> [!NOTE] ESM subtlety
>
> At the top level of an <strong>ES module</strong> the module body itself runs as part of a promise job, so there a `.then` callback can run before a `process.nextTick` — one reason not to depend on nextTick-vs-promise ordering.

```question
What is the difference between microtasks and macrotasks?

---

Macrotasks (timers, I/O, events) are taken one per loop turn. Microtasks (promise reactions, `queueMicrotask`) run right after the current task and the whole queue is drained before the next macrotask or render. So promise callbacks always beat a `setTimeout(…, 0)` scheduled at the same time.
```

```question
If JavaScript is single-threaded, how does it do async work?

---

The engine is single-threaded, but the runtime is not: timers, network and disk I/O run in the browser or libuv thread pool. When they finish, their callbacks are queued, and the event loop runs them on the main thread when the call stack is empty.
```
