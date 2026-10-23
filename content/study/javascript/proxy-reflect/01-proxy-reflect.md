---
id: 101ce9a6-07e4-7ae7-a57e-3a37b3a29b74
key: topic:javascript/proxy-reflect
subject: javascript
topic: proxy-reflect
title: Proxy & Reflect
slug: proxy-reflect
order: 1
---

A `Proxy` wraps an object and intercepts fundamental operations — get, set, delete, `in`, function calls. `Reflect` provides the default behaviour for each trap.

# Traps

| Trap | Intercepts |
| --- | --- |
| `get(target, prop, receiver)` | `obj.prop`, `obj[prop]` |
| `set(target, prop, value, receiver)` | `obj.prop = value` |
| `has(target, prop)` | `prop in obj` |
| `deleteProperty(target, prop)` | `delete obj.prop` |
| `ownKeys(target)` | `Object.keys`, `for…in`, `Reflect.ownKeys` |
| `apply(target, thisArg, args)` | Calling a function proxy |
| `construct(target, args)` | `new` on a proxy |

# Validation and defaults

```javascript filename:JavaScript
const user = new Proxy({}, {
  set(target, prop, value, receiver) {
    if (prop === "age" && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError(`age must be a non-negative integer, got ${value}`);
    }
    return Reflect.set(target, prop, value, receiver);   // default behaviour
  },
  get(target, prop, receiver) {
    return prop in target ? Reflect.get(target, prop, receiver) : `<no ${String(prop)}>`;
  },
});
user.name = "Asha";
user.age = 30;
try { user.age = -5; } catch (e) { console.log(e.message); }
console.log(user.name, user.age, user.email);
```

```text filename:Output
age must be a non-negative integer, got -5
Asha 30 <no email>
```

# Observing changes (how Vue 3 reactivity works)

```javascript filename:JavaScript
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(target, prop, value) {
      const old = target[prop];
      const ok = Reflect.set(target, prop, value);
      if (old !== value) onChange(prop, old, value);
      return ok;
    },
  });
}
const state = reactive({ count: 0 }, (k, a, b) => console.log(`${k}: ${a} → ${b}`));
state.count++;
state.count += 5;
state.count = 6;          // unchanged → no notification
```

```text filename:Output
count: 0 → 1
count: 1 → 6
```

# Negative array indices, and hiding private keys

```javascript filename:JavaScript
const arr = new Proxy([10, 20, 30], {
  get(target, prop, receiver) {
    const i = Number(prop);
    return Number.isInteger(i) && i < 0 ? target[target.length + i] : Reflect.get(target, prop, receiver);
  },
});
console.log(arr[-1], arr[0], arr.length);

const hidden = new Proxy({ id: 1, _secret: "x" }, {
  has: (t, p) => !String(p).startsWith("_") && p in t,
  ownKeys: (t) => Reflect.ownKeys(t).filter((k) => !String(k).startsWith("_")),
});
console.log("_secret" in hidden, Object.keys(hidden));
```

```text filename:Output
30 10 3
false [ 'id' ]
```

# Reflect

```javascript filename:JavaScript
const obj = { a: 1 };
console.log(Reflect.has(obj, "a"), Reflect.ownKeys(obj), Reflect.get(obj, "a"));
console.log(Reflect.defineProperty(Object.freeze({}), "x", { value: 1 }));   // false, no throw
console.log(Reflect.apply(Math.max, null, [1, 5, 3]));
```

```text filename:Output
true [ 'a' ] 1
false
5
```

> [!NOTE] Key point
>
> `Reflect` methods mirror the proxy traps one-to-one and return booleans instead of throwing. Inside a trap, forward to `Reflect.x(...)` with the same arguments (including `receiver`) to keep getters and inheritance working.

> [!WARNING] Watch out
>
> Proxies add overhead to every intercepted operation, and `===` sees the proxy and target as different objects. Built-ins with internal slots (`Map`, `Date`, `#private` fields) don't work transparently through a proxy.

```question
What are real-world uses of Proxy?

---

Reactivity systems (Vue 3, MobX), validation, default values, logging/tracing, access control, negative indexing, API clients that turn property access into requests, and mocks in tests.
```
