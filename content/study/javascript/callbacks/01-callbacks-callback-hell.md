---
id: 691df788-53e9-742b-bb22-6e8eace4e246
key: topic:javascript/callbacks
subject: javascript
topic: callbacks
title: Callbacks & Callback Hell
slug: callbacks-callback-hell
order: 1
---

The original async pattern: pass a function to be called when the work is done. Simple — until you nest five of them.

# Error-first callbacks (Node convention)

```javascript filename:JavaScript
function readUser(id, callback) {
  setTimeout(() => {
    if (id <= 0) callback(new Error("invalid id"));
    else callback(null, { id, name: "User" + id });
  }, 10);
}
readUser(7, (err, user) => {
  if (err) return console.log("failed:", err.message);
  console.log("got", user);
});
readUser(-1, (err, user) => {
  if (err) return console.log("failed:", err.message);
  console.log("got", user);
});
```

```text filename:Output
got { id: 7, name: 'User7' }
failed: invalid id
```

# Callback hell (the pyramid of doom)

```javascript filename:JavaScript
const step = (name, cb) => setTimeout(() => cb(null, name), 5);
step("login", (err, a) => {
  step("load profile", (err, b) => {
    step("load orders", (err, c) => {
      step("render", (err, d) => {
        console.log([a, b, c, d].join(" → "));
      });
    });
  });
});
```

```text filename:Output
login → load profile → load orders → render
```

| Problem | Why it hurts |
| --- | --- |
| Nesting | Code drifts right; hard to read and refactor |
| Error handling | Must check `err` at every level; `try/catch` cannot catch errors thrown in later callbacks |
| Inversion of control | You trust the callee to call you exactly once, not zero or twice, not sync <em>and</em> async |
| Composition | Parallel work, timeouts and "first one wins" need hand-written bookkeeping |

# Promisify

```javascript filename:JavaScript
import { promisify } from "node:util";
function legacyAdd(a, b, cb) { setTimeout(() => cb(null, a + b), 5); }

const addAsync = promisify(legacyAdd);
console.log(await addAsync(2, 3));

const manual = (a, b) =>
  new Promise((resolve, reject) => legacyAdd(a, b, (err, v) => (err ? reject(err) : resolve(v))));
console.log(await manual(10, 20));
```

```text filename:Output
5
30
```

```question
What is callback hell and how do you avoid it?

---

Deeply nested callbacks for sequential async steps, which make code hard to read, reason about and handle errors in. Avoid it with named functions, promises and chaining, and most of all `async`/`await`.
```
