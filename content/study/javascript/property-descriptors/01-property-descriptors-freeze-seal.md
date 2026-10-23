---
id: db316faf-dfc6-7303-809e-a3303f019ad1
key: topic:javascript/property-descriptors
subject: javascript
topic: property-descriptors
title: Property Descriptors, freeze & seal
slug: property-descriptors-freeze-seal
order: 1
---

Every property has hidden attributes — writable, enumerable, configurable — that control whether it can change, show up in loops, or be deleted.

# Inspecting descriptors

```javascript filename:JavaScript
const obj = { visible: 1 };
console.log(Object.getOwnPropertyDescriptor(obj, "visible"));
Object.defineProperty(obj, "secret", { value: 42 });   // attributes default to false!
console.log(Object.getOwnPropertyDescriptor(obj, "secret"));
console.log(obj, Object.keys(obj), obj.secret);
```

```text filename:Output
{ value: 1, writable: true, enumerable: true, configurable: true }
{ value: 42, writable: false, enumerable: false, configurable: false }
{ visible: 1 } [ 'visible' ] 42
```

| Attribute | When `false` |
| --- | --- |
| `writable` | The value cannot be reassigned (throws in strict mode) |
| `enumerable` | Hidden from `for…in`, `Object.keys`, spread and `JSON.stringify` |
| `configurable` | Cannot be deleted, and its attributes cannot be changed (except writable → false) |
| `get` / `set` | Accessor property instead of a data property (no `value`/`writable`) |

```javascript filename:JavaScript
const account = {};
Object.defineProperty(account, "id", { value: "AC-1", enumerable: true });
try {
  account.id = "hacked";
} catch (e) {
  console.log(e.message);
}
try {
  delete account.id;
} catch (e) {
  console.log(e.message);
}
console.log(account.id);
```

```text filename:Output
Cannot assign to read only property 'id' of object '#<Object>'
Cannot delete property 'id' of #<Object>
AC-1
```

# preventExtensions, seal, freeze

|  | Add props | Delete props | Change values | Check |
| --- | --- | --- | --- | --- |
| `Object.preventExtensions` | No | Yes | Yes | `Object.isExtensible` |
| `Object.seal` | No | No | Yes | `Object.isSealed` |
| `Object.freeze` | No | No | No | `Object.isFrozen` |

```javascript filename:JavaScript
const sealed = Object.seal({ a: 1 });
sealed.a = 2;
try { sealed.b = 3; } catch (e) { console.log("seal:", e.message); }

const frozen = Object.freeze({ a: 1, nested: { b: 1 } });
try { frozen.a = 2; } catch (e) { console.log("freeze:", e.message); }
frozen.nested.b = 99;                 // freeze is SHALLOW
console.log(sealed, frozen, Object.isFrozen(frozen.nested));
```

```text filename:Output
seal: Cannot add property b, object is not extensible
freeze: Cannot assign to read only property 'a' of object '#<Object>'
{ a: 2 } { a: 1, nested: { b: 99 } } false
```

> [!NOTE] Key point
>
> In sloppy mode these writes fail <strong>silently</strong>; in strict mode (modules, classes) they throw a `TypeError`.

# Deep freeze

```javascript filename:JavaScript
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") deepFreeze(value);
  }
  return Object.freeze(obj);
}
const config = deepFreeze({ db: { host: "localhost", ports: [5432] } });
try {
  config.db.ports.push(1);
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
Cannot add property 1, object is not extensible
```

```question
What is the difference between Object.freeze and const?

---

`const` prevents reassigning the <em>variable</em>; the object stays mutable. `Object.freeze` makes the <em>object's</em> own properties read-only and non-extensible — but only one level deep, and it says nothing about the variable.
```

```question
seal vs freeze?

---

Both prevent adding and deleting properties. `seal` still allows changing existing values; `freeze` also makes every existing data property read-only.
```
