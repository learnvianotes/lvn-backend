---
id: f6e7cfbd-91b7-7fc4-919b-d1ebf8568154
key: topic:java/this-super
subject: java
topic: this-super
title: this & super
slug: this-super
order: 1
---

`this` refers to the current object; `super` refers to the superclass part of the current object.

# Uses of `this`

| Use | Example | Why |
| --- | --- | --- |
| Disambiguate a field from a parameter | `this.name = name;` | Parameter shadows the field |
| Call another constructor | `this(name, 0);` | Constructor chaining — first statement only |
| Pass the current object | `registry.add(this);` | Callbacks, listeners |
| Return the current object | `return this;` | Fluent / builder APIs |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Counter c = new Counter().add(5).add(10).add(-3);   // chaining via return this
        System.out.println(c.total);
    }
}

class Counter {
    int total;
    Counter add(int total) {
        this.total += total;   // this.total = field, total = parameter
        return this;
    }
}
```

```text filename:Output
12
```

# Uses of `super`

| Use | Example |
| --- | --- |
| Call a superclass constructor | `super(name);` — first statement of the constructor |
| Call the overridden superclass method | `super.describe()` |
| Access a hidden superclass field | `super.name` (when the subclass declares a field with the same name) |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Manager m = new Manager("Asha", 3);
        System.out.println(m.describe());
        m.showNames();
    }
}

class Employee {
    protected String name;
    String kind = "employee";
    Employee(String name) { this.name = name; }
    String describe() { return name + " (" + kind + ")"; }
}

class Manager extends Employee {
    private final int reports;
    String kind = "manager";                   // hides Employee.kind

    Manager(String name, int reports) {
        super(name);                           // must come first
        this.reports = reports;
    }

    @Override String describe() {
        return super.describe() + " manages " + reports;   // reuse parent logic
    }

    void showNames() {
        System.out.println(this.kind + " / " + super.kind);
    }
}
```

```text filename:Output
Asha (employee) manages 3
manager / employee
```

> [!NOTE] Key point
>
> `Employee.describe()` prints <em>employee</em> — fields are <strong>not</strong> polymorphic, so inside `Employee` the name `kind` always means `Employee.kind`. Avoid hiding fields; it is confusing.

# Rules

- `this` and `super` cannot be used in a `static` context — there is no current object.
- A constructor can start with `this(...)` <strong>or</strong> `super(...)`, never both.
- `super.super.method()` is not allowed — you can only reach one level up.
- If the superclass has no no-arg constructor, every subclass constructor must call `super(args)` explicitly.

```java filename:Java
class Animal {
    Animal(String name) { }
}

class Dog extends Animal {
    Dog() { }   // implicit super() — but Animal has no no-arg constructor
}
```

```text filename:javac
Main.java:6: error: constructor Animal in class Animal cannot be applied to given types;
    Dog() { }   // implicit super() — but Animal has no no-arg constructor
          ^
  required: String
  found:    no arguments
  reason: actual and formal argument lists differ in length
```

```question
Why can't this be used inside a static method?

---

A static method belongs to the class and runs without any instance, so there is no current object for `this` (or `super`) to refer to.
```

```question
What happens if you don't call super(...) in a constructor?

---

The compiler inserts `super()` as the first statement. If the parent has no accessible no-arg constructor, compilation fails.
```
