---
id: 18c359f2-4028-7d26-8777-00c05cf00b2a
key: topic:java/interview-qa
subject: java
topic: interview-qa
title: Java Interview Q&A
slug: java-interview-q-a
order: 1
---

The most frequently asked Java interview questions with crisp answers — a final revision sheet.

# Platform and basics

```question
What are the JDK, JRE and JVM?

---

The <strong>JVM</strong> executes bytecode (interpreter + JIT + GC). The <strong>JRE</strong> is the JVM plus the standard class libraries — enough to <em>run</em> programs. The <strong>JDK</strong> is the JRE plus development tools (`javac`, `jar`, `jshell`, `jcmd`…) — needed to <em>build</em> them. Since Java 11 there's no separate JRE download; `jlink` builds custom runtimes.
```

```question
Why is Java platform independent?

---

`javac` compiles source to platform-neutral <strong>bytecode</strong> (`.class` files). Each OS has its own JVM that runs that same bytecode. “Write once, run anywhere” — the JVM is platform-specific, the bytecode isn't.
```

```question
Is Java pass-by-value or pass-by-reference?

---

Always pass-by-value. For objects, the value copied is the <em>reference</em>: the method can mutate the object it points to, but reassigning the parameter never affects the caller's variable.
```

```java filename:Java
public class Main {
    static void reassign(StringBuilder sb) { sb = new StringBuilder("new"); }
    static void mutate(StringBuilder sb) { sb.append("!"); }

    public static void main(String[] args) {
        StringBuilder s = new StringBuilder("old");
        reassign(s);
        mutate(s);
        System.out.println(s);
    }
}
```

```text filename:Output
old!
```

```question
What is the difference between == and equals()?

---

`==` compares primitive values, or for references whether both point to the <em>same object</em>. `equals()` compares logical equality as defined by the class (`String`, `Integer`, records…); the default `Object.equals` is identity.
```

```question
What is the contract between equals() and hashCode()?

---

Equal objects must have equal hash codes. Unequal objects may collide. If you override `equals` without `hashCode`, equal objects land in different buckets and `HashMap`/`HashSet` lookups fail.
```

```question
Why is String immutable? StringBuilder vs StringBuffer?

---

Immutability makes the string pool safe, allows caching the hash code, gives thread safety and security (values can't change after validation). `StringBuilder` is a mutable, unsynchronized buffer — use it in single-threaded code; `StringBuffer` is the older synchronized version, rarely needed.
```

```question
final vs finally vs finalize?

---

`final`: a variable can't be reassigned, a method can't be overridden, a class can't be extended. `finally`: a block that always runs after `try`/`catch`. `finalize()`: a deprecated `Object` method the GC might call before reclaiming an object — don't use it; use `try-with-resources` or `Cleaner`.
```

```java filename:Java
public class Main {
    @SuppressWarnings("finally")
    static int tricky() {
        try {
            return 1;
        } finally {
            return 2;          // overrides the try's return (and would swallow exceptions)
        }
    }

    static int counter() {
        int x = 10;
        try {
            return x;          // value 10 is saved now
        } finally {
            x = 20;            // changing x does not change the saved return value
        }
    }

    public static void main(String[] args) {
        System.out.println(tricky() + " " + counter());
    }
}
```

```text filename:Output
2 10
```

# OOP

```question
Overloading vs overriding?

---

<strong>Overloading</strong>: same name, different parameter lists, in the same class — resolved at <em>compile time</em> by the static types of the arguments. <strong>Overriding</strong>: a subclass redefines an inherited instance method with the same signature — resolved at <em>run time</em> by the object's actual class (dynamic dispatch). Static methods can't be overridden, only <em>hidden</em>.
```

```java filename:Java
public class Main {
    static class Animal {
        static String kind() { return "animal"; }
        String sound() { return "..."; }
    }
    static class Dog extends Animal {
        static String kind() { return "dog"; }          // hides, doesn't override
        @Override String sound() { return "woof"; }
    }

    static void print(Object o) { System.out.println("object"); }
    static void print(String s) { System.out.println("string"); }

    public static void main(String[] args) {
        Animal a = new Dog();
        System.out.println(a.sound());     // runtime type decides
        System.out.println(Animal.kind() + " " + Dog.kind());
        Object o = "text";
        print(o);                          // compile-time type decides
        print("text");
    }
}
```

```text filename:Output
woof
animal dog
object
string
```

```question
Abstract class vs interface?

---

An abstract class can have state (instance fields), constructors and any access level; a class can extend only one. An interface has no instance state, only constants, abstract, `default`, `static` and `private` methods; a class can implement many. Use an interface for a capability/contract (“can be compared”), an abstract class for sharing code and state among closely related classes.
```

