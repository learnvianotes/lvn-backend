---
id: 9096eac4-0423-77dd-914c-a2d3c0e7043d
key: topic:java/design-patterns-creational
subject: java
topic: design-patterns-creational
title: "Design Patterns: Singleton, Builder & Factory"
slug: design-patterns-singleton-builder-factory
order: 1
---

Creational patterns control <em>how objects get made</em>: exactly one (Singleton), step by step (Builder), or without the caller naming the concrete class (Factory).

# Singleton

> [!INFO]
>
> <strong>Singleton</strong> — a class with exactly one instance and a global access point to it. Private constructor + a static way to get the instance.

| Variant | Lazy? | Thread-safe? | Notes |
| --- | --- | --- | --- |
| Eager `static final` field | No — created at class init | Yes (class init is thread-safe) | Simplest; fine when creation is cheap |
| `synchronized getInstance()` | Yes | Yes | Lock on every call — slow |
| Double-checked locking | Yes | Yes <strong>only with </strong><strong>`volatile`</strong> | Verbose; easy to get wrong |
| Holder idiom (static nested class) | Yes | Yes | JVM class-loading guarantees; no locks |
| `enum` with one constant | At enum init | Yes | <strong>Recommended</strong> (Effective Java): also safe against reflection and serialization |

```java filename:Java
public class Main {
    // 1. Eager
    static final class Eager {
        private static final Eager INSTANCE = new Eager();
        private Eager() {}
        static Eager getInstance() { return INSTANCE; }
    }

    // 2. Double-checked locking — volatile prevents seeing a half-constructed object
    static final class Dcl {
        private static volatile Dcl instance;
        private Dcl() {}
        static Dcl getInstance() {
            Dcl local = instance;
            if (local == null) {                       // 1st check, no lock
                synchronized (Dcl.class) {
                    local = instance;
                    if (local == null) {               // 2nd check, with lock
                        instance = local = new Dcl();
                    }
                }
            }
            return local;
        }
    }

    // 3. Holder idiom — Holder is initialised on first getInstance() call
    static final class Lazy {
        private Lazy() { System.out.println("Lazy created"); }
        private static final class Holder { static final Lazy INSTANCE = new Lazy(); }
        static Lazy getInstance() { return Holder.INSTANCE; }
    }

    // 4. Enum
    enum Config {
        INSTANCE;
        private int timeout = 30;
        int timeout() { return timeout; }
    }

    public static void main(String[] args) {
        System.out.println(Eager.getInstance() == Eager.getInstance());
        System.out.println(Dcl.getInstance() == Dcl.getInstance());
        System.out.println("before first use");
        System.out.println(Lazy.getInstance() == Lazy.getInstance());
        System.out.println(Config.INSTANCE.timeout());
    }
}
```

```text filename:Output
true
true
before first use
Lazy created
true
30
```

> [!WARNING] Double-checked locking
>
> Without `volatile`, double-checked locking is broken: the write of the reference can be reordered before the constructor's field writes, so another thread may see a non-null but not fully initialised object.

# Breaking a singleton — and the enum defence

```java filename:Java
import java.lang.reflect.Constructor;

public class Main {
    static final class Classic {
        static final Classic INSTANCE = new Classic();
        private Classic() {}
    }

    enum Single { INSTANCE }

    public static void main(String[] args) throws Exception {
        Constructor<Classic> c = Classic.class.getDeclaredConstructor();
        c.setAccessible(true);                       // bypass `private`
        Classic second = c.newInstance();
        System.out.println("classic still single? " + (second == Classic.INSTANCE));

        Constructor<Single> e = Single.class.getDeclaredConstructor(String.class, int.class);
        e.setAccessible(true);
        try {
            e.newInstance("INSTANCE", 0);
        } catch (IllegalArgumentException ex) {
            System.out.println(ex.getMessage());
        }
    }
}
```

```text filename:Output
classic still single? false
Cannot reflectively create enum objects
```

```java filename:Java
import java.io.*;

public class Main {
    static final class Settings implements Serializable {
        private static final long serialVersionUID = 1L;
        static final Settings INSTANCE = new Settings();
        private Settings() {}

        private Object readResolve() {       // deserialization returns this instead
            return INSTANCE;
        }
    }

    public static void main(String[] args) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(Settings.INSTANCE);
        }
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            Object copy = in.readObject();
            System.out.println(copy == Settings.INSTANCE);   // false without readResolve
        }
    }
}
```

