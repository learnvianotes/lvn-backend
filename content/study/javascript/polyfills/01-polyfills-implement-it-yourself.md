---
id: e2d20395-a57c-78af-85f2-1330aa8f94e8
key: topic:javascript/polyfills
subject: javascript
topic: polyfills
title: "Polyfills: Implement It Yourself"
slug: polyfills-implement-it-yourself
order: 1
---

Re-implementing built-ins is the classic way interviewers test understanding of `this`, prototypes, closures and promises. Each implementation below is tested against the real thing.

# Array.prototype.map / filter / reduce

```javascript filename:JavaScript
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");
  const result = new Array(this.length);
  for (let i = 0; i < this.length; i++) {
    if (i in this) result[i] = callback.call(thisArg, this[i], i, this);   // skip holes
  }
  return result;
};
Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) result.push(this[i]);
  }
  return result;
};
Array.prototype.myReduce = function (callback, ...init) {
  let i = 0, acc;
  if (init.length) acc = init[0];
  else {
    while (i < this.length && !(i in this)) i++;
    if (i >= this.length) throw new TypeError("Reduce of empty array with no initial value");
    acc = this[i++];
  }
  for (; i < this.length; i++) if (i in this) acc = callback(acc, this[i], i, this);
  return acc;
};

const nums = [1, 2, 3, 4];
console.log(nums.myMap((n) => n * 2), nums.map((n) => n * 2));
console.log(nums.myFilter((n) => n % 2), nums.myReduce((a, b) => a + b), nums.myReduce((a, b) => a + b, 10));
console.log([1, , 3].myMap((x) => x), [1, , 3].map((x) => x));
```

```text filename:Output
[ 2, 4, 6, 8 ] [ 2, 4, 6, 8 ]
[ 1, 3 ] 10 20
[ 1, <1 empty item>, 3 ] [ 1, <1 empty item>, 3 ]
```

# Function.prototype.bind / call

```javascript filename:JavaScript
Function.prototype.myCall = function (context, ...args) {
  context = context ?? globalThis;
  const key = Symbol("fn");                 // unique key: no clash with existing props
  context[key] = this;
  try {
    return context[key](...args);           // implicit binding does the work
  } finally {
    delete context[key];
  }
};
Function.prototype.myBind = function (context, ...preset) {
  const fn = this;
  function bound(...later) {
    // when called with `new`, ignore the bound context
    return new.target ? new fn(...preset, ...later) : fn.apply(context, [...preset, ...later]);
  }
  bound.prototype = Object.create(fn.prototype);
  return bound;
};

function intro(greeting, mark) { return `${greeting}, ${this.name}${mark}`; }
const asha = { name: "Asha" };
console.log(intro.myCall(asha, "Hello", "!"));
console.log(intro.myBind(asha, "Hi")("?"), Object.keys(asha));

function Point(x, y) { this.x = x; this.y = y; }
const PointAtX1 = Point.myBind(null, 1);
const p = new PointAtX1(2);
console.log(p.x, p.y, p instanceof Point);
```

```text filename:Output
Hello, Asha!
Hi, Asha? [ 'name' ]
1 2 true
```

# Promise.all and Promise.allSettled

```javascript filename:JavaScript
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;                 // keep INPUT order, not finish order
        if (--remaining === 0) resolve(results);
      }, reject);                           // first rejection wins
    });
  });
}
const promiseAllSettled = (iterable) =>
  promiseAll([...iterable].map((p) =>
    Promise.resolve(p).then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason })
    )));

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
console.log(await promiseAll([delay(20, "slow"), delay(5, "fast"), 3]));
console.log(await promiseAll([]));
await promiseAll([delay(5, 1), Promise.reject(new Error("fail"))]).catch((e) => console.log(e.message));
console.log(await promiseAllSettled([1, Promise.reject("no")]));
```

```text filename:Output
[ 'slow', 'fast', 3 ]
[]
fail
[
  { status: 'fulfilled', value: 1 },
  { status: 'rejected', reason: 'no' }
]
```

# Promise.race and a mini Promise

