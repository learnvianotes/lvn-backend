---
id: fd07fa76-b693-7365-a1fd-54d6e6c70eb7
key: topic:javascript/array-methods
subject: javascript
topic: array-methods
title: map, filter & reduce
slug: map-filter-reduce
order: 1
---

The three workhorses of functional JavaScript: transform every item, keep some items, fold everything into one value — without mutating the original.

# map — transform each element

```javascript filename:JavaScript
const prices = [10, 20, 30];
const withTax = prices.map((p) => p * 1.1);
console.log(withTax.map((p) => p.toFixed(2)));
const users = [{ name: "Asha", age: 28 }, { name: "Ravi", age: 17 }];
console.log(users.map(({ name }) => name));
console.log(users.map((u, i) => `${i + 1}. ${u.name}`));
```

```text filename:Output
[ '11.00', '22.00', '33.00' ]
[ 'Asha', 'Ravi' ]
[ '1. Asha', '2. Ravi' ]
```

# filter — keep what passes the test

```javascript filename:JavaScript
const nums = [5, 12, 8, 130, 44];
console.log(nums.filter((n) => n > 10));
const mixed = [0, "a", null, "", 7, undefined, false];
console.log(mixed.filter(Boolean));          // remove falsy values
const unique = [1, 2, 2, 3, 1].filter((x, i, arr) => arr.indexOf(x) === i);
console.log(unique);
```

```text filename:Output
[ 12, 130, 44 ]
[ 'a', 7 ]
[ 1, 2, 3 ]
```

# reduce — fold into a single value

`array.reduce((accumulator, current, index, array) => newAccumulator, initialValue)`

```javascript filename:JavaScript
const nums = [1, 2, 3, 4];
console.log(nums.reduce((sum, n) => sum + n, 0));
console.log(nums.reduce((max, n) => (n > max ? n : max), -Infinity));

const words = ["apple", "avocado", "banana", "cherry", "blueberry"];
const byLetter = words.reduce((groups, w) => {
  (groups[w[0]] ??= []).push(w);
  return groups;
}, {});
console.log(byLetter);

const pairs = [["a", 1], ["b", 2]];
console.log(pairs.reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}));
```

```text filename:Output
10
4
{
  a: [ 'apple', 'avocado' ],
  b: [ 'banana', 'blueberry' ],
  c: [ 'cherry' ]
}
{ a: 1, b: 2 }
```

> [!WARNING] Watch out
>
> Always pass the initial value. Without it, `reduce` uses the first element as the accumulator — and throws `TypeError: Reduce of empty array with no initial value` on `[]`.

```javascript filename:JavaScript
try {
  [].reduce((a, b) => a + b);
} catch (e) {
  console.log(e.message);
}
console.log([].reduce((a, b) => a + b, 0));
```

```text filename:Output
Reduce of empty array with no initial value
0
```

# Chaining

```javascript filename:JavaScript
const orders = [
  { item: "book", qty: 2, price: 12, paid: true },
  { item: "pen", qty: 10, price: 1.5, paid: false },
  { item: "lamp", qty: 1, price: 40, paid: true },
];
const revenue = orders
  .filter((o) => o.paid)
  .map((o) => o.qty * o.price)
  .reduce((sum, v) => sum + v, 0);
console.log(revenue);
```

```text filename:Output
64
```

# forEach and flatMap

```javascript filename:JavaScript
const out = [];
const r = ["x", "y"].forEach((v, i) => out.push(v + i));
console.log(out, r);          // forEach always returns undefined
const sentences = ["hello world", "hi there"];
console.log(sentences.flatMap((s) => s.split(" ")));
console.log([1, 2, 3].flatMap((n) => (n % 2 ? [n, n * 10] : [])));
```

```text filename:Output
[ 'x0', 'y1' ] undefined
[ 'hello', 'world', 'hi', 'there' ]
[ 1, 10, 3, 30 ]
```

| Method | Returns | Use when |
| --- | --- | --- |
| `map` | New array, same length | Transforming each item |
| `filter` | New array, ≤ length | Selecting items |
| `reduce` | Any single value | Sums, grouping, building objects |
| `forEach` | `undefined` | Side effects only (logging, DOM) |
| `flatMap` | New array, flattened one level | Map where each item yields 0..n items |

```question
What is the difference between map and forEach?

---

`map` returns a new array of the callback's return values and is chainable; `forEach` returns `undefined` and exists only for side effects. Neither can be stopped early with `break`.
```

```question
Implement map using reduce.

---

`const map = (arr, fn) => arr.reduce((acc, x, i) => (acc.push(fn(x, i, arr)), acc), []);` — push each transformed item into the accumulator array.
```
