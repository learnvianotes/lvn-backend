---
id: 28232e7d-1d2f-76b6-814e-06c4142adaca
key: topic:javascript/node-events-streams
subject: javascript
topic: node-events-streams
title: EventEmitter & Streams
slug: eventemitter-streams
order: 1
---

Most of Node is built on two ideas: objects that emit named events, and streams that move data in chunks instead of loading everything into memory.

# EventEmitter

```javascript filename:JavaScript
import { EventEmitter, once } from "node:events";

class Order extends EventEmitter {
  place(item) {
    this.emit("placed", { item, at: "12:00" });
    if (item === "unknown") this.emit("error", new Error("no such item"));
  }
}
const order = new Order();
order.on("placed", ({ item }) => console.log("email: placed", item));
order.once("placed", () => console.log("analytics: first order only"));
order.on("error", (err) => console.log("handled error:", err.message));

order.place("book");
order.place("unknown");
console.log(order.listenerCount("placed"), order.eventNames());

setTimeout(() => order.emit("shipped", "TRACK-1"), 5);
const [tracking] = await once(order, "shipped");      // promise-based wait
console.log("shipped with", tracking);
```

```text filename:Output
email: placed book
analytics: first order only
email: placed unknown
handled error: no such item
1 [ 'placed', 'error' ]
shipped with TRACK-1
```

> [!WARNING] Watch out
>
> Emitting `'error'` with no `'error'` listener <strong>throws</strong> and crashes the process. Listeners run <strong>synchronously</strong>, in registration order, inside `emit`.

# Streams

| Type | Examples |
| --- | --- |
| Readable | `fs.createReadStream`, HTTP request (server side), `process.stdin` |
| Writable | `fs.createWriteStream`, HTTP response, `process.stdout` |
| Duplex | TCP socket |
| Transform | `zlib.createGzip()`, encryption, parsers |

```javascript filename:JavaScript
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

const source = Readable.from(["alpha\n", "beta\n", "gamma\n"]);
const upper = new Transform({
  transform(chunk, _enc, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});
const collected = [];
const sink = new Writable({
  write(chunk, _enc, callback) {
    collected.push(chunk.toString().trim());
    callback();
  },
});
await pipeline(source, upper, sink);     // handles back-pressure and errors
console.log(collected);
```

```text filename:Output
[ 'ALPHA', 'BETA', 'GAMMA' ]
```

> [!NOTE] Key point
>
> <strong>Back-pressure</strong>: when the consumer is slower than the producer, `pipeline`/`pipe` pause the source so memory stays bounded — the reason to stream a 10 GB file instead of `readFile`-ing it.

```question
Why use streams instead of reading a whole file?

---

Streams process data chunk by chunk, so memory use stays constant regardless of size, work starts before all data arrives, and back-pressure keeps fast producers from overwhelming slow consumers.
```
