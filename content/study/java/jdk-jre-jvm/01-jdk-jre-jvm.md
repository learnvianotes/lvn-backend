---
id: 2fdba536-d33f-76f3-b7f1-30784efc3551
key: topic:java/jdk-jre-jvm
subject: java
topic: jdk-jre-jvm
title: JDK, JRE & JVM
slug: jdk-jre-jvm
order: 1
---

Three nested boxes: the <strong>JDK</strong> (tools to build) contains the <strong>JRE</strong> (what's needed to run) which contains the <strong>JVM</strong> (the engine that executes bytecode).

`JDK = JRE + development tools (javac, jar, javadoc, jdb, jshell…)`

`JRE = JVM + class libraries (java.lang, java.util, …)`

# What each one is

> [!NOTE] JVM — Java Virtual Machine
>
> An abstract machine that loads, verifies and executes bytecode. Provides memory management (GC), threads and the JIT compiler. <em>Specification</em> + <em>implementation</em> (HotSpot, OpenJ9, GraalVM).

> [!NOTE] JRE — Java Runtime Environment
>
> The JVM plus the standard library (`rt.jar` before Java 9, modules since). Enough to <em>run</em> programs, not compile them.

> [!NOTE] JDK — Java Development Kit
>
> The JRE plus developer tools: `javac`, `java`, `jar`, `javadoc`, `jdb`, `jshell`, `jcmd`, `jlink`… What developers install.

|  | JDK | JRE | JVM |
| --- | --- | --- | --- |
| Purpose | Develop + run | Run | Execute bytecode |
| Contains `javac`? | Yes | No | No |
| Contains class library? | Yes | Yes | No |
| Platform dependent? | Yes | Yes | Yes |

> [!NOTE] Modern reality
>
> Since Java 11, Oracle no longer ships a separate JRE download. You install a JDK (e.g. Eclipse Temurin, Amazon Corretto, Oracle JDK) and, for deployment, build a trimmed runtime with `jlink`.

# Inside the JVM

1. <strong>Class loader subsystem</strong>

   Finds `.class` files, loads them, links (verify → prepare → resolve) and initialises them.

2. <strong>Runtime data areas</strong>

   Heap (objects), Method Area / Metaspace (class metadata), one Stack per thread (frames with local variables), PC registers, native method stacks.

3. <strong>Execution engine</strong>

   Interpreter + JIT compiler (C1 quick, C2 optimising) + Garbage Collector.

4. <strong>JNI / native libraries</strong>

   Bridge to C/C++ code (`native` methods).

# Checking what you have

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println("feature version: " + Runtime.version().feature());
        System.out.println("spec version:    " + System.getProperty("java.specification.version"));
        System.out.println("class file ok:   " + (Main.class.getName().equals("Main")));
    }
}
```

```text filename:Output
feature version: 21
spec version:    21
class file ok:   true
```

```filename:Terminal
$ java -version          # runtime version
$ javac -version         # compiler version (only in a JDK)
$ echo $JAVA_HOME        # where the JDK is installed
```

# OpenJDK distributions

All major builds come from the same OpenJDK source; they differ in licensing, support length and extras.

Eclipse Temurin · Amazon Corretto · Oracle JDK / Oracle OpenJDK · Azul Zulu · Microsoft Build of OpenJDK · GraalVM

```question
What is the difference between JDK, JRE and JVM?

---

The <strong>JVM</strong> executes bytecode. The <strong>JRE</strong> = JVM + standard libraries — enough to run Java apps. The <strong>JDK</strong> = JRE + development tools like `javac`, `jar`, `javadoc` — needed to write and compile Java.
```

```question
Is the JVM platform independent?

---

No — the JVM is written for a specific OS and CPU. <em>Bytecode</em> is platform independent precisely because every platform has its own JVM.
```

```question
What is the JIT compiler?

---

The Just-In-Time compiler inside the JVM. It profiles running code and compiles <em>hot</em> methods (called often, loops) from bytecode to optimised native machine code, with tricks like inlining and escape analysis. That's why Java programs “warm up”.
```
