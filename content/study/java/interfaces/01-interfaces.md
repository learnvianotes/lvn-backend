---
id: dfa86468-c770-7dfc-8808-710da092ea7c
key: topic:java/interfaces
subject: java
topic: interfaces
title: Interfaces
slug: interfaces
order: 1
---

An interface is a contract of methods a class promises to provide. A class can implement many interfaces — Java's answer to multiple inheritance.

> [!INFO]
>
> <strong>Interface</strong> — a reference type declaring abstract methods (plus, since Java 8, `default` and `static` methods, and since Java 9, `private` methods). Fields are implicitly `public static final` constants.

# What an interface can contain

| Member | Implicit modifiers | Since |
| --- | --- | --- |
| Abstract method | `public abstract` | 1.0 |
| Constant field | `public static final` | 1.0 |
| `default` method (has a body, inherited) | `public` | 8 |
| `static` method (called on the interface only) | `public` | 8 |
| `private` / `private static` helper method | — | 9 |
| Nested types | `public static` | 1.0 |

# Implementing several interfaces

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        Duck duck = new Duck();
        List<Swimmer> swimmers = new ArrayList<>(List.of(duck, new Fish()));
        for (Swimmer s : swimmers) s.swim();
        Flyer f = duck;                     // a Duck is also a Flyer
        f.fly();
        System.out.println(Flyer.MAX_ALTITUDE);
        System.out.println(duck instanceof Swimmer && duck instanceof Flyer);
    }
}

interface Swimmer { void swim(); }
interface Flyer {
    int MAX_ALTITUDE = 10_000;              // public static final
    void fly();
}

class Duck implements Swimmer, Flyer {
    public void swim() { System.out.println("duck paddles"); }   // must be public
    public void fly()  { System.out.println("duck flies"); }
}

class Fish implements Swimmer {
    public void swim() { System.out.println("fish swims"); }
}
```

```text filename:Output
duck paddles
fish swims
duck flies
10000
true
```

# Default, static and private methods

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Greeter en = name -> "Hello, " + name;    // one abstract method → lambda works
        System.out.println(en.greet("Asha"));
        System.out.println(en.greetLoudly("Ravi"));      // default method
        System.out.println(Greeter.polite().greet("Meera"));   // static factory
    }
}

interface Greeter {
    String greet(String name);                  // abstract

    default String greetLoudly(String name) {   // inherited, can be overridden
        return shout(greet(name));
    }

    static Greeter polite() {                   // Greeter.polite(), not inherited by implementers
        return name -> "Good evening, " + name;
    }

    private String shout(String s) {            // helper shared by default methods
        return s.toUpperCase() + "!";
    }
}
```

```text filename:Output
Hello, Asha
HELLO, RAVI!
Good evening, Meera
```

> [!NOTE] Key point
>
> Default methods exist so interfaces can <strong>evolve</strong>: Java 8 added `forEach`, `stream()`, `removeIf` to `Collection`/`Iterable` without breaking millions of existing implementations.

# The diamond problem with default methods

If a class inherits the same default method from two interfaces, it must override it and may pick one with `Interface.super.method()`. Rules: (1) a class method always wins over an interface default; (2) a more specific sub-interface wins; (3) otherwise you must resolve it yourself.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(new Phone().start());
    }
}

interface Camera { default String start() { return "camera on"; } }
interface Radio  { default String start() { return "radio on"; } }

class Phone implements Camera, Radio {
    @Override public String start() {           // required: otherwise compile error
        return Camera.super.start() + " + " + Radio.super.start();
    }
}
```

```text filename:Output
camera on + radio on
```

```java filename:Java
interface Camera { default String start() { return "camera on"; } }
interface Radio  { default String start() { return "radio on"; } }
class Phone implements Camera, Radio { }
```

```text filename:javac
Main.java:3: error: types Camera and Radio are incompatible;
class Phone implements Camera, Radio { }
^
  class Phone inherits unrelated defaults for start() from types Camera and Radio
```

# Abstract class vs interface

|  | Abstract class | Interface |
| --- | --- | --- |
| Instance state (fields) | Yes | No — only `public static final` constants |
| Constructors | Yes | No |
| Multiple inheritance | No — `extends` one class | Yes — `implements` many |
| Method bodies | Any | `default`, `static`, `private` only |
| Member access | Any modifier | `public` (or `private` helpers) |
| Relationship | IS-A (shared identity) | CAN-DO (capability) |
| Lambda target | No | Yes, if exactly one abstract method (functional interface) |

# Marker and functional interfaces

> [!NOTE] Marker interface
>
> No methods at all; tags a class for special treatment: `Serializable`, `Cloneable`, `RandomAccess`. Modern code often uses annotations instead.

> [!NOTE] Functional interface
>
> Exactly one abstract method, so a lambda or method reference can implement it: `Runnable`, `Comparator`, `Function`. Mark with `@FunctionalInterface`.

```java filename:Java
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.RandomAccess;

public class Main {
    static String strategy(List<?> list) {
        return list instanceof RandomAccess ? "index loop" : "iterator";
    }

    public static void main(String[] args) {
        System.out.println(strategy(new ArrayList<>()));
        System.out.println(strategy(new LinkedList<>()));
    }
}
```

```text filename:Output
index loop
iterator
```

```question
Why were default methods added in Java 8?

---

For backward-compatible interface evolution: new methods (like `Collection.stream()`) could be added with a body so existing implementing classes kept compiling. They also let interfaces offer convenience methods (`Comparator.reversed()`).
```

```question
Can an interface have a constructor or instance fields?

---

No. Interfaces carry no per-object state; any field is implicitly `public static final`. That is exactly why multiple interface inheritance is safe.
```

```question
Can an interface extend another interface? A class?

---

An interface can `extend` any number of interfaces (`interface C extends A, B`). It can never extend a class.
```

```question
If a class and an interface both provide the same method, which wins?

---

The class. “Class wins” — a concrete (or inherited superclass) method always takes precedence over an interface default method.
```