```question
What are the four pillars of OOP in Java?

---

<strong>Encapsulation</strong> (private state behind methods), <strong>Inheritance</strong> (`extends`, code reuse and is-a), <strong>Polymorphism</strong> (one interface, many implementations — overriding and dynamic dispatch), <strong>Abstraction</strong> (expose what, hide how — interfaces and abstract classes).
```

```question
Static vs instance members?

---

Static members belong to the class — one copy, accessed via the class name, loaded when the class initialises. Instance members belong to each object. Static methods have no `this`, so they can't access instance members directly.
```

```question
Records vs regular classes?

---

A record is a transparent, shallowly immutable data carrier: the compiler generates the canonical constructor, accessors, `equals`, `hashCode` and `toString`. Records are implicitly `final`, can't extend another class and can't declare instance fields beyond their components — but can implement interfaces and add methods and validation.
```

```question
What are sealed classes for?

---

`sealed ... permits A, B` restricts which classes may extend or implement a type. The hierarchy becomes closed and known to the compiler, so a pattern-matching `switch` over it can be checked for exhaustiveness without a `default`.
```

# Exceptions

```question
Checked vs unchecked exceptions?

---

Checked exceptions (subclasses of `Exception` but not `RuntimeException`, e.g. `IOException`) must be caught or declared with `throws` — for recoverable conditions outside the program's control. Unchecked exceptions (`RuntimeException` and subclasses, e.g. `NullPointerException`, `IllegalArgumentException`) signal programming errors and need not be declared. `Error`s (`OutOfMemoryError`) are serious JVM problems you normally don't catch.
```

```question
What does try-with-resources do?

---

It closes every resource declared in the header (anything `AutoCloseable`) automatically, in reverse order, even when an exception occurs. If both the body and `close()` throw, the close exception is attached to the primary one as a <em>suppressed</em> exception instead of replacing it.
```

# Collections

```question
How does HashMap work internally?

---

An array of buckets. `put` computes `hashCode()`, spreads it (`h ^ (h >>> 16)`), and picks bucket `hash & (n - 1)`. Collisions are chained in a linked list; a bucket with more than 8 entries (when the table has at least 64 buckets) becomes a red-black tree, so worst-case lookup is O(log n). When size exceeds capacity × load factor (0.75), the table doubles and entries are redistributed. `get` finds the bucket, then compares with `hashCode` and `equals`.
```

```question
HashMap vs Hashtable vs ConcurrentHashMap?

---

`HashMap`: not thread-safe, allows one `null` key and `null` values. `Hashtable`: legacy, every method synchronized on one lock, no nulls. `ConcurrentHashMap`: thread-safe with fine-grained locking (CAS + per-bin locks), lock-free reads, atomic `compute`/`merge`, no nulls, weakly consistent iterators — the one to use for concurrency.
```

```question
Fail-fast vs fail-safe iterators?

---

Fail-fast iterators (`ArrayList`, `HashMap`) track a `modCount` and throw `ConcurrentModificationException` if the collection is structurally modified during iteration other than through the iterator. Fail-safe / weakly consistent iterators (`CopyOnWriteArrayList`, `ConcurrentHashMap`) iterate over a snapshot or tolerate concurrent changes and never throw it.
```

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));
        try {
            for (Integer n : nums) {
                if (n % 2 == 0) nums.remove(n);      // structural change during for-each
            }
        } catch (ConcurrentModificationException e) {
            System.out.println("ConcurrentModificationException");
        }
        nums = new ArrayList<>(List.of(1, 2, 3, 4));
        nums.removeIf(n -> n % 2 == 0);              // the safe way
        System.out.println(nums);
    }
}
```

```text filename:Output
ConcurrentModificationException
[1, 3]
```

```question
Comparable vs Comparator?

---

`Comparable<T>` is implemented by the class itself (`compareTo`) and defines its single <em>natural ordering</em> (`String`, `Integer`). `Comparator<T>` is a separate object (`compare`) defining any number of <em>external</em> orderings, and composes: `Comparator.comparing(Person::age).thenComparing(Person::name).reversed()`.
```

```question
ArrayList vs LinkedList?

---

`ArrayList` is a resizable array: O(1) random access, amortised O(1) append, O(n) insert/remove in the middle, cache-friendly. `LinkedList` is a doubly linked list: O(1) at the ends (or at an iterator position), O(n) access by index, high memory overhead per node. In practice `ArrayList` (or `ArrayDeque` for queues) wins almost always.
```

# Concurrency

```question
volatile vs synchronized vs atomic classes?

---

