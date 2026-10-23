---
id: 144fdeab-b9d1-720b-8462-d39d56d809c0
key: topic:javascript/call-apply-bind
subject: javascript
topic: call-apply-bind
title: call, apply & bind
slug: call-apply-bind
order: 1
---

Three methods on every function that let you choose `this` explicitly — invoke now (`call`, `apply`) or later (`bind`).

| Method | Invokes immediately? | Arguments | Returns |
| --- | --- | --- | --- |
| `fn.call(thisArg, a, b)` | Yes | Listed one by one | The function's result |
| `fn.apply(thisArg, [a, b])` | Yes | As an array | The function's result |
| `fn.bind(thisArg, a)` | No | Pre-filled (partial application) | A new bound function |

```javascript filename:JavaScript
function introduce(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`;
}
const asha = { name: "Asha" };
console.log(introduce.call(asha, "Hello", "!"));
console.log(introduce.apply(asha, ["Hi", "."]));
const boundHey = introduce.bind(asha, "Hey");
console.log(boundHey("?"));
```

```text filename:Output
Hello, I'm Asha!
Hi, I'm Asha.
Hey, I'm Asha?
```

# Classic uses

```javascript filename:JavaScript
// borrow array methods for array-likes
function joinArgs() {
  return Array.prototype.join.call(arguments, "-");
}
console.log(joinArgs("a", "b", "c"));

// apply spreads an array (pre-ES6 alternative to Math.max(...nums))
console.log(Math.max.apply(null, [3, 7, 2]));

// partial application with bind
const multiply = (a, b) => a * b;
const double = multiply.bind(null, 2);
console.log(double(21));
```

```text filename:Output
a-b-c
7
42
```

# bind is permanent

```javascript filename:JavaScript
function whoAmI() { return this.id; }
const bound = whoAmI.bind({ id: "first" });
const rebound = bound.bind({ id: "second" });
console.log(bound(), rebound(), bound.call({ id: "third" }));
console.log(bound.name);

const arrow = () => this;
console.log(arrow.call({ id: 1 }));   // arrows ignore call/apply/bind for this
```

```text filename:Output
first first first
bound whoAmI
undefined
```

> [!NOTE] Key point
>
> `new` beats `bind`: calling a bound function with `new` ignores the bound `this` (but keeps pre-filled arguments).

```question
What is the difference between call, apply and bind?

---

All three set `this` explicitly. `call` invokes immediately with arguments listed individually; `apply` invokes immediately with arguments as an array; `bind` doesn't invoke — it returns a new function with `this` (and optionally leading arguments) permanently fixed.
```
