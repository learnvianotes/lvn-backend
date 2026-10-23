---
id: 6b675ec2-5be5-7130-83b7-99ca5b0145dc
key: topic:javascript/async-await
subject: javascript
topic: async-await
title: async / await
slug: async-await
order: 1
---

`async`/`await` is syntax over promises that lets asynchronous code read top-to-bottom like synchronous code — with ordinary `try/catch` for errors.

# The rules

- An `async` function <strong>always returns a promise</strong> — a returned value is wrapped, a thrown error becomes a rejection.
- `await p` pauses <em>that function</em> (not the thread) until `p` settles, then returns the value or throws the reason.
- `await` works inside `async` functions and at the top level of ES modules.

```javascript filename:JavaScript
async function getNumber() { return 7; }
async function explode() { throw new Error("async boom"); }

console.log(getNumber() instanceof Promise);
console.log(await getNumber());
try {
  await explode();
} catch (e) {
  console.log("caught:", e.message);
}
```

```text filename:Output
true
7
caught: async boom
```

# Rewriting a promise chain

```javascript filename:JavaScript
const db = {
  user: (id) => new Promise((r) => setTimeout(() => r({ id, name: "Asha" }), 5)),
  orders: (user) => new Promise((r) => setTimeout(() => r([{ total: 30 }, { total: 12 }]), 5)),
};

// with then
db.user(1)
  .then((user) => db.orders(user).then((orders) => ({ user, orders })))
  .then(({ user, orders }) => console.log("then:", user.name, orders.length));

// with async/await
async function summary(id) {
  const user = await db.user(id);
  const orders = await db.orders(user);
  const total = orders.reduce((s, o) => s + o.total, 0);
  return `${user.name} spent ${total}`;
}
console.log("await:", await summary(1));
```

```text filename:Output
then: Asha 2
await: Asha spent 42
```

# Do not serialise independent work

```javascript filename:JavaScript
const fetchA = () => new Promise((r) => setTimeout(() => r("A"), 30));
const fetchB = () => new Promise((r) => setTimeout(() => r("B"), 30));

let t = performance.now();
const a1 = await fetchA();
const b1 = await fetchB();                  // waits for A first: ~60 ms
const slow = performance.now() - t;

t = performance.now();
const [a2, b2] = await Promise.all([fetchA(), fetchB()]);   // concurrently: ~30 ms
const fast = performance.now() - t;
console.log(a1 + b1, a2 + b2, slow > 55, fast < 50);
```

```text filename:Output
AB AB true true
```

# await in loops

```javascript filename:JavaScript
const double = (n) => new Promise((r) => setTimeout(() => r(n * 2), 5));
const nums = [1, 2, 3];

const wrong = nums.forEach(async (n) => await double(n));   // forEach ignores promises
console.log("forEach returns:", wrong);

const out = [];
for (const n of nums) out.push(await double(n));            // sequential, correct
console.log(out, await Promise.all(nums.map(double)));      // parallel, correct
```

```text filename:Output
forEach returns: undefined
[ 2, 4, 6 ] [ 2, 4, 6 ]
```

> [!WARNING] Watch out
>
> `array.forEach(async …)` fires all callbacks and returns immediately — nothing waits for them and their errors are unhandled. Use `for…of` with `await` (sequential) or `Promise.all(arr.map(…))` (parallel).

# Error handling patterns

```javascript filename:JavaScript
const risky = (ok) => (ok ? Promise.resolve("data") : Promise.reject(new Error("network")));

// 1. try / catch / finally
async function load() {
  try {
    return await risky(false);     // `return await` so the catch applies
  } catch (e) {
    return `fallback (${e.message})`;
  } finally {
    console.log("hide spinner");
  }
}
console.log(await load());

// 2. Go-style tuple helper
const to = (p) => p.then((v) => [null, v], (e) => [e, null]);
const [err, data] = await to(risky(true));
console.log(err, data);
```

```text filename:Output
hide spinner
fallback (network)
null data
```

```question
What does an async function return?

---

Always a Promise. A returned value resolves it; a thrown error rejects it; a returned promise is adopted.
```

```question
Does await block the thread?

---

No. It suspends only the current async function; the rest of the function becomes a microtask continuation, and the event loop keeps running other code meanwhile.
```