```text filename:Output
true
```

> [!NOTE] Key point
>
> Singletons are global state: they hide dependencies and make unit tests hard. In application code prefer <em>one instance created at startup and passed in</em> (dependency injection — what Spring beans are by default).

# Builder

For classes with many parameters, especially optional ones. Replaces <em>telescoping constructors</em> and avoids the half-built objects of the JavaBeans setter style.

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static final class Pizza {
        private final String size;              // required
        private final boolean extraCheese;      // optional
        private final List<String> toppings;    // optional

        private Pizza(Builder b) {
            this.size = b.size;
            this.extraCheese = b.extraCheese;
            this.toppings = List.copyOf(b.toppings);
        }

        static Builder builder(String size) { return new Builder(size); }

        @Override
        public String toString() {
            return size + " pizza, cheese=" + extraCheese + ", toppings=" + toppings;
        }

        static final class Builder {
            private final String size;
            private boolean extraCheese;
            private final List<String> toppings = new ArrayList<>();

            private Builder(String size) { this.size = size; }

            Builder extraCheese() { this.extraCheese = true; return this; }
            Builder topping(String t) { toppings.add(t); return this; }

            Pizza build() {
                if (toppings.size() > 5) throw new IllegalStateException("too many toppings");
                return new Pizza(this);
            }
        }
    }

    public static void main(String[] args) {
        Pizza p = Pizza.builder("large")
                .topping("olives")
                .topping("basil")
                .extraCheese()
                .build();
        System.out.println(p);
    }
}
```

```text filename:Output
large pizza, cheese=true, toppings=[olives, basil]
```

`StringBuilder` · `HttpRequest.newBuilder()` · `Stream.builder()` · `Locale.Builder` · Lombok `@Builder`

# Factories

> [!NOTE] Static factory method
>
> A `static` method that returns an instance: `List.of`, `Integer.valueOf`, `Optional.empty`. Has a <em>name</em>, can cache (`valueOf`), can return a subtype.

> [!NOTE] Simple factory
>
> One method picks the concrete class from a parameter — callers depend only on the interface.

> [!NOTE] Factory Method (GoF)
>
> A superclass defines an abstract `createX()` and subclasses decide which class to instantiate.

> [!NOTE] Abstract Factory
>
> An interface for creating <em>families</em> of related objects (e.g. a UI kit: `createButton`, `createCheckbox`).

```java filename:Java
public class Main {
    sealed interface Shape permits Circle, Square {
        double area();

        static Shape of(String kind, double size) {        // simple / static factory
            return switch (kind) {
                case "circle" -> new Circle(size);
                case "square" -> new Square(size);
                default -> throw new IllegalArgumentException("unknown shape: " + kind);
            };
        }
    }

    record Circle(double r) implements Shape {
        public double area() { return Math.PI * r * r; }
    }

    record Square(double side) implements Shape {
        public double area() { return side * side; }
    }

    public static void main(String[] args) {
        Shape s = Shape.of("square", 3);
        System.out.println(s + " area=" + s.area());
        System.out.printf("%.2f%n", Shape.of("circle", 1).area());
        System.out.println(Integer.valueOf(100) == Integer.valueOf(100));   // valueOf caches
    }
}
```

```text filename:Output
Square[side=3.0] area=9.0
3.14
true
```

```question
Which singleton implementation would you use and why?

---

An `enum` with a single constant: it is thread-safe by class initialisation, serialization returns the same constant automatically, and reflection cannot create a second instance. If laziness matters and the class must extend something, use the holder idiom.
```

```question
Why must the instance field be volatile in double-checked locking?

---

`instance = new X()` is allocate → initialise → publish; without `volatile` the publish can be reordered before initialisation, so a thread that skips the lock could see a non-null reference to an object whose fields are still defaults. `volatile` adds the happens-before edge that forbids this.
```

```question
When would you choose a builder over constructors?

---

When there are more than a handful of parameters, several are optional, or several have the same type (easy to swap by mistake). The builder gives named, readable calls and still produces an immutable object validated in one place (`build()`).
```
