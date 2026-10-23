---
id: 3ee5a4a6-f773-7636-b47d-f4691ccfbec0
key: topic:javascript/functions
subject: javascript
topic: functions
title: "Functions: Declarations, Expressions & Arrows"
slug: functions-declarations-expressions-arrows
order: 1
---

Functions are first-class objects: create them three ways, pass them around, return them — and pick arrows or regular functions for the right reasons.

# Three ways to define a function

```javascript filename:JavaScript
// 1. Declaration — hoisted completely
function add(a, b) {
  return a + b;
}
// 2. Expression — a value assigned to a variable (optionally named)
const multiply = function mul(a, b) {
  return a * b;
};
// 3. Arrow function (ES2015) — concise, lexical `this`
const square = (x) => x * x;
const makePoint = (x, y) => ({ x, y });   // wrap object literals in ( )

console.log(add(2, 3), multiply(2, 3), square(4), makePoint(1, 2));
console.log(multiply.name, square.name, add.length);
```

```text filename:Output
5 6 16 { x: 1, y: 2 }
mul square 2
```

# Declarations are hoisted, expressions are not

```javascript filename:JavaScript
console.log(early());          // works: whole declaration is hoisted
function early() { return "declared"; }

try {
  late();
} catch (e) {
  console.log(e.name + ": " + e.message);
}
const late = () => "expression";
```

```text filename:Output
declared
ReferenceError: Cannot access 'late' before initialization
```

# Arrow vs regular functions

|  | Regular `function` | Arrow `=>` |
| --- | --- | --- |
| `this` | Set by <em>how it is called</em> | Inherited from the enclosing scope (lexical) |
| `arguments` | Yes | No (use rest `...args`) |
| Can be used with `new` | Yes | No — TypeError |
| `prototype` property | Yes | No |
| Hoisting | Declarations are hoisted | Like any `const` — TDZ |
| Best for | Methods, constructors, generators | Callbacks, short transforms, keeping outer `this` |

```javascript filename:JavaScript
const Arrow = () => {};
try {
  new Arrow();
} catch (e) {
  console.log(e.message);
}
console.log(Arrow.prototype, typeof function () {}.prototype);
```

```text filename:Output
Arrow is not a constructor
undefined object
```

# Functions are objects

```javascript filename:JavaScript
function greet(name) { return `Hi ${name}`; }
greet.calls = 0;                       // attach properties like any object
const fns = [greet, (s) => s.toUpperCase()];
console.log(fns.map((f) => f("x")));
console.log(typeof greet, greet instanceof Object, greet);
```

```text filename:Output
[ 'Hi x', 'X' ]
function true [Function: greet] { calls: 0 }
```

# Return values

- A function without `return` (or with a bare `return;`) returns `undefined`.
- Arrow with a <em>concise body</em> (`x => x * 2`) returns the expression; with braces you need `return`.
- Automatic semicolon insertion: `return` followed by a newline returns `undefined` — keep the value on the same line.

```javascript filename:JavaScript
function broken() {
  return
    { ok: true };
}
const withBraces = (x) => { x * 2 };
console.log(broken(), withBraces(2));
```

```text filename:Output
undefined undefined
```

```question
What is the difference between a function declaration and a function expression?

---

A declaration (`function f() {}`) is a statement that is hoisted with its body, so it can be called before it appears. An expression creates the function as a value (assigned to a variable, passed as an argument); it only exists once that line runs.
```

```question
When should you NOT use an arrow function?

---

As an object method that needs `this` to be the object, as a constructor, as a prototype method, as an event handler that needs `this` to be the element, or when you need `arguments` or a generator.
```