`volatile` guarantees <em>visibility</em> and ordering of a single variable's reads/writes, but not atomicity of compound actions like `count++`. `synchronized` gives mutual exclusion <em>and</em> visibility for a whole block. `AtomicInteger` &amp; co. make single-variable read-modify-write operations atomic with lock-free CAS — ideal for counters.
```

```question
wait() vs sleep()?

---

`wait()` is an `Object` method, must be called while holding that object's monitor, <em>releases</em> the lock and waits for `notify`/`notifyAll` (or a timeout). `Thread.sleep()` is static, needs no lock and <em>keeps</em> any locks it holds while pausing for a fixed time.
```

```question
Runnable vs Callable?

---

`Runnable.run()` returns nothing and can't throw checked exceptions. `Callable<V>.call()` returns a value and may throw `Exception`; submitting it to an `ExecutorService` gives a `Future<V>` to fetch the result.
```

```question
What are virtual threads?

---

Lightweight threads (Java 21) scheduled by the JVM onto a few platform (OS) threads. When a virtual thread blocks on I/O it unmounts, freeing the carrier thread, so you can run millions of blocking tasks with simple thread-per-request code. Great for I/O-bound work; no gain for CPU-bound work. Don't pool them.
```

```question
What is a deadlock and how do you prevent it?

---

Two or more threads each hold a lock the other needs, so all wait forever. Prevent it by acquiring locks in a single global order, holding locks briefly, using `tryLock` with timeouts, or avoiding shared mutable state (immutable objects, concurrent collections).
```

# JVM and memory

```question
What are the JVM memory areas?

---

Heap (objects; young + old generations), per-thread stacks (frames with locals), metaspace (class metadata, native memory), PC registers, native method stacks and the code cache (JIT output).
```

```question
How does garbage collection decide what to free?

---

It traces from GC roots (thread stacks, static fields, JNI refs) and marks every reachable object; everything else is garbage, cycles included. Collection is generational: frequent cheap minor GCs for the young generation, rarer old-generation collections. G1 is the default collector; ZGC offers sub-millisecond pauses.
```

```question
What is the difference between a ClassNotFoundException and a NoClassDefFoundError?

---

`ClassNotFoundException` is a checked exception when code loads a class <em>by name</em> at run time (`Class.forName`) and it isn't on the classpath. `NoClassDefFoundError` is an `Error` when a class that was present at <em>compile time</em> can't be found or failed to initialise when the JVM links it at run time.
```

# Functional Java

```question
What is a functional interface?

---

An interface with exactly one abstract method (it may have default/static methods), e.g. `Runnable`, `Comparator`, `Function<T,R>`, `Predicate<T>`. Lambdas and method references are instances of functional interfaces; `@FunctionalInterface` makes the compiler enforce the rule.
```

```question
Why are streams called lazy?

---

Intermediate operations (`filter`, `map`, `sorted`) only build a pipeline; nothing runs until a terminal operation (`collect`, `forEach`, `count`). Elements then flow one at a time through the whole pipeline, and short-circuiting operations (`findFirst`, `limit`, `anyMatch`) stop early.
```

```java filename:Java
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        Stream<Integer> pipeline = Stream.of(1, 2, 3, 4, 5)
                .filter(n -> { System.out.println("filter " + n); return n % 2 == 0; })
                .map(n -> { System.out.println("map " + n); return n * 10; });
        System.out.println("nothing has run yet");
        System.out.println("first = " + pipeline.findFirst().get());
    }
}
```

```text filename:Output
nothing has run yet
filter 1
filter 2
map 2
first = 20
```

```question
How should Optional be used?

---

As a <em>return type</em> for methods that may have no result, forcing callers to handle absence: `findUser(id).map(User::name).orElse("guest")`. Don't use it for fields, parameters or collections, and avoid bare `get()` — prefer `orElse`, `orElseGet`, `orElseThrow`, `map`, `ifPresent`.
```

```question
map() vs flatMap() in streams?

---

`map` transforms each element into exactly one element. `flatMap` transforms each element into a <em>stream</em> and flattens those streams into one — e.g. a list of sentences into a stream of words.
```

# Rapid-fire tricks

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(10 / 3 + " " + 10 % 3 + " " + 10 / 3.0);
        System.out.println((byte) 200);                 // narrowing wraps
        char c = 'A';
        c += 1;                                         // compound assignment casts implicitly
        System.out.println(c);
        int i = 5;
        i = i++ + ++i;                                  // 5 + 7
        System.out.println(i);
        System.out.println(Integer.MAX_VALUE + 1);
        System.out.println(1.0 / 0 + " " + (0.0 / 0 == 0.0 / 0));
        String s = null;
        System.out.println(s + "x");                    // concatenation turns null into "null"
    }
}
```

```text filename:Output
3 1 3.3333333333333335
-56
B
12
-2147483648
Infinity false
nullx
```
