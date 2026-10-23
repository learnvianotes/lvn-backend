---
id: f6161980-dc3b-7d4e-9494-c4d8b23ae7f5
key: topic:javascript/control-flow
subject: javascript
topic: control-flow
title: Control Flow & Loops
slug: control-flow-loops
order: 1
---

`if`/`else`, `switch`, the ternary, five kinds of loop, and `break`/`continue` with labels.

# Conditionals

```javascript filename:JavaScript
const grade = (score) => {
  if (score >= 90) return "A";
  else if (score >= 75) return "B";
  else return "C";
};
console.log(grade(95), grade(80), grade(10));
const age = 20;
console.log(age >= 18 ? "adult" : "minor");
```

```text filename:Output
A B C
adult
```

# `switch` uses strict equality and falls through

```javascript filename:JavaScript
function kind(day) {
  switch (day) {
    case "sat":
    case "sun":
      return "weekend";
    case 1:
      return "number one";
    default:
      return "weekday";
  }
}
console.log(kind("sun"), kind("mon"), kind(1), kind("1"));

let log = [];
switch (2) {
  case 1: log.push(1);
  case 2: log.push(2);   // no break → falls through
  case 3: log.push(3);
    break;
  case 4: log.push(4);
}
console.log(log);
```

```text filename:Output
weekend weekday number one weekday
[ 2, 3 ]
```

# Loops

| Loop | Iterates over | Use for |
| --- | --- | --- |
| `for (init; cond; step)` | a counter | index-based work, early exit |
| `while (cond)` | until the condition fails | unknown number of iterations |
| `do { } while (cond)` | at least once | prompts / retries |
| `for (const x of iterable)` | <strong>values</strong> of arrays, strings, maps, sets, generators | the default for arrays |
| `for (const k in object)` | enumerable <strong>keys</strong> (incl. inherited) as strings | plain objects only |
| `arr.forEach(fn)` | array elements | side effects; cannot `break` |

```javascript filename:JavaScript
const arr = ["a", "b"];
arr.extra = "!";
for (const i in arr) console.log("in:", i, typeof i);
for (const v of arr) console.log("of:", v);
for (const [i, v] of arr.entries()) console.log(i, v);
for (const ch of "hi") console.log(ch);
```

```text filename:Output
in: 0 string
in: 1 string
in: extra string
of: a
of: b
0 a
1 b
h
i
```

> [!WARNING] Watch out
>
> Never use `for…in` on arrays: keys are strings, order is not guaranteed by intent, and it also visits extra/inherited enumerable properties. Use `for…of`.

# while / do…while

```javascript filename:JavaScript
let n = 1;
while (n < 100) n *= 3;
console.log(n);
let tries = 0;
do {
  tries++;
} while (false);
console.log(tries);
```

```text filename:Output
243
1
```

# break, continue and labels

```javascript filename:JavaScript
for (let i = 0; i < 6; i++) {
  if (i === 1) continue;
  if (i === 4) break;
  console.log(i);
}
outer: for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    if (c === 1) continue outer;
    if (r === 2) break outer;
    console.log(`r${r}c${c}`);
  }
}
```

```text filename:Output
0
2
3
r0c0
r1c0
```

```question
What is the difference between for...in and for...of?

---

`for…in` iterates over the enumerable <em>property keys</em> (strings) of an object, including inherited ones. `for…of` iterates over the <em>values</em> produced by an iterable (arrays, strings, Map, Set, generators). Use `for…of` for arrays and `Object.entries(obj)` with `for…of` for objects.
```

```question
Can you break out of forEach?

---

No — `break` is a syntax error inside the callback and `return` only skips to the next element. Use `for…of`, or `some`/`every`/`find`, which stop early.
```
