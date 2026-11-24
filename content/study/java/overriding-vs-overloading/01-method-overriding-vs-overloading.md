---
id: 7cb42524-911b-7274-beab-6fd0f4b45a58
key: topic:java/overriding-vs-overloading
subject: java
topic: overriding-vs-overloading
title: Method Overriding vs Overloading
slug: method-overriding-vs-overloading
order: 1
---

Overloading = same name, different parameters, chosen at compile time. Overriding = same signature in a subclass, chosen at runtime.

# Side by side

|  | Overloading | Overriding |
| --- | --- | --- |
| Where | Same class (or inherited) | Subclass redefines a superclass/interface method |
| Signature | Same name, <strong>different parameter list</strong> | Same name <strong>and</strong> same parameters |
| Return type | Anything | Same or a subtype (<em>covariant</em>) |
| Access | Anything | Same or <strong>wider</strong> |
| Checked exceptions | Anything | Same, narrower or none — never new/broader |
| Resolved | Compile time (static binding) | Runtime (dynamic dispatch) |
| `static` / `private` / `final` | Can be overloaded | Cannot be overridden |
| Polymorphism kind | Compile-time | Runtime |

# Overloading

```java filename:Java
public class Main {
    static String show(int x)          { return "int " + x; }
    static String show(long x)         { return "long " + x; }
    static String show(double x)       { return "double " + x; }
    static String show(Integer x)      { return "Integer " + x; }
    static String show(Object x)       { return "Object " + x; }
    static String show(int... xs)      { return "varargs " + xs.length; }

    public static void main(String[] args) {
        byte b = 5;
        System.out.println(show(7));        // exact match
        System.out.println(show(b));        // widening byte → int beats boxing
        System.out.println(show(7L));
        System.out.println(show(7.0f));     // float → double
        System.out.println(show("hi"));     // String → Object
        System.out.println(show());         // only varargs fits
    }
}
```

```text filename:Output
int 7
int 5
long 7
double 7.0
Object hi
varargs 0
```

> [!NOTE] Key point
>
> Overload resolution picks the most specific method in three phases: (1) exact/widening, (2) boxing/unboxing, (3) varargs. The return type alone never distinguishes overloads.

# Overriding with `@Override`

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Shape s = new Circle(2);           // reference type Shape, object Circle
        System.out.println(s.name());      // runtime: Circle.name()
        Circle copy = new Circle(2).copy();   // covariant return: no cast needed
        System.out.printf("%.2f%n", copy.area());
    }
}

class Shape {
    protected String name() { return "shape"; }
    Shape copy() { return new Shape(); }
    double area() { return 0; }
}

class Circle extends Shape {
    private final double r;
    Circle(double r) { this.r = r; }

    @Override public String name() { return "circle"; }        // protected → public: widening OK
    @Override Circle copy() { return new Circle(r); }          // covariant return type
    @Override double area() { return Math.PI * r * r; }
}
```

```text filename:Output
circle
12.57
```

> [!WARNING] Watch out
>
> Always write `@Override`. Without it, a typo or wrong parameter type silently creates an <em>overload</em> instead — e.g. `public boolean equals(Point p)` does not override `equals(Object)`.

```java filename:Java
class Point {
    int x;
    @Override
    public boolean equals(Point other) { return other.x == x; }   // wrong parameter type
}
```

```text filename:javac
Main.java:3: error: method does not override or implement a method from a supertype
    @Override
    ^
```

# Rules the compiler enforces

```java filename:Java
import java.io.IOException;

class Parent {
    public void run() { }
    void load() throws IOException { }
}

class Child extends Parent {
    @Override protected void run() { }   // narrowing public → protected
}
```

```text filename:javac
Main.java:9: error: run() in Child cannot override run() in Parent
    @Override protected void run() { }   // narrowing public → protected
                             ^
  attempting to assign weaker access privileges; was public
```

- An override <strong>may</strong> throw fewer or narrower checked exceptions (`FileNotFoundException` instead of `IOException`), or none; unchecked exceptions are unrestricted.
- `final` methods can't be overridden; `private` methods aren't inherited, so a same-named subclass method is just a new method.
- Call the parent version with `super.method()`.

# Static methods are hidden, not overridden

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Parent p = new Child();
        System.out.println(p.stat());      // static: chosen by reference type
        System.out.println(p.inst());      // instance: chosen by object type
        System.out.println(p.label);       // fields are hidden too
        System.out.println(((Child) p).label);
    }
}

class Parent {
    String label = "parent-field";
    static String stat() { return "Parent.stat"; }
    String inst() { return "Parent.inst"; }
}

class Child extends Parent {
    String label = "child-field";
    static String stat() { return "Child.stat"; }
    @Override String inst() { return "Child.inst"; }
}
```

```text filename:Output
Parent.stat
Child.inst
parent-field
child-field
```

```question
Can we overload main?

---

Yes — any number of `main` overloads may exist, but the JVM only launches `public static void main(String[] args)`.
```

```question
Can we override a static or private method?

---

No. A static method with the same signature <em>hides</em> the parent's (resolved by reference type at compile time). A private method isn't visible to the subclass, so a same-named method is a brand-new method.
```

```question
Can two overloads differ only by return type?

---

No. The call `f(1)` wouldn't tell the compiler which one you want, so it's a compile error (`method f(int) is already defined`).
```

```question
What is a covariant return type?

---

An overriding method may return a <em>subtype</em> of the parent method's return type — e.g. `Circle copy()` overriding `Shape copy()` — so callers need no cast. `clone()` overrides commonly use it.
```
