---
id: e9007f6f-c18a-79d9-8696-5bcafd7a2baa
key: topic:javascript/prototypes
subject: javascript
topic: prototypes
title: Prototypes & the Prototype Chain
slug: prototypes-the-prototype-chain
order: 1
---

JavaScript objects inherit directly from other objects. Every object has a hidden link, `[[Prototype]]`, and property lookups walk that chain until they find a match or hit `null`.

> [!INFO]
>
> <strong>Prototype</strong> — the object another object delegates to for properties it does not have itself. Read it with `Object.getPrototypeOf(obj)` (or the legacy `obj.__proto__`).

# Lookup walks the chain

```javascript filename:JavaScript
const animal = { eats: true, describe() { return `${this.name} eats: ${this.eats}`; } };
const rabbit = Object.create(animal);
rabbit.name = "Bunny";
rabbit.jumps = true;

console.log(rabbit.jumps, rabbit.eats, rabbit.describe());
console.log(Object.hasOwn(rabbit, "eats"), "eats" in rabbit);
console.log(Object.getPrototypeOf(rabbit) === animal);
console.log(Object.getPrototypeOf(animal) === Object.prototype);
console.log(Object.getPrototypeOf(Object.prototype));
```

```text filename:Output
true true Bunny eats: true
false true
true
true
null
```

`rabbit` → `animal` → `Object.prototype` → `null`

# Writes do not walk the chain

```javascript filename:JavaScript
const proto = { greeting: "hello", list: [] };
const child = Object.create(proto);
child.greeting = "hi";           // creates an OWN property (shadowing)
child.list.push(1);              // mutates the SHARED array on the prototype
console.log(child.greeting, proto.greeting, proto.list);
```

```text filename:Output
hi hello [ 1 ]
```

# `prototype` vs `[[Prototype]]`

Two different things with confusingly similar names:

> [!NOTE] Fn.prototype
>
> A regular property that exists on functions (and classes). It becomes the `[[Prototype]]` of objects created with `new Fn()`.

> [!NOTE] [[Prototype]] / __proto__
>
> The internal link every object has, pointing to the object it inherits from.

```javascript filename:JavaScript
function Dog(name) { this.name = name; }
Dog.prototype.bark = function () { return `${this.name}: woof`; };

const rex = new Dog("Rex");
console.log(rex.bark());
console.log(Object.getPrototypeOf(rex) === Dog.prototype);
console.log(Dog.prototype.constructor === Dog, rex.constructor.name);
console.log(Object.hasOwn(rex, "bark"), rex instanceof Dog);
```

```text filename:Output
Rex: woof
true
true Dog
false true
```

> [!NOTE] Key point
>
> Methods live <strong>once</strong> on the prototype and are shared by every instance — cheaper than giving each instance its own copy.

# Built-in chains

```javascript filename:JavaScript
const arr = [1, 2];
console.log(Object.getPrototypeOf(arr) === Array.prototype);
console.log(Object.getPrototypeOf(Array.prototype) === Object.prototype);
const fn = () => {};
console.log(Object.getPrototypeOf(fn) === Function.prototype);
console.log(arr.hasOwnProperty("length"), arr.hasOwnProperty("map"));
```

```text filename:Output
true
true
true
true false
```

# How instanceof works

```javascript filename:JavaScript
function myInstanceOf(obj, Ctor) {
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
console.log(myInstanceOf([], Array), myInstanceOf([], Object), myInstanceOf([], Map));
```

```text filename:Output
true true false
```

> [!WARNING] Watch out
>
> Never extend built-in prototypes (`Array.prototype.myThing = …`) in shared code — it can clash with future standard methods (this is why `Array.prototype.flatten` had to be renamed `flat`).

```question
Explain prototypal inheritance.

---

Each object has an internal `[[Prototype]]` link to another object. When a property is not found on the object, the engine looks it up on the prototype, then that object's prototype, and so on until `null`. Methods are shared this way; classes are syntax over the same mechanism.
```

```question
What is the difference between \_\_proto\_\_ and prototype?

---

`__proto__` (really `[[Prototype]]`) is the link on every object to what it inherits from. `prototype` is a property on constructor functions/classes: the object that becomes the `[[Prototype]]` of instances created with `new`.
```
