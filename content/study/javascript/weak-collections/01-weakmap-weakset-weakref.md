---
id: 7fc91938-cbef-736a-bfeb-2cc95fbb3778
key: topic:javascript/weak-collections
subject: javascript
topic: weak-collections
title: WeakMap, WeakSet & WeakRef
slug: weakmap-weakset-weakref
order: 1
---

Weak collections hold their keys <em>weakly</em>: if nothing else references a key object, it can be garbage-collected and its entry silently disappears.

|  | `Map` / `Set` | `WeakMap` / `WeakSet` |
| --- | --- | --- |
| Keys | Anything | Objects (and non-registered symbols) only |
| Keeps key alive? | Yes — strong reference | No — weak reference |
| Iterable / `size`? | Yes | No (contents depend on the GC) |
| Methods | Full API | `get/set/has/delete` · `add/has/delete` |

# Use case: private data / metadata per object

```javascript filename:JavaScript
const privateData = new WeakMap();
class Person {
  constructor(name, ssn) {
    this.name = name;
    privateData.set(this, { ssn });   // disappears when the Person is collected
  }
  lastFour() { return privateData.get(this).ssn.slice(-4); }
}
const p = new Person("Asha", "123-45-6789");
console.log(p.lastFour(), p);
```

```text filename:Output
6789 Person { name: 'Asha' }
```

# Use case: caching without leaks

```javascript filename:JavaScript
const cache = new WeakMap();
function expensiveSummary(obj) {
  if (cache.has(obj)) return cache.get(obj) + " (cached)";
  const result = `keys=${Object.keys(obj).length}`;
  cache.set(obj, result);
  return result;
}
const report = { a: 1, b: 2 };
console.log(expensiveSummary(report));
console.log(expensiveSummary(report));
```

```text filename:Output
keys=2
keys=2 (cached)
```

# WeakSet: tagging objects

```javascript filename:JavaScript
const visited = new WeakSet();
function visit(node) {
  if (visited.has(node)) return "already visited";
  visited.add(node);
  return "visiting";
}
const node = {};
console.log(visit(node), "/", visit(node));
try {
  visited.add("string");
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
visiting / already visited
Invalid value used in weak set
```

# WeakRef and FinalizationRegistry (ES2021)

```javascript filename:JavaScript
let big = { data: "large object" };
const ref = new WeakRef(big);
console.log(ref.deref()?.data);   // still alive
big = null;                       // now only weakly reachable — may be collected later
const registry = new FinalizationRegistry((label) => console.log("collected", label));
registry.register({}, "temp object");
```

```text filename:Output
large object
```

> [!WARNING] Watch out
>
> GC timing is unpredictable: `deref()` may return the object long after you dropped it, and finalizers may never run. Use these only for caches and resource cleanup hints — never for program logic.

```question
Why can't you iterate a WeakMap?

---

Its entries vanish whenever the garbage collector reclaims a key, which happens at non-deterministic times. Exposing iteration or `size` would make program behaviour depend on GC timing, so the API deliberately hides them.
```
