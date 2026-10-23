---
id: e45440a8-fffc-7e0f-8abb-f944c803c485
key: topic:javascript/async-iteration
subject: javascript
topic: async-iteration
title: Async Iterators & for await
slug: async-iterators-for-await
order: 1
---

When values arrive over time — pages of an API, lines of a file, chunks of a stream — async generators and `for await…of` let you loop over them naturally.

# Async generators

```javascript filename:JavaScript
const fakeApi = (page) =>
  new Promise((r) => setTimeout(() => r({ items: [`p${page}-a`, `p${page}-b`], next: page < 3 ? page + 1 : null }), 5));

async function* paginate() {
  let page = 1;
  while (page) {
    const { items, next } = await fakeApi(page);
    yield* items;
    page = next;
  }
}
for await (const item of paginate()) {
  console.log(item);
  if (item === "p3-a") break;
}
```

```text filename:Output
p1-a
p1-b
p2-a
p2-b
p3-a
```

# for await over promises and streams

```javascript filename:JavaScript
const delays = [30, 10, 20].map((ms) => new Promise((r) => setTimeout(() => r(ms), ms)));
for await (const ms of delays) console.log("resolved", ms);   // in ARRAY order, not finish order

import { Readable } from "node:stream";
const stream = Readable.from(["chunk1", "chunk2"]);
for await (const chunk of stream) console.log(chunk);

const collected = await Array.fromAsync(paginateSmall());      // ES2024
async function* paginateSmall() { yield 1; yield 2; }
console.log(collected);
```

```text filename:Output
resolved 30
resolved 10
resolved 20
chunk1
chunk2
[ 1, 2 ]
```

```question
What is the difference between for...of and for await...of?

---

`for await…of` calls `[Symbol.asyncIterator]()` (falling back to the sync iterator) and awaits each value before the loop body runs, so it can consume async generators, streams and arrays of promises. It is only allowed in async functions and module top level.
```
