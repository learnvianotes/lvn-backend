---
id: 7c8c2486-69a5-766b-86c1-153da8cf3105
key: topic:javascript/higher-order-functions
subject: javascript
topic: higher-order-functions
title: Higher-Order Functions & Callbacks
slug: higher-order-functions-callbacks
order: 1
---

A higher-order function takes a function as an argument or returns one. It is the core of functional-style JavaScript.

> [!INFO]
>
> <strong>Higher-order function</strong> — a function that <strong>accepts</strong> a function (a <em>callback</em>) and/or <strong>returns</strong> a function. `map`, `filter`, `setTimeout`, `addEventListener` and `bind` are all higher-order.

# Taking a function

```javascript filename:JavaScript
function repeat(n, action) {
  for (let i = 0; i < n; i++) action(i);
}
repeat(3, (i) => console.log("tick", i));

const applyAll = (value, ...fns) => fns.map((f) => f(value));
console.log(applyAll(9, Math.sqrt, (x) => x * 2, String));
```

```text filename:Output
tick 0
tick 1
tick 2
[ 3, 18, '9' ]
```

# Returning a function

```javascript filename:JavaScript
const greaterThan = (n) => (m) => m > n;
const isAdult = greaterThan(17);
console.log([12, 18, 30].filter(isAdult));

function logged(fn) {
  return function (...args) {
    const result = fn.apply(this, args);
    console.log(`${fn.name}(${args.join(", ")}) = ${result}`);
    return result;
  };
}
const add = logged(function add(a, b) { return a + b; });
add(2, 3);
```

```text filename:Output
[ 18, 30 ]
add(2, 3) = 5
```

# Synchronous vs asynchronous callbacks

```javascript filename:JavaScript
console.log("start");
[1, 2].forEach((n) => console.log("sync callback", n));   // runs now
setTimeout(() => console.log("async callback"), 0);        // runs later
console.log("end");
```

```text filename:Output
start
sync callback 1
sync callback 2
end
async callback
```

# The `parseInt` trap

```javascript filename:JavaScript
console.log(["1", "2", "3"].map(parseInt));
console.log(["1", "2", "3"].map(Number));
console.log(["1", "2", "3"].map((s) => parseInt(s, 10)));
```

```text filename:Output
[ 1, NaN, NaN ]
[ 1, 2, 3 ]
[ 1, 2, 3 ]
```

> [!WARNING] Watch out
>
> `map` calls its callback with `(element, index, array)`. `parseInt` treats the index as the radix: `parseInt('2', 1)` → `NaN`. Wrap callbacks whose extra parameters mean something else.

```question
What is a callback function?

---

A function passed as an argument to another function, to be called by it — either synchronously (array methods) or later (timers, events, I/O).
```
