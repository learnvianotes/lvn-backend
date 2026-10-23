---
id: 6a07913f-0ace-77df-803b-259267aefa3b
key: topic:javascript/promises
subject: javascript
topic: promises
title: Promises
slug: promises
order: 1
---

A Promise is an object representing a value that will be available later — or an error. It is the foundation of modern async JavaScript.

> [!INFO]
>
> <strong>Promise</strong> — an object in one of three states: <strong>pending</strong>, then either <strong>fulfilled</strong> with a value or <strong>rejected</strong> with a reason. Once settled it never changes.

# Creating and consuming

```javascript filename:JavaScript
const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (msg) => new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), 5));

wait(10, "done").then((v) => console.log("fulfilled:", v));
fail("boom")
  .then(() => console.log("never runs"))
  .catch((err) => console.log("rejected:", err.message))
  .finally(() => console.log("finally: cleanup either way"));
```

```text filename:Output
rejected: boom
finally: cleanup either way
fulfilled: done
```

# Chaining: every then returns a new promise

```javascript filename:JavaScript
Promise.resolve(2)
  .then((n) => n * 10)                         // return a value → next then gets it
  .then((n) => new Promise((r) => setTimeout(() => r(n + 1), 5)))  // return a promise → waits
  .then((n) => {
    console.log("value:", n);
    throw new Error("oops");                   // throw → skips to the next catch
  })
  .then(() => console.log("skipped"))
  .catch((e) => {
    console.log("caught:", e.message);
    return "recovered";                        // catch can recover the chain
  })
  .then((v) => console.log("after catch:", v));
```

```text filename:Output
value: 21
caught: oops
after catch: recovered
```

| Inside a `then` handler you… | The returned promise… |
| --- | --- |
| return a value | fulfils with that value |
| return a promise/thenable | adopts its eventual state |
| throw | rejects with the thrown error |
| return nothing | fulfils with `undefined` |

# Common mistakes

```javascript filename:JavaScript
const getData = () => Promise.resolve({ id: 1 });

// 1. forgetting to return → the next then gets undefined
getData()
  .then((d) => { getData(); })
  .then((v) => console.log("forgot return:", v));

// 2. the executor runs synchronously; resolve only once
const p = new Promise((resolve) => {
  console.log("executor runs now");
  resolve("first");
  resolve("second");                 // ignored
});
p.then((v) => console.log("settled with:", v));
```

```text filename:Output
executor runs now
settled with: first
forgot return: undefined
```

> [!WARNING] Watch out
>
> An unhandled rejection crashes Node (since v15) and logs an error in browsers. Every promise chain needs a `.catch` at the end (or an `await` inside `try/catch`).

# Promise.resolve / reject / withResolvers

```javascript filename:JavaScript
console.log(await Promise.resolve(42));
const p = Promise.resolve(Promise.resolve("nested"));   // promises flatten
console.log(await p);

const { promise, resolve } = Promise.withResolvers();     // ES2024
setTimeout(() => resolve("resolved from outside"), 5);
console.log(await promise);
await Promise.reject(new Error("x")).catch((e) => console.log("rejected with", e.message));
```

```text filename:Output
42
nested
resolved from outside
rejected with x
```

```question
What are the states of a Promise?

---

Pending, fulfilled and rejected. Fulfilled and rejected are together called <em>settled</em>; a settled promise is immutable, and handlers attached later still run (asynchronously) with the settled value.
```

```question
Why do promise callbacks run asynchronously even if the promise is already resolved?

---

Handlers are always queued as microtasks, never called synchronously. This guarantees consistent ordering — code after `.then(...)` always runs before the handler, whether the promise was already settled or not.
```
