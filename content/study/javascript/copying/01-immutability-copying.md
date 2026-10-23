---
id: 015e02f0-1374-735d-961d-8378946c5c88
key: topic:javascript/copying
subject: javascript
topic: copying
title: Immutability & Copying
slug: immutability-copying
order: 1
---

Assignment copies references. To copy data you choose between a shallow copy (top level only) and a deep copy (everything) — and immutable updates build new objects instead of mutating old ones.

# Shallow copies share nested objects

```javascript filename:JavaScript
const original = { name: "Asha", skills: ["js"], meta: { level: 1 } };
const shallow = { ...original };
shallow.name = "Ravi";          // top level: independent
shallow.skills.push("css");     // nested: SHARED
shallow.meta.level = 99;
console.log(original);
console.log(shallow.skills === original.skills);
```

```text filename:Output
{ name: 'Asha', skills: [ 'js', 'css' ], meta: { level: 99 } }
true
```

| Shallow copy tools | Arrays | Objects |
| --- | --- | --- |
| Spread | `[...arr]` | `{...obj}` |
| Built-ins | `arr.slice()`, `Array.from(arr)`, `arr.concat()` | `Object.assign({}, obj)` |

# Deep copy with structuredClone

```javascript filename:JavaScript
const original = {
  when: new Date(0),
  tags: new Set(["a"]),
  lookup: new Map([["k", { deep: true }]]),
  nested: { list: [1, [2, 3]] },
};
original.self = original;              // cycles are fine
const clone = structuredClone(original);
clone.nested.list[1].push(4);
console.log(original.nested.list, clone.nested.list);
console.log(clone.when instanceof Date, clone.tags, clone.self === clone);
```

```text filename:Output
[ 1, [ 2, 3 ] ] [ 1, [ 2, 3, 4 ] ]
true Set(1) { 'a' } true
```

```javascript filename:JavaScript
class Point { constructor(x) { this.x = x; } norm() { return Math.abs(this.x); } }
const copy = structuredClone(new Point(-3));
console.log(copy, copy instanceof Point);
try {
  structuredClone({ fn() {} });
} catch (e) {
  console.log(e.name);
}
```

```text filename:Output
{ x: -3 } false
DataCloneError
```

| Method | Dates / Map / Set | Cycles | Functions | Class instances |
| --- | --- | --- | --- | --- |
| Spread / `assign` | shared refs (shallow) | shared | copied (ref) | prototype lost for spread |
| `JSON.parse(JSON.stringify())` | Date → string, Map/Set → `{}` | throws | dropped | plain object |
| `structuredClone` | ✔ preserved | ✔ | throws `DataCloneError` | plain object (prototype lost) |
| Custom recursive / lodash `cloneDeep` | ✔ | ✔ (with a map) | kept by reference | configurable |

# Immutable update patterns

```javascript filename:JavaScript
const state = { user: { name: "Asha", prefs: { theme: "light" } }, todos: [{ id: 1, done: false }] };

const next = {
  ...state,
  user: { ...state.user, prefs: { ...state.user.prefs, theme: "dark" } },
  todos: state.todos.map((t) => (t.id === 1 ? { ...t, done: true } : t)),
};
console.log(state.user.prefs.theme, next.user.prefs.theme);
console.log(state.todos[0].done, next.todos[0].done);
console.log(state.user === next.user, state === next);
```

```text filename:Output
light dark
false true
false false
```

> [!NOTE] Why it matters
>
> Immutable updates copy only the <em>path</em> that changed and share the rest (structural sharing). That lets React, Redux and memoisation detect changes with a cheap `===`.

| Instead of (mutating) | Write (immutable) |
| --- | --- |
| `arr.push(x)` | `[...arr, x]` |
| `arr.splice(i, 1)` | `arr.filter((_, j) => j !== i)` or `arr.toSpliced(i, 1)` |
| `arr[i] = v` | `arr.with(i, v)` or `arr.map(...)` |
| `arr.sort()` | `arr.toSorted()` |
| `obj.k = v` | `{ ...obj, k: v }` |
| `delete obj.k` | `const { k, ...rest } = obj` |

```question
Shallow copy vs deep copy?

---

A shallow copy duplicates only the top level; nested objects are still shared with the original. A deep copy recursively duplicates everything, so the copies are fully independent. Use spread for shallow, `structuredClone` for deep.
```
