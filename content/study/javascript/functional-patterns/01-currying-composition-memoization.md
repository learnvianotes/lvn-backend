---
id: a7a86837-5f24-7304-8f49-634c32728773
key: topic:javascript/functional-patterns
subject: javascript
topic: functional-patterns
title: Currying, Composition & Memoization
slug: currying-composition-memoization
order: 1
---

Functional techniques built from closures and higher-order functions — and staple interview implementations.

# Currying

> [!INFO]
>
> <strong>Currying</strong> — transforming `f(a, b, c)` into `f(a)(b)(c)` — a chain of single-argument functions. <em>Partial application</em> is the looser idea of fixing some arguments now and the rest later.

```javascript filename:JavaScript
function curry(fn) {
  return function curried(...args) {
    return args.length >= fn.length
      ? fn.apply(this, args)
      : (...more) => curried.apply(this, [...args, ...more]);
  };
}
const volume = (l, w, h) => l * w * h;
const cv = curry(volume);
console.log(cv(2)(3)(4), cv(2, 3)(4), cv(2)(3, 4), cv(2, 3, 4));

const log = curry((level, scope, msg) => `[${level}] ${scope}: ${msg}`);
const warnDb = log("WARN")("db");
console.log(warnDb("slow query"));
```

```text filename:Output
24 24 24 24
[WARN] db: slow query
```

# Infinite currying: sum(1)(2)(3)()

```javascript filename:JavaScript
const sum = (a) => (b) => (b === undefined ? a : sum(a + b));
console.log(sum(1)(2)(3)(4)());
```

```text filename:Output
10
```

# Composition and pipe

```javascript filename:JavaScript
const compose = (...fns) => (x) => fns.reduceRight((acc, f) => f(acc), x);
const pipe = (...fns) => (x) => fns.reduce((acc, f) => f(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const slugify = (s) => s.replace(/\s+/g, "-");

console.log(pipe(trim, lower, slugify)("  Hello Big World "));
console.log(compose(slugify, lower, trim)("  Hello Big World "));
```

```text filename:Output
hello-big-world
hello-big-world
```

> [!NOTE] Key point
>
> `pipe` runs left → right (reads like a recipe); `compose` right → left (mirrors maths: `f(g(x))`).

# Memoization

```javascript filename:JavaScript
function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function (...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
let calls = 0;
const slowSquare = (n) => { calls++; return n * n; };
const fastSquare = memoize(slowSquare);
console.log(fastSquare(9), fastSquare(9), fastSquare(3), "calls:", calls);

const fib = memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
console.log(fib(90));
```

```text filename:Output
81 81 9 calls: 2
2880067194370816000
```

> [!WARNING] Watch out
>
> Memoize only <strong>pure</strong> functions. An unbounded cache is a memory leak — cap it (LRU) or key it with a `WeakMap` when arguments are objects.

# once, partial and friends

```javascript filename:JavaScript
const partial = (fn, ...preset) => (...later) => fn(...preset, ...later);
const greet = (greeting, name) => `${greeting}, ${name}!`;
console.log(partial(greet, "Welcome")("Mei"));

const not = (pred) => (...args) => !pred(...args);
const isEven = (n) => n % 2 === 0;
console.log([1, 2, 3, 4].filter(not(isEven)));

const tap = (fn) => (x) => { fn(x); return x; };
console.log([1, 2].map(tap((x) => console.log("saw", x))));
```

```text filename:Output
Welcome, Mei!
[ 1, 3 ]
saw 1
saw 2
[ 1, 2 ]
```

```question
Implement a curry function.

---

Return a function that collects arguments; when it has at least `fn.length` of them, call `fn`, otherwise return another function that appends further arguments (see the implementation above).
```

```question
What is memoization?

---

Caching a function's results keyed by its arguments so repeated calls with the same input return instantly. It trades memory for speed and is only correct for pure functions.
```
