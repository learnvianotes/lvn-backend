---
id: aa5c5195-e466-794b-abdd-d099f8e48e19
key: topic:java/java-intro
subject: java
topic: java-intro
title: Introduction to Java
slug: introduction-to-java
order: 1
---

A statically typed, object-oriented, garbage-collected language that compiles to <em>bytecode</em> and runs on any machine with a JVM — “write once, run anywhere”.

> [!INFO]
>
> <strong>Java</strong> — a general-purpose language (Sun Microsystems, 1995; now Oracle + the OpenJDK community) whose source is compiled to platform-neutral <strong>bytecode</strong> and executed by the <strong>Java Virtual Machine</strong>, which interprets it and JIT-compiles hot code to native machine code.

# Why Java?

> [!NOTE] Platform independent
>
> The same `.class` files run on Windows, Linux and macOS — only the JVM is platform-specific.

> [!NOTE] Statically typed
>
> Types are checked at compile time, so whole classes of bugs never reach production. Great IDE support and refactoring.

> [!NOTE] Automatic memory
>
> No `free`/`delete`: the garbage collector reclaims unreachable objects. No dangling pointers, no pointer arithmetic.

> [!NOTE] Huge ecosystem
>
> Spring, Hibernate, Android, Kafka, Hadoop/Spark, Elasticsearch, Minecraft… plus Maven Central with millions of libraries.

> [!NOTE] Fast
>
> The JIT (HotSpot C1/C2) optimises the code that actually runs hot, often reaching C++-like throughput for long-running servers.

> [!NOTE] Backward compatible
>
> Code written for Java 1.4 still compiles today. A new version ships every 6 months; an <strong>LTS</strong> every 2 years (8, 11, 17, 21, 25).

# Key features (the classic “buzzwords”)

| Feature | What it means in practice |
| --- | --- |
| Object-oriented | Everything lives inside a class; encapsulation, inheritance, polymorphism, abstraction. |
| Simple | No pointers, no operator overloading, no multiple class inheritance, no header files. |
| Robust | Strong typing, exceptions, bounds-checked arrays, GC. |
| Secure | Bytecode verification, no raw memory access, sandboxable class loaders. |
| Multithreaded | Threads, locks and concurrent collections built into the language and library. |
| Architecture-neutral | Fixed sizes for primitives: an `int` is 32 bits everywhere. |

# Hello, World

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
        System.out.println("Running on Java " + Runtime.version().feature());
    }
}
```

```text filename:Output
Hello, Java!
Running on Java 21
```

```filename:Terminal
$ javac Main.java        # compile → Main.class (bytecode)
$ java Main              # run the class on the JVM
$ java Main.java         # Java 11+: compile in memory and run in one step
$ jshell                 # Java 9+: interactive REPL
```

# Where Java is used

Enterprise back ends (Spring Boot) · Android (with Kotlin) · Big data (Hadoop, Spark, Kafka) · Banking &amp; trading systems · Search (Elasticsearch, Solr) · Build tools (Maven, Gradle) · Games (Minecraft)

> [!NOTE] Common confusion
>
> Java ≠ JavaScript. The names are a 1995 marketing coincidence; the languages are unrelated.

```question
Why is Java called platform independent?

---

Because `javac` produces <strong>bytecode</strong>, not machine code. Any OS that has a JVM can run that bytecode unchanged. The JVM itself <em>is</em> platform dependent — there is a different JVM build for each OS/CPU.
```

```question
Is Java a purely object-oriented language?

---

No. It has <strong>primitive types</strong> (`int`, `double`, `boolean`…) that are not objects, and `static` members that belong to no object. Wrapper classes (`Integer`…) bridge primitives into the object world.
```

```question
Is Java compiled or interpreted?

---

Both. Source is <em>compiled</em> to bytecode by `javac`; the JVM then <em>interprets</em> bytecode and <em>JIT-compiles</em> frequently executed methods to native code at run time.
```
