---
id: 8dfa2fd2-9785-7b00-9972-a3edddb23067
key: topic:javascript/iterators
subject: javascript
topic: iterators
title: Iterators & Iterables
slug: iterators-iterables
order: 1
---

The iteration protocols are what make `for…of`, spread, destructuring, `Array.from` and `Promise.all` work on any collection — including your own.

# The two protocols

> [!NOTE] Iterable
>
> An object with a `[Symbol.iterator]()` method that returns an iterator. Arrays, strings, Maps, Sets, `arguments`, NodeLists and generators are iterable. Plain objects are <strong>not</strong>.

> [!NOTE] Iterator
>
> An object with a `next()` method returning `{ value, done }`. Optional `return()` is called on early exit (`break`).

```javascript filename:JavaScript
const arr = ["a", "b"];
const it = arr[Symbol.iterator]();
console.log(it.next(), it.next(), it.next());
try {
  for (const x of { a: 1 }) {}
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
{ value: 'a', done: false } { value: 'b', done: false } { value: undefined, done: true }
{(intermediate value)} is not iterable
```

# A custom iterable

```javascript filename:JavaScript
class Range {
  constructor(start, end, step = 1) { Object.assign(this, { start, end, step }); }
  [Symbol.iterator]() {
    let current = this.start;
    const { end, step } = this;
    return {
      next: () =>
        current <= end ? { value: (current += step) - step, done: false } : { value: undefined, done: true },
      [Symbol.iterator]() { return this; },   // iterators are usually iterable too
    };
  }
}
const r = new Range(1, 10, 3);
console.log([...r]);
const [first, second] = r;
console.log(first, second, Math.max(...r), Array.from(r, (n) => n * 10));
for (const n of new Range(1, 3)) console.log(n);
```

```text filename:Output
[ 1, 4, 7, 10 ]
1 4 10 [ 10, 40, 70, 100 ]
1
2
3
```

# Iterators are lazy and one-shot

```javascript filename:JavaScript
const it = [1, 2, 3].values();
console.log([...it], [...it]);          // second spread: already exhausted
const m = new Map([["x", 1], ["y", 2]]);
console.log(m.entries().next().value);
```

```text filename:Output
[ 1, 2, 3 ] []
[ 'x', 1 ]
```

# Iterator helpers (ES2025, Node 22+)

```javascript filename:JavaScript
function* naturals() { let n = 1; while (true) yield n++; }   // infinite!
const firstSquaresOfEvens = naturals()
  .filter((n) => n % 2 === 0)
  .map((n) => n * n)
  .take(4)
  .toArray();
console.log(firstSquaresOfEvens);
console.log(Iterator.from([5, 6, 7]).drop(1).reduce((a, b) => a + b, 0));
```

```text filename:Output
[ 4, 16, 36, 64 ]
13
```

> [!NOTE] Key point
>
> Iterator helpers are <strong>lazy</strong>: nothing is computed until `toArray()`, `for…of` or a reducer pulls values — so they work on infinite sequences where array methods cannot.

```question
How do you make an object iterable?

---

Give it a `[Symbol.iterator]` method that returns an object with `next()` returning `{ value, done }` — or, easiest, make `[Symbol.iterator]` a generator: `*[Symbol.iterator]() { yield* this.items; }`.
```
