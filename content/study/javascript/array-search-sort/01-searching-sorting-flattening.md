---
id: 8c76af4e-4692-7fc1-af3a-067ad6243f9a
key: topic:javascript/array-search-sort
subject: javascript
topic: array-search-sort
title: Searching, Sorting & Flattening
slug: searching-sorting-flattening
order: 1
---

Find things, test things, sort things (carefully!) and flatten nested arrays — plus the ES2023 non-mutating copies.

# Finding and testing

| Method | Returns | Stops early? |
| --- | --- | --- |
| `find(fn)` / `findLast(fn)` | First / last matching element or `undefined` | Yes |
| `findIndex(fn)` / `findLastIndex(fn)` | Index or `-1` | Yes |
| `indexOf(x)` / `lastIndexOf(x)` | Index via `===` or `-1` | Yes |
| `includes(x)` | Boolean (finds `NaN`) | Yes |
| `some(fn)` | `true` if any passes | Yes, on first `true` |
| `every(fn)` | `true` if all pass (`true` for `[]`) | Yes, on first `false` |

```javascript filename:JavaScript
const users = [
  { id: 1, name: "Asha", admin: false },
  { id: 2, name: "Ravi", admin: true },
  { id: 3, name: "Mei", admin: true },
];
console.log(users.find((u) => u.admin).name, users.findLast((u) => u.admin).name);
console.log(users.findIndex((u) => u.id === 3), users.find((u) => u.id === 9));
console.log(users.some((u) => u.admin), users.every((u) => u.admin));
console.log([].every((x) => x > 100), [].some((x) => x > 100));
console.log([1, 2, NaN].includes(NaN), [1, 2, NaN].indexOf(NaN));
```

```text filename:Output
Ravi Mei
2 undefined
true false
true false
true -1
```

# Sorting — the big pitfall

```javascript filename:JavaScript
const nums = [10, 1, 5, 100, 25];
console.log([...nums].sort());                 // compares as STRINGS
console.log([...nums].sort((a, b) => a - b));  // numeric ascending
console.log([...nums].sort((a, b) => b - a));  // descending
```

```text filename:Output
[ 1, 10, 100, 25, 5 ]
[ 1, 5, 10, 25, 100 ]
[ 100, 25, 10, 5, 1 ]
```

> [!WARNING] Watch out
>
> `sort()` with no comparator converts elements to strings and compares UTF-16 code units. It also <strong>mutates</strong> the array in place (and returns the same array). Use `toSorted` for a copy.

The comparator returns a negative number if `a` goes first, positive if `b` goes first, `0` to keep order. Since ES2019 the sort is <strong>stable</strong>, so equal items keep their relative order — which lets you sort by several keys.

```javascript filename:JavaScript
const people = [
  { name: "Zoe", dept: "HR", age: 30 },
  { name: "adam", dept: "Eng", age: 25 },
  { name: "Émile", dept: "Eng", age: 35 },
  { name: "Bob", dept: "HR", age: 25 },
];
const byDeptThenAge = people.toSorted(
  (a, b) => a.dept.localeCompare(b.dept) || a.age - b.age
);
console.log(byDeptThenAge.map((p) => `${p.dept}:${p.name}`).join(" "));
const names = people.map((p) => p.name);
console.log(names.toSorted());
console.log(names.toSorted((a, b) => a.localeCompare(b)));
console.log(people[0].name);   // original untouched by toSorted
```

```text filename:Output
Eng:adam Eng:Émile HR:Bob HR:Zoe
[ 'Bob', 'Zoe', 'adam', 'Émile' ]
[ 'adam', 'Bob', 'Émile', 'Zoe' ]
Zoe
```

# Mutating vs copying (ES2023)

| Mutates | Non-mutating copy |
| --- | --- |
| `sort(fn)` | `toSorted(fn)` |
| `reverse()` | `toReversed()` |
| `splice(i, n, …)` | `toSpliced(i, n, …)` |
| `arr[i] = v` | `arr.with(i, v)` |
| `fill`, `copyWithin`, `push`, `pop`, `shift`, `unshift` | spread / `slice` / `concat` |

# Flattening

```javascript filename:JavaScript
const nested = [1, [2, [3, [4, [5]]]]];
console.log(nested.flat());
console.log(nested.flat(2));
console.log(nested.flat(Infinity));
```

```text filename:Output
[ 1, 2, [ 3, [ 4, [Array] ] ] ]
[ 1, 2, 3, [ 4, [ 5 ] ] ]
[ 1, 2, 3, 4, 5 ]
```

> [!NOTE] Reading the output
>
> `console.log` shows nested structures only 2 levels deep, printing `[Array]` / `[Object]` beyond that. Use `console.dir(x, { depth: null })` or `JSON.stringify` to see everything.

# Useful one-liners

```javascript filename:JavaScript
const arr = [3, 1, 3, 2, 1];
console.log([...new Set(arr)]);                                  // unique
console.log(Math.max(...arr), arr.reduce((a, b) => a + b, 0));   // max, sum
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
console.log(chunk([1, 2, 3, 4, 5], 2));
const zip = (a, b) => a.map((x, i) => [x, b[i]]);
console.log(zip(["a", "b"], [1, 2]));
console.log([1, 2, 3, 4].filter((x) => [2, 4, 6].includes(x)));  // intersection
```

```text filename:Output
[ 3, 1, 2 ]
3 10
[ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]
[ [ 'a', 1 ], [ 'b', 2 ] ]
[ 2, 4 ]
```

```question
Why does \[10, 1, 5\].sort() return \[1, 10, 5\]?

---

Without a comparator, `sort` converts elements to strings and compares them lexicographically: `'10' < '5'` because `'1' < '5'`. Pass `(a, b) => a - b` for numbers.
```

```question
find vs filter?

---

`find` returns the first matching element (or `undefined`) and stops searching; `filter` scans everything and returns an array of all matches (possibly empty).
```
