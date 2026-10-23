---
id: d7c7e950-e8a3-765d-b81d-6985b54bb1c3
key: topic:java/constructors
subject: java
topic: constructors
title: Constructors & Initialization Order
slug: constructors-initialization-order
order: 1
---

A constructor initialises a new object. Java runs static setup once per class and then a fixed sequence for every `new`.

> [!INFO]
>
> <strong>Constructor</strong> — a special member with the class's name and <strong>no return type</strong> that runs when `new` creates an object. It is not inherited and cannot be `static`, `final` or `abstract`.

# Kinds of constructors

| Kind | What it is |
| --- | --- |
| <strong>Default</strong> | Added by the compiler <em>only if you write no constructor at all</em>: no args, calls `super()`. |
| <strong>No-arg</strong> | One you write yourself with no parameters. |
| <strong>Parameterized</strong> | Takes arguments to set up state. |
| <strong>Copy</strong> | Takes another instance of the same class: `Point(Point other)` (Java has no built-in copy constructor). |
| <strong>Private</strong> | Prevents outside `new` — singletons, factories, utility classes. |

# Overloading and chaining with `this(...)`

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(new Pizza());
        System.out.println(new Pizza("large"));
        System.out.println(new Pizza("small", 3));
    }
}

class Pizza {
    private final String size;
    private final int toppings;

    Pizza() { this("medium"); }                 // delegates
    Pizza(String size) { this(size, 1); }       // delegates
    Pizza(String size, int toppings) {          // the one "real" constructor
        this.size = size;
        this.toppings = toppings;
    }

    @Override public String toString() { return size + " pizza, " + toppings + " topping(s)"; }
}
```

```text filename:Output
medium pizza, 1 topping(s)
large pizza, 1 topping(s)
small pizza, 3 topping(s)
```

> [!NOTE] Key point
>
> `this(...)` or `super(...)` must be the <strong>first statement</strong> of a constructor, and you can use only one of them. If you write neither, the compiler inserts `super()`.

> [!WARNING] Watch out
>
> Writing <em>any</em> constructor removes the free default one. `class A { A(int x) {} }` means `new A()` no longer compiles — a common surprise with frameworks (JPA, Jackson) that need a no-arg constructor.

# Initializer blocks

> [!NOTE] Static initializer static { … }
>
> Runs <strong>once</strong>, when the class is initialised (first active use). For complex static setup.

> [!NOTE] Instance initializer { … }
>
> Runs on <strong>every</strong> `new`, before the constructor body — the compiler copies it into each constructor after `super()`.

# The full initialization order

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println("-- first new Child()");
        new Child();
        System.out.println("-- second new Child()");
        new Child();
    }
}

class Parent {
    static { System.out.println("1. Parent static block"); }
    { System.out.println("3. Parent instance block"); }
    Parent() { System.out.println("4. Parent constructor"); }
}

class Child extends Parent {
    static { System.out.println("2. Child static block"); }
    private String name = init();
    { System.out.println("6. Child instance block"); }
    Child() { System.out.println("7. Child constructor"); }

    private String init() { System.out.println("5. Child field initializer"); return "child"; }
}
```

```text filename:Output
-- first new Child()
1. Parent static block
2. Child static block
3. Parent instance block
4. Parent constructor
5. Child field initializer
6. Child instance block
7. Child constructor
-- second new Child()
3. Parent instance block
4. Parent constructor
5. Child field initializer
6. Child instance block
7. Child constructor
```

1. <strong>Static, parent first</strong>

   Superclass static fields/blocks, then subclass static fields/blocks — once per class, in textual order.

2. <strong>Parent instance part</strong>

   `super(...)` runs first: parent field initialisers + instance blocks (textual order), then parent constructor body.

3. <strong>Child instance part</strong>

   Child field initialisers + instance blocks in textual order, then the child constructor body.

# Pitfall: calling an overridable method from a constructor

```java filename:Java
public class Main {
    public static void main(String[] args) {
        new Sub();
    }
}

class Base {
    Base() { describe(); }            // dynamic dispatch — calls Sub.describe()
    void describe() { System.out.println("Base"); }
}

class Sub extends Base {
    private String label = "ready";
    @Override void describe() { System.out.println("Sub label = " + label); }
}
```

```text filename:Output
Sub label = null
```

> [!WARNING] Watch out
>
> The subclass override runs <em>before</em> the subclass's fields are initialised, so it sees `null`/`0`. Never call overridable methods from a constructor — make them `private` or `final`.

```question
Can a constructor be private? Why would you do that?

---

Yes. It stops other classes from calling `new` — used for singletons, static factory methods (`List.of`), and utility classes like `Math` or `Collections`.
```

```question
Is a constructor inherited? Can it be overridden?

---

Neither. Constructors are not members that are inherited, so they cannot be overridden. A subclass must call a superclass constructor (implicitly `super()` or explicitly `super(args)`).
```

```question
Can a constructor return a value or be final/static?

---

No return type at all (writing `void` turns it into an ordinary method with the class's name!). It cannot be `static`, `final`, `abstract` or `synchronized`.
```

```question
In what order do static blocks, instance blocks and constructors run?

---

Static blocks: once per class, parent before child. Then for each `new`: parent instance initialisers → parent constructor → child instance initialisers (fields and blocks in source order) → child constructor.
```
