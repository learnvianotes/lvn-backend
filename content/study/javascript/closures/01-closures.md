---
id: 6e501553-4e38-7118-b910-7d47dd4a8d21
key: topic:javascript/closures
subject: javascript
topic: closures
title: Closures
slug: closures
order: 1
---

A closure is a function bundled with the variables of the scope where it was created — it keeps them alive even after that scope has returned.

> [!INFO]
>
> <strong>Closure</strong> — the combination of a function and its <strong>lexical environment</strong>. Every JavaScript function is a closure; it becomes interesting when the function outlives the scope it was defined in.

# The basic example

```javascript filename:JavaScript
function makeCounter() {
  let count = 0;               // private: only the returned functions can see it
  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
}
const a = makeCounter();
const b = makeCounter();       // independent environment
a.increment(); a.increment(); a.increment();
b.decrement();
console.log(a.value(), b.value(), a.count);
```

```text filename:Output
3 -1 undefined
```

# What closures are used for

> [!NOTE] Data privacy
>
> Variables that no outside code can touch — the <em>module pattern</em> before classes had `#private`.

> [!NOTE] Function factories
>
> `makeMultiplier(3)` returns a function that remembers `3`.

> [!NOTE] Callbacks & handlers
>
> Event handlers and timers remember the data they were created with.

> [!NOTE] Memoization, once, debounce
>
> Caches and timers kept between calls.

```javascript filename:JavaScript
const makeMultiplier = (factor) => (n) => n * factor;
const double = makeMultiplier(2), triple = makeMultiplier(3);
console.log(double(5), triple(5));

function once(fn) {
  let done = false, result;
  return (...args) => {
    if (!done) { done = true; result = fn(...args); }
    return result;
  };
}
const init = once(() => { console.log("initialising…"); return 42; });
console.log(init(), init());
```

```text filename:Output
10 15
initialising…
42 42
```

# Closures capture variables, not values

```javascript filename:JavaScript
let message = "first";
const say = () => message;
message = "second";
console.log(say());          // reads the variable's CURRENT value
```

```text filename:Output
second
```

# The loop + closure interview classic

```javascript filename:JavaScript
for (var i = 1; i <= 3; i++) {
  setTimeout(() => console.log("var:", i), 0);
}
for (let j = 1; j <= 3; j++) {
  setTimeout(() => console.log("let:", j), 0);
}
// pre-ES6 fix: an IIFE creates a new scope per iteration
for (var k = 1; k <= 3; k++) {
  ((k) => setTimeout(() => console.log("iife:", k), 0))(k);
}
```

```text filename:Output
var: 4
var: 4
var: 4
let: 1
let: 2
let: 3
iife: 1
iife: 2
iife: 3
```

# Module pattern with an IIFE

```javascript filename:JavaScript
const bank = (function () {
  let balance = 0;                              // private
  function log(msg) { return `[bank] ${msg}`; } // private
  return {
    deposit(amount) { balance += amount; return log(`+${amount}`); },
    get balance() { return balance; },
  };
})();
console.log(bank.deposit(50), bank.balance, bank.log);
```

```text filename:Output
[bank] +50 50 undefined
```

> [!WARNING] Memory
>
> A closure keeps its <strong>whole</strong> environment reachable. A long-lived closure (event listener, interval, cache) that references a big object keeps that object in memory — a common leak.

```question
What is a closure? Give a practical use.

---

A function together with references to the variables of the scope it was defined in; it can read and update them even after the outer function returned. Uses: private state (counters, module pattern), function factories, memoization caches, `once`, debounce/throttle, and preserving data in async callbacks.
```

```question
Why does the var loop print 4, 4, 4?

---

`var` is function-scoped, so all three callbacks close over the <em>same</em> `i`. The callbacks run after the loop finished, when `i` is 4. `let` creates a new binding for each iteration, so each callback gets its own value.
```
