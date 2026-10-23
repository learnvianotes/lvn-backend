---
id: 909f757a-ef20-7427-9584-84b3e93a20f0
key: topic:javascript/iife-recursion-pure
subject: javascript
topic: iife-recursion-pure
title: IIFE, Recursion & Pure Functions
slug: iife-recursion-pure-functions
order: 1
---

Three function ideas that show up constantly: run-once scopes, functions that call themselves, and functions with no side effects.

# IIFE — Immediately Invoked Function Expression

```javascript filename:JavaScript
const config = (() => {
  const env = "production";            // not visible outside
  return { env, debug: env !== "production" };
})();
console.log(config);

(function named() {
  console.log("runs immediately");
})();
```

```text filename:Output
{ env: 'production', debug: false }
runs immediately
```

> [!NOTE] Key point
>
> IIFEs were the pre-module way to avoid polluting the global scope. Today ES modules and block scope cover most uses; you still see them for one-off `async` setup: `(async () => { … })()`.

# Recursion

```javascript filename:JavaScript
const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));
const flatten = (arr) =>
  arr.reduce((acc, x) => (Array.isArray(x) ? acc.concat(flatten(x)) : acc.concat(x)), []);
function fib(n, memo = {}) {
  if (n <= 1) return n;
  return (memo[n] ??= fib(n - 1, memo) + fib(n - 2, memo));
}
console.log(factorial(5), flatten([1, [2, [3, [4]]]]), fib(50));
```

```text filename:Output
120 [ 1, 2, 3, 4 ] 12586269025
```

> [!WARNING] Watch out
>
> There is no practical tail-call optimisation in V8 or SpiderMonkey (only Safari implements it). Deep recursion (≈10k frames) throws `RangeError: Maximum call stack size exceeded` — convert to a loop or an explicit stack.

# Pure functions and side effects

> [!NOTE] Pure
>
> Same input → same output, and no side effects (no mutation of arguments/globals, no I/O). Easy to test, cache and reason about.

> [!NOTE] Impure
>
> Reads or writes outside state: `Math.random()`, `Date.now()`, DOM, network, mutating a parameter.

```javascript filename:JavaScript
const addItemImpure = (cart, item) => { cart.push(item); return cart; };
const addItemPure = (cart, item) => [...cart, item];

const cart = ["apple"];
const next = addItemPure(cart, "pear");
console.log(cart, next);
addItemImpure(cart, "plum");
console.log(cart);
```

```text filename:Output
[ 'apple' ] [ 'apple', 'pear' ]
[ 'apple', 'plum' ]
```

```question
What is a pure function and why does it matter?

---

A function whose output depends only on its inputs and that causes no observable side effects. Pure functions are predictable, trivially testable, safe to memoize and parallelise, and are the basis of React reducers and Redux.
```
