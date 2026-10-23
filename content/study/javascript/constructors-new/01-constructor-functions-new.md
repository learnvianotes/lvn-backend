---
id: eb829a27-fabb-7c37-a3b0-b0902bdc560e
key: topic:javascript/constructors-new
subject: javascript
topic: constructors-new
title: Constructor Functions & new
slug: constructor-functions-new
order: 1
---

Before classes there were constructor functions. Knowing what `new` does step by step explains classes, `this`, and a favourite interview question.

# What `new Fn(args)` does

1. <strong>Create</strong>

   A brand-new empty object is created.

2. <strong>Link</strong>

   Its `[[Prototype]]` is set to `Fn.prototype`.

3. <strong>Bind and run</strong>

   `Fn` is called with `this` = the new object and the given arguments.

4. <strong>Return</strong>

   If `Fn` returns an <strong>object</strong>, that object is the result; otherwise the new object is returned.

```javascript filename:JavaScript
function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);   // steps 1 + 2
  const result = Ctor.apply(obj, args);        // step 3
  return result !== null && typeof result === "object" ? result : obj;  // step 4
}

function User(name) { this.name = name; }
User.prototype.hi = function () { return `hi ${this.name}`; };

const u = myNew(User, "Asha");
console.log(u, u.hi(), u instanceof User);
```

```text filename:Output
User { name: 'Asha' } hi Asha true
```

# Returning an object overrides `this`

```javascript filename:JavaScript
function A() { this.x = 1; return { y: 2 }; }
function B() { this.x = 1; return 42; }   // primitives are ignored
console.log(new A(), new B());
```

```text filename:Output
{ y: 2 } B { x: 1 }
```

# Forgetting `new`

```javascript filename:JavaScript
function Point(x) { this.x = x; }
try {
  Point(5);                        // strict mode: this is undefined
} catch (e) {
  console.log(e.message);
}
function SafePoint(x) {
  if (!new.target) return new SafePoint(x);   // guard with new.target
  this.x = x;
}
console.log(SafePoint(5));
```

```text filename:Output
Cannot set properties of undefined (setting 'x')
SafePoint { x: 5 }
```

# Inheritance the ES5 way

```javascript filename:JavaScript
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return `${this.name} makes a sound`; };

function Dog(name, breed) {
  Animal.call(this, name);                         // "super(name)"
  this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype);  // link prototypes
Dog.prototype.constructor = Dog;                  // repair constructor
Dog.prototype.speak = function () {
  return Animal.prototype.speak.call(this) + " (woof)";
};

const d = new Dog("Rex", "lab");
console.log(d.speak(), d instanceof Animal, d.constructor.name);
```

```text filename:Output
Rex makes a sound (woof) true Dog
```

> [!NOTE] Key point
>
> This is exactly what `class Dog extends Animal` does for you, with fewer ways to get it wrong.

```question
What happens when you call a function with new?

---

A new object is created, linked to `Fn.prototype`, `Fn` runs with `this` bound to it, and the new object is returned unless the function explicitly returns another object.
```
