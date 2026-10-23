---
id: 770be6f5-af2d-7efe-a3c2-165f55bc2222
key: topic:javascript/classes
subject: javascript
topic: classes
title: Classes
slug: classes
order: 1
---

`class` is clean syntax over prototypes — with real extras: public and `#private` fields, static members, static blocks, accessors, and strict mode by default.

# Anatomy of a class

```javascript filename:JavaScript
class BankAccount {
  static bankName = "JS Bank";        // static field (on the class)
  static #count = 0;                  // private static field
  owner;                              // public instance field
  #balance = 0;                       // private instance field

  constructor(owner, deposit = 0) {
    this.owner = owner;
    this.#balance = deposit;
    BankAccount.#count++;
  }
  deposit(amount) {                   // method on BankAccount.prototype
    if (amount <= 0) throw new RangeError("amount must be positive");
    this.#balance += amount;
    return this;                      // enables chaining
  }
  get balance() { return this.#balance; }      // accessor
  #audit() { return `audited ${this.owner}`; } // private method
  report() { return this.#audit(); }
  static count() { return BankAccount.#count; }
}

const acc = new BankAccount("Asha", 100);
acc.deposit(50).deposit(25);
console.log(acc.balance, acc.report(), acc);
console.log(BankAccount.bankName, BankAccount.count(), typeof BankAccount);
```

```text filename:Output
175 audited Asha BankAccount { owner: 'Asha' }
JS Bank 1 function
```

# Private really means private

```javascript filename:JavaScript
class Secret {
  #code = 1234;
  static isSecret(obj) { return #code in obj; }   // brand check (ES2022)
}
const s = new Secret();
console.log(s.code, Object.keys(s), JSON.stringify(s));
console.log(Secret.isSecret(s), Secret.isSecret({ code: 1 }));
```

```text filename:Output
undefined [] {}
true false
```

Accessing `s.#code` outside the class body is a <strong>SyntaxError</strong> — the program does not even parse. Before `#`, the convention was a leading underscore (`this._code`), which is only a hint.

# Class fields with arrow functions

```javascript filename:JavaScript
class Button {
  label = "Save";
  handleArrow = () => `clicked ${this.label}`;   // per-instance, this is bound
  handleMethod() { return `clicked ${this?.label}`; }
}
const b = new Button();
const { handleArrow, handleMethod } = b;          // detach both
console.log(handleArrow(), "|", handleMethod.call(undefined));
console.log(Object.hasOwn(b, "handleArrow"), Object.hasOwn(b, "handleMethod"));
```

```text filename:Output
clicked Save | clicked undefined
true false
```

> [!NOTE] Key point
>
> Arrow-function fields fix lost-`this` in callbacks, but each instance gets its own copy (more memory) and they cannot be overridden via `super` — trade-offs worth mentioning.

# Static blocks and getters

```javascript filename:JavaScript
class Config {
  static defaults;
  static {
    // runs once when the class is defined
    Config.defaults = Object.freeze({ retries: 3, timeout: 1000 });
  }
  static get retries() { return Config.defaults.retries; }
}
console.log(Config.retries, Config.defaults);
```

```text filename:Output
3 { retries: 3, timeout: 1000 }
```

# Classes are special functions

| Behaviour | Detail |
| --- | --- |
| Must be called with `new` | `BankAccount()` → `TypeError: Class constructor … cannot be invoked without 'new'` |
| Hoisted into the TDZ | Using a class before its declaration throws `ReferenceError` |
| Strict mode | The whole class body is strict |
| Methods are non-enumerable | They do not show up in `for…in` over instances |
| Fields run per instance | Initialised before the constructor body (after `super()` in subclasses) |

```javascript filename:JavaScript
class Foo {}
try {
  Foo();
} catch (e) {
  console.log(e.message);
}
```

```text filename:Output
Class constructor Foo cannot be invoked without 'new'
```

```question
Are JavaScript classes real classes?

---

They are syntax over prototypal inheritance: a class is a constructor function, methods go on `Class.prototype`, and `extends` links prototype chains. But they add real semantics — mandatory `new`, strict mode, `#private` fields, `super`, and static blocks.
```

```question
How do you make a property private?

---

Use a `#field` (hard privacy, enforced by the language, ES2022). Older options: closures (factory functions), `WeakMap` keyed by the instance, or the `_underscore` convention (not enforced).
```
