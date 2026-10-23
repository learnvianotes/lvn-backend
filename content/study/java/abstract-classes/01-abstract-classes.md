---
id: 7f9788b7-e30e-7ed2-86dc-09f745352c9e
key: topic:java/abstract-classes
subject: java
topic: abstract-classes
title: Abstract Classes
slug: abstract-classes
order: 1
---

An `abstract` class is a partial implementation: it can hold state, constructors and concrete methods, but leaves some methods for subclasses to fill in.

> [!INFO]
>
> <strong>Abstract class</strong> — a class declared `abstract` that <strong>cannot be instantiated</strong>. It may declare `abstract` methods (no body) that every concrete subclass must implement.

# Rules

- A class with at least one abstract method <strong>must</strong> be declared `abstract` (an abstract class may also have none).
- It can have constructors (called via `super(...)`), instance fields, static members, `final` and `private` methods.
- A concrete subclass must implement <em>all</em> inherited abstract methods, or be `abstract` itself.
- `abstract` can't be combined with `final`, `static` or `private` on a method — those can't be overridden.

```java filename:Java
abstract class Shape {
    abstract double area();
}

public class Main {
    public static void main(String[] args) {
        Shape s = new Shape();
    }
}
```

```text filename:javac
Main.java:7: error: Shape is abstract; cannot be instantiated
        Shape s = new Shape();
                  ^
```

# Template method pattern

The abstract class fixes the <em>algorithm skeleton</em> in a `final` method and lets subclasses supply the varying steps.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        new CsvReport().generate();
        new JsonReport().generate();
    }
}

abstract class Report {
    private final String title;
    protected Report(String title) { this.title = title; }   // abstract classes have constructors

    // template method: fixed order, cannot be overridden
    public final void generate() {
        System.out.println("== " + title + " ==");
        System.out.println(header());
        System.out.println(body());
        footer();
    }

    protected abstract String header();       // required steps
    protected abstract String body();
    protected void footer() { System.out.println("-- end --"); }   // optional hook
}

class CsvReport extends Report {
    CsvReport() { super("CSV"); }
    @Override protected String header() { return "name,score"; }
    @Override protected String body() { return "asha,91"; }
}

class JsonReport extends Report {
    JsonReport() { super("JSON"); }
    @Override protected String header() { return "{"; }
    @Override protected String body() { return "  \"asha\": 91\n}"; }
    @Override protected void footer() { }                             // override the hook
}
```

```text filename:Output
== CSV ==
name,score
asha,91
-- end --
== JSON ==
{
  "asha": 91
}
```

# Anonymous subclass of an abstract class

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Greeter g = new Greeter("Asha") {          // anonymous concrete subclass
            @Override String greeting() { return "Namaste"; }
        };
        System.out.println(g.greet());
    }
}

abstract class Greeter {
    private final String name;
    Greeter(String name) { this.name = name; }
    abstract String greeting();
    String greet() { return greeting() + ", " + name + "!"; }
}
```

```text filename:Output
Namaste, Asha!
```

# When to choose an abstract class

> [!NOTE] Use an abstract class when…
>
> Subclasses are closely related and share <strong>state</strong> or constructor logic; you want `protected` helpers or a fixed template method.

> [!NOTE] Use an interface when…
>
> You define a <em>capability</em> unrelated classes can have (`Comparable`, `Runnable`), or need a type to have several such capabilities.

```question
Can an abstract class have a constructor? Why?

---

Yes. It can't be called with `new` directly, but subclasses call it via `super(...)` to initialise the fields the abstract class declares.
```

```question
Can an abstract class have no abstract methods?

---

Yes — marking it `abstract` simply prevents instantiation (e.g. `HttpServlet` had none historically). It signals <em>extend me, don't use me directly</em>.
```

```question
Can an abstract method be private, static or final?

---

No. An abstract method must be overridden; `private` methods aren't inherited, `static` methods are hidden not overridden, and `final` forbids overriding.
```
