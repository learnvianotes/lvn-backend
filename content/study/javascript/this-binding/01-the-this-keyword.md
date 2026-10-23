---
id: e9449562-1a9f-7f17-8f8d-4c626ee679af
key: topic:javascript/this-binding
subject: javascript
topic: this-binding
title: The this Keyword
slug: the-this-keyword
order: 1
---

`this` is decided by <strong>how a function is called</strong>, not where it is written — except in arrow functions, which borrow it from their surroundings.

# The four binding rules (+ arrows)

| Call style | `this` is | Priority |
| --- | --- | --- |
| `new Fn()` | The newly created object | 1 (highest) |
| `fn.call(obj)`, `fn.apply(obj)`, `fn.bind(obj)()` | `obj` (explicit) | 2 |
| `obj.method()` | `obj` (implicit — the object left of the dot) | 3 |
| `fn()` plain call | `undefined` in strict mode, `globalThis` in sloppy mode | 4 (default) |
| Arrow function | `this` of the enclosing scope — never rebound | ignores all rules |

# Implicit binding and how it is lost

```javascript filename:JavaScript
const user = {
  name: "Asha",
  hello() { return `Hi, I'm ${this?.name}`; },
};
console.log(user.hello());          // this = user

const detached = user.hello;        // just a function now
console.log(detached());            // plain call → this is undefined (strict)

const other = { name: "Ravi", hello: user.hello };
console.log(other.hello());         // this = other
```

```text filename:Output
Hi, I'm Asha
Hi, I'm undefined
Hi, I'm Ravi
```

> [!NOTE] Strict vs sloppy
>
> These examples run as an ES module, which is <strong>always strict</strong>: a plain call gets `this === undefined`. In an old-style sloppy script the same call would get the global object (`window` in browsers) — the source of many silent bugs.

```javascript filename:JavaScript
function strictThis() { return this; }
const sloppyThis = new Function("return this");   // Function-constructor code is sloppy
console.log(strictThis());
console.log(sloppyThis() === globalThis);
console.log(this);                                  // top level of a module
```

```text filename:Output
undefined
true
undefined
```

# Lost `this` in callbacks — and the fixes

```javascript filename:JavaScript
class Timer {
  constructor() { this.ticks = 0; }
  startBroken() {
    return [1, 2].map(function () { return this?.ticks; });
  }
  startArrow() {
    return [1, 2].map(() => ++this.ticks);   // arrow: this = the Timer
  }
  startBound() {
    return [1, 2].map(function () { return this.ticks; }.bind(this));
  }
}
const t = new Timer();
console.log(t.startBroken(), t.startArrow(), t.startBound());
```

```text filename:Output
[ undefined, undefined ] [ 1, 2 ] [ 2, 2 ]
```

# Arrow functions as methods: a trap

```javascript filename:JavaScript
const counter = {
  count: 10,
  arrow: () => typeof this,          // this of the module scope → undefined
  regular() { return this.count; },
};
console.log(counter.arrow(), counter.regular());
```

```text filename:Output
undefined 10
```

# `new` binding

```javascript filename:JavaScript
function Person(name) {
  this.name = name;      // `this` is the new object
}
const p = new Person("Mei");
console.log(p, p instanceof Person);
```

```text filename:Output
Person { name: 'Mei' } true
```

```question
How is the value of this determined?

---

By the call site, in priority order: `new` → the new object; `call`/`apply`/`bind` → the given object; method call `obj.f()` → `obj`; plain call → `undefined` (strict) or the global object (sloppy). Arrow functions have no own `this` and use the enclosing scope's.
```

```question
Why does passing obj.method as a callback lose this?

---

Passing `obj.method` passes only the function value; the callback is later invoked as a plain call with no object before the dot, so `this` becomes `undefined`. Fix with an arrow wrapper `() => obj.method()`, `obj.method.bind(obj)`, or class fields with arrow functions.
```
