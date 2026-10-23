---
id: 049c8908-9662-78c0-9442-01c71714b67c
key: topic:javascript/generators
subject: javascript
topic: generators
title: Generators
slug: generators
order: 1
---

A generator is a function that can pause (`yield`) and resume later, producing a sequence of values on demand.

# Basics

```javascript filename:JavaScript
function* countdown(n) {
  console.log("started");
  while (n > 0) yield n--;
  return "liftoff";
}
const gen = countdown(2);          // nothing runs yet
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
console.log([...countdown(3)]);    // return value is not included by for…of / spread
```

```text filename:Output
started
{ value: 2, done: false }
{ value: 1, done: false }
{ value: 'liftoff', done: true }
{ value: undefined, done: true }
started
[ 3, 2, 1 ]
```

# Lazy and infinite sequences

```javascript filename:JavaScript
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
const out = [];
for (const f of fibonacci()) {
  if (f > 50) break;          // break calls gen.return() — clean exit
  out.push(f);
}
console.log(out.join(" "));

function* take(iter, n) { for (const x of iter) { if (n-- <= 0) return; yield x; } }
console.log([...take(fibonacci(), 5)]);
```

```text filename:Output
0 1 1 2 3 5 8 13 21 34
[ 0, 1, 1, 2, 3 ]
```

# Two-way communication

```javascript filename:JavaScript
function* conversation() {
  const name = yield "What's your name?";
  const lang = yield `Hi ${name}! Favourite language?`;
  return `${name} likes ${lang}`;
}
const chat = conversation();
console.log(chat.next().value);             // runs to the first yield
console.log(chat.next("Asha").value);       // "Asha" becomes the result of that yield
console.log(chat.next("JavaScript"));
```

```text filename:Output
What's your name?
Hi Asha! Favourite language?
{ value: 'Asha likes JavaScript', done: true }
```

# `yield*` delegation and generator methods

```javascript filename:JavaScript
class Tree {
  constructor(value, children = []) { this.value = value; this.children = children; }
  *[Symbol.iterator]() {               // depth-first traversal
    yield this.value;
    for (const child of this.children) yield* child;
  }
}
const tree = new Tree("root", [new Tree("a", [new Tree("a1")]), new Tree("b")]);
console.log([...tree]);
```

```text filename:Output
[ 'root', 'a', 'a1', 'b' ]
```

| Method | Effect |
| --- | --- |
| `gen.next(v)` | Resume; `v` becomes the value of the paused `yield` |
| `gen.return(v)` | Finish early (runs `finally` blocks) |
| `gen.throw(err)` | Throw `err` at the paused `yield` (catchable inside) |

```question
What is the difference between a generator and a normal function?

---

A normal function runs to completion when called. A generator function returns an iterator immediately without running; each `next()` runs it until the next `yield`, keeping its local state between calls. That makes it ideal for lazy sequences, custom iterators and (historically) async flow control.
```
