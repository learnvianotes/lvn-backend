---
id: cd16ca20-ad17-7058-af82-6b4f03976519
key: topic:javascript/map-set
subject: javascript
topic: map-set
title: Map & Set
slug: map-set
order: 1
---

`Map` is a key → value store where keys can be <em>anything</em>; `Set` is a collection of unique values. Both keep insertion order and have O(1) average lookups.

# Map

```javascript filename:JavaScript
const m = new Map();
const objKey = { id: 1 };
m.set("name", "Asha").set(42, "number key").set(objKey, "object key");
console.log(m.get(objKey), m.get(42), m.get("missing"));
console.log(m.has("name"), m.size);
m.delete(42);
console.log(m);
for (const [key, value] of m) console.log(key, "→", value);
console.log([...m.keys()], new Map(Object.entries({ a: 1 })));
```

```text filename:Output
object key number key undefined
true 3
Map(2) { 'name' => 'Asha', { id: 1 } => 'object key' }
name → Asha
{ id: 1 } → object key
[ 'name', { id: 1 } ] Map(1) { 'a' => 1 }
```

# Map vs plain object

|  | `Object` | `Map` |
| --- | --- | --- |
| Key types | Strings and symbols (others are stringified) | Any value — objects, functions, `NaN` |
| Order | Integer keys first, then insertion | Pure insertion order |
| Size | `Object.keys(o).length` | `m.size` |
| Iteration | Via `Object.entries` | Directly iterable |
| Accidental keys | Inherits `toString`, `constructor`, `__proto__` risks | None |
| Frequent add/delete | Slower | Optimised for it |
| JSON support | Native | Convert: `Object.fromEntries(m)` |

> [!TIP] Do
>
> Use a `Map` for dynamic dictionaries (caches, counts, lookups by id or by object); use an object for fixed-shape records.

# Set

```javascript filename:JavaScript
const s = new Set([3, 1, 3, 2, 1]);
s.add(4).add(1);
console.log(s, s.size, s.has(2));
s.delete(3);
console.log([...s]);
console.log([...new Set("mississippi")].join(""));
```

```text filename:Output
Set(4) { 3, 1, 2, 4 } 4 true
[ 1, 2, 4 ]
misp
```

# Set operations (ES2025, Node 22+)

```javascript filename:JavaScript
const a = new Set([1, 2, 3, 4]);
const b = new Set([3, 4, 5]);
console.log(a.union(b));
console.log(a.intersection(b));
console.log(a.difference(b), a.symmetricDifference(b));
console.log(new Set([3]).isSubsetOf(a), a.isDisjointFrom(new Set([9])));
// the classic way, still common in interviews:
console.log([...a].filter((x) => b.has(x)));
```

```text filename:Output
Set(5) { 1, 2, 3, 4, 5 }
Set(2) { 3, 4 }
Set(2) { 1, 2 } Set(3) { 1, 2, 5 }
true true
[ 3, 4 ]
```

# Equality of keys

```javascript filename:JavaScript
const s = new Set([NaN, NaN, 0, -0, {}, {}]);
console.log(s.size);             // NaN once, 0/-0 once, two distinct objects
const m = new Map([[[1], "a"]]);
console.log(m.get([1]));         // a different array → different key
```

```text filename:Output
4
undefined
```

```question
When would you use a Map instead of an object?

---

When keys are not strings (objects, numbers you don't want stringified), when keys are added and removed frequently, when you need the size or guaranteed insertion order, or when keys come from user input (no prototype pollution risk).
```

```question
How do you remove duplicates from an array?

---

`[...new Set(arr)]` — O(n), keeps first-occurrence order. For objects by a field: `[...new Map(arr.map((o) => [o.id, o])).values()]`.
```
