---
id: d03cc763-b853-7505-8b2d-911e692a55d6
key: topic:javascript/promise-combinators
subject: javascript
topic: promise-combinators
title: Promise.all, allSettled, race & any
slug: promise-all-allsettled-race-any
order: 1
---

Four static methods run many promises concurrently and combine the results — they differ only in <em>when they settle</em> and <em>what counts as failure</em>.

| Method | Fulfils when | Rejects when | Result |
| --- | --- | --- | --- |
| `Promise.all` | <strong>All</strong> fulfil | <strong>Any</strong> rejects (fail-fast) | Array of values, in input order |
| `Promise.allSettled` | All settle | Never | Array of `{status, value \&#124; reason}` |
| `Promise.race` | The <strong>first to settle</strong> fulfils | The first to settle rejects | That one value/reason |
| `Promise.any` | The <strong>first to fulfil</strong> | <strong>All</strong> reject | Value, or `AggregateError` |

```javascript filename:JavaScript
const ok = (ms, v) => new Promise((res) => setTimeout(() => res(v), ms));
const bad = (ms, msg) => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));

console.log("all:", await Promise.all([ok(30, "a"), ok(10, "b"), 42]));
await Promise.all([ok(10, "a"), bad(5, "db down")]).catch((e) => console.log("all rejected:", e.message));

const settled = await Promise.allSettled([ok(5, "a"), bad(5, "nope")]);
console.log(settled.map((r) => (r.status === "fulfilled" ? r : { ...r, reason: r.reason.message })));

console.log("race:", await Promise.race([ok(20, "slow"), ok(5, "fast")]));
console.log("any:", await Promise.any([bad(5, "x"), ok(15, "first success")]));
try {
  await Promise.any([bad(5, "e1"), bad(5, "e2")]);
} catch (e) {
  console.log(e.constructor.name, e.errors.map((x) => x.message));
}
```

```text filename:Output
all: [ 'a', 'b', 42 ]
all rejected: db down
[
  { status: 'fulfilled', value: 'a' },
  { status: 'rejected', reason: 'nope' }
]
race: fast
any: first success
AggregateError [ 'e1', 'e2' ]
```

> [!NOTE] Key point
>
> `Promise.all` rejects fast, but the other operations <strong>keep running</strong> — promises are not cancellable. Use an `AbortController` if you need to stop them.

# Pattern: timeout with race

```javascript filename:JavaScript
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms));
const slowFetch = new Promise((res) => setTimeout(() => res("data"), 50));
try {
  await Promise.race([slowFetch, timeout(10)]);
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
timed out after 10ms
```

# Sequential vs parallel

```javascript filename:JavaScript
const job = (id, log) => new Promise((res) => setTimeout(() => { log.push(id); res(id); }, 10 * (4 - id)));

const seq = [];
for (const id of [1, 2, 3]) await job(id, seq);          // one after another
console.log("sequential finish order:", seq);

const par = [];
const results = await Promise.all([1, 2, 3].map((id) => job(id, par)));  // all at once
console.log("parallel finish order:", par, "results:", results);
```

```text filename:Output
sequential finish order: [ 1, 2, 3 ]
parallel finish order: [ 3, 2, 1 ] results: [ 1, 2, 3 ]
```

```question
Promise.all vs Promise.allSettled?

---

`all` fails fast: it rejects with the first error and you lose the other results. `allSettled` always waits for every promise and reports each outcome, so use it when partial success is acceptable (e.g. sending many notifications).
```

```question
race vs any?

---

`race` settles with the first promise to settle, success or failure. `any` ignores rejections and fulfils with the first success; it rejects only if all reject (with an `AggregateError`).
```