```javascript filename:JavaScript
const promiseRace = (iterable) =>
  new Promise((resolve, reject) => {
    for (const p of iterable) Promise.resolve(p).then(resolve, reject);
  });

class MyPromise {
  #state = "pending"; #value; #handlers = [];
  constructor(executor) {
    const settle = (state) => (value) => {
      if (this.#state !== "pending") return;
      if (state === "fulfilled" && value && typeof value.then === "function") {
        return value.then(settle("fulfilled"), settle("rejected"));   // adopt thenables
      }
      this.#state = state; this.#value = value;
      this.#handlers.forEach((h) => h());
    };
    try { executor(settle("fulfilled"), settle("rejected")); } catch (e) { settle("rejected")(e); }
  }
  then(onFul, onRej) {
    return new MyPromise((resolve, reject) => {
      const run = () => queueMicrotask(() => {
        const cb = this.#state === "fulfilled" ? onFul : onRej;
        if (typeof cb !== "function") return (this.#state === "fulfilled" ? resolve : reject)(this.#value);
        try { resolve(cb(this.#value)); } catch (e) { reject(e); }
      });
      this.#state === "pending" ? this.#handlers.push(run) : run();
    });
  }
  catch(onRej) { return this.then(undefined, onRej); }
}

console.log(await promiseRace([new Promise((r) => setTimeout(r, 20, "slow")), "instant"]));
new MyPromise((res) => setTimeout(res, 5, 2))
  .then((v) => v * 10)
  .then((v) => { throw new Error(`boom at ${v}`); })
  .catch((e) => e.message)
  .then((msg) => console.log("MyPromise chain:", msg));
const value = await new MyPromise((res) => res(new MyPromise((r) => r("adopted"))));
console.log(value);
```

```text filename:Output
instant
adopted
MyPromise chain: boom at 20
```

# Deep clone, deep equal, flatten

```javascript filename:JavaScript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (seen.has(value)) return seen.get(value);            // handle cycles
  if (value instanceof Map) {
    const m = new Map(); seen.set(value, m);
    value.forEach((v, k) => m.set(deepClone(k, seen), deepClone(v, seen)));
    return m;
  }
  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) copy[key] = deepClone(value[key], seen);
  return copy;
}
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const ka = Reflect.ownKeys(a), kb = Reflect.ownKeys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}
const flatten = (arr, depth = Infinity) =>
  depth < 1 ? arr.slice() : arr.reduce((acc, x) => acc.concat(Array.isArray(x) ? flatten(x, depth - 1) : [x]), []);

const src = { d: new Date(0), list: [1, { two: 2 }], map: new Map([["k", [1]]]) };
src.self = src;
const copy = deepClone(src);
console.log(copy.self === copy, copy.list[1] !== src.list[1], copy.map.get("k"));
console.log(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), deepEqual([1], { 0: 1 }));
console.log(flatten([1, [2, [3, [4]]]]), flatten([1, [2, [3]]], 1));
```

```text filename:Output
true true [ 1 ]
true false
[ 1, 2, 3, 4 ] [ 1, 2, [ 3 ] ]
```

# A tiny EventEmitter

```javascript filename:JavaScript
class Emitter {
  #events = new Map();
  on(name, fn) {
    (this.#events.get(name) ?? this.#events.set(name, []).get(name)).push(fn);
    return () => this.off(name, fn);        // return an unsubscribe function
  }
  off(name, fn) {
    this.#events.set(name, (this.#events.get(name) ?? []).filter((f) => f !== fn && f.original !== fn));
  }
  once(name, fn) {
    const wrapper = (...args) => { this.off(name, wrapper); fn(...args); };
    wrapper.original = fn;
    return this.on(name, wrapper);
  }
  emit(name, ...args) {
    const list = [...(this.#events.get(name) ?? [])];   // copy: listeners may unsubscribe
    list.forEach((fn) => fn(...args));
    return list.length > 0;
  }
}
const e = new Emitter();
const unsubscribe = e.on("msg", (m) => console.log("A got", m));
e.once("msg", (m) => console.log("B (once) got", m));
e.emit("msg", 1);
e.emit("msg", 2);
unsubscribe();
console.log(e.emit("msg", 3));
```

```text filename:Output
A got 1
B (once) got 1
A got 2
false
```

> [!WARNING] Watch out
>
> Real polyfills check `if (!Array.prototype.x)` before defining, use `Object.defineProperty` to stay non-enumerable, and follow the spec's edge cases. In production, use core-js rather than hand-written versions.

```question
Why does a correct Promise.all polyfill need a counter instead of checking results.length?

---

Results are written by index as promises settle in any order; assigning `results[2]` first makes `length` 3 immediately. A countdown of pending items is the reliable completion signal.
```
