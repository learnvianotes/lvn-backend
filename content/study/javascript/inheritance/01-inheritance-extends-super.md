---
id: d97d12d7-0b92-757f-8611-83203bde9702
key: topic:javascript/inheritance
subject: javascript
topic: inheritance
title: "Inheritance: extends & super"
slug: inheritance-extends-super
order: 1
---

`extends` sets up the prototype chain between two classes; `super` calls the parent's constructor and methods.

# Extending a class

```javascript filename:JavaScript
class Shape {
  constructor(name) { this.name = name; }
  area() { return 0; }
  toString() { return `${this.name} with area ${this.area().toFixed(2)}`; }
  static create(...args) { return new this(...args); }   // `this` = the called class
}
class Circle extends Shape {
  constructor(r) {
    super("Circle");           // must come before using `this`
    this.r = r;
  }
  area() { return Math.PI * this.r ** 2; }                // override
}
class Square extends Shape {
  constructor(side) { super("Square"); this.side = side; }
  area() { return this.side ** 2; }
  toString() { return "■ " + super.toString(); }          // extend parent method
}

const shapes = [new Circle(1), Square.create(2)];
for (const s of shapes) console.log(String(s));
console.log(shapes[1] instanceof Square, shapes[1] instanceof Shape);
```

```text filename:Output
Circle with area 3.14
■ Square with area 4.00
true true
```

# Rules for super

```javascript filename:JavaScript
class Parent {}
class Child extends Parent {
  constructor() {
    this.x = 1;       // before super() → error
    super();
  }
}
try {
  new Child();
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
ReferenceError: Must call super constructor in derived class before accessing 'this' or returning from derived constructor
```

- A subclass without its own `constructor` gets `constructor(...args) { super(...args); }` automatically.
- `super(...)` only in constructors; `super.method()` in any method (also static methods).
- Parent fields are initialised when `super()` returns; child fields right after.

# Polymorphism and the chain

```javascript filename:JavaScript
class Animal { speak() { return "..."; } }
class Dog extends Animal { speak() { return "Woof"; } }
class Puppy extends Dog { speak() { return super.speak() + " (squeaky)"; } }

for (const a of [new Animal(), new Dog(), new Puppy()]) {
  console.log(a.constructor.name.padEnd(6), a.speak());
}
console.log(Object.getPrototypeOf(Puppy) === Dog);                    // static inheritance
console.log(Object.getPrototypeOf(Puppy.prototype) === Dog.prototype); // instance inheritance
```

```text filename:Output
Animal ...
Dog    Woof
Puppy  Woof (squeaky)
true
true
```

# Extending built-ins

```javascript filename:JavaScript
class Stack extends Array {
  peek() { return this.at(-1); }
}
const s = Stack.from([1, 2, 3]);
s.push(4);
console.log(s.peek(), s.length, s instanceof Array);
console.log(s.map((x) => x * 2) instanceof Stack);   // derived methods return Stack

class ValidationError extends Error {
  constructor(field) {
    super(`${field} is invalid`);
    this.name = "ValidationError";
    this.field = field;
  }
}
const err = new ValidationError("email");
console.log(err.name, err.message, err instanceof Error);
```

```text filename:Output
4 4 true
true
ValidationError email is invalid true
```

# Composition over inheritance

Deep hierarchies are brittle. Often it is simpler to <strong>compose</strong> behaviours: build objects from small functions or <em>mixins</em>.

```javascript filename:JavaScript
const canFly = (Base) => class extends Base { fly() { return `${this.name} flies`; } };
const canSwim = (Base) => class extends Base { swim() { return `${this.name} swims`; } };
class Creature { constructor(name) { this.name = name; } }
class Duck extends canSwim(canFly(Creature)) {}

const d = new Duck("Donald");
console.log(d.fly(), "/", d.swim());

// object composition with plain functions
const withLogger = (obj) => ({ ...obj, log: (msg) => `[${obj.name}] ${msg}` });
const service = withLogger({ name: "api" });
console.log(service.log("started"));
```

```text filename:Output
Donald flies / Donald swims
[api] started
```

```question
Why must super() be called before this in a derived constructor?

---

In a derived class the parent constructor is responsible for creating the object. Until `super()` runs there is no `this` to use, so accessing it throws a `ReferenceError`.
```

```question
Does JavaScript support multiple inheritance?

---

No — an object has exactly one prototype. You get similar results with mixins (functions that take a class and return an extended class), `Object.assign` of method objects, or composition.
```
