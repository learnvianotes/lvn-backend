---
id: 6dc3ce61-cea0-7024-80e1-96990ca88730
key: topic:java/jvm-memory
subject: java
topic: jvm-memory
title: "JVM Memory: Heap, Stack & Metaspace"
slug: jvm-memory-heap-stack-metaspace
order: 1
---

The JVM splits memory into areas with different lifetimes: <em>objects on the heap</em>, <em>method calls on per-thread stacks</em>, <em>class metadata in metaspace</em>.

> [!INFO]
>
> <strong>Runtime data areas</strong> — the regions of memory the JVM specification defines. Some are shared by all threads (heap, metaspace), others are private to each thread (stack, PC register).

# The runtime data areas

| Area | Shared? | Holds | Error when full |
| --- | --- | --- | --- |
| <strong>Heap</strong> — young gen (Eden + 2 Survivor spaces) | All threads | Newly created objects and arrays | `OutOfMemoryError: Java heap space` |
| <strong>Heap</strong> — old (tenured) gen | All threads | Objects that survived several young GCs | `OutOfMemoryError: Java heap space` |
| <strong>JVM stack</strong> (one per thread) | Per thread | One <em>frame</em> per method call: local variables, operand stack, return address | `StackOverflowError` |
| <strong>Metaspace</strong> (native memory, Java 8+) | All threads | Class metadata: method bytecode, field layout, runtime constant pool | `OutOfMemoryError: Metaspace` |
| <strong>PC register</strong> | Per thread | Address of the bytecode instruction being executed | — |
| <strong>Native method stack</strong> | Per thread | Frames of native (C/C++) methods called through JNI | `StackOverflowError` |
| <strong>Code cache</strong> | All threads | Machine code produced by the JIT compiler | JIT stops compiling (warning) |

> [!NOTE] History
>
> The <strong>string pool</strong> lives on the heap (moved out of PermGen in Java 7). <strong>PermGen</strong> itself was removed in Java 8 and replaced by <strong>metaspace</strong>, which grows in native memory instead of having a fixed size.

# What lives where

> [!NOTE] Primitive locals
>
> `int x = 5;` inside a method — the value sits directly in the stack frame. Gone when the method returns.

> [!NOTE] References
>
> `Box b` is a local of reference type — the <em>reference</em> (a pointer-sized value) is on the stack…

> [!NOTE] Objects
>
> …and the `new Box()` it points to is on the heap, shared by every reference to it. Instance fields (primitive or not) live inside the object.

> [!NOTE] Static fields
>
> Belong to the class. Since Java 8 they are stored with the `Class` object on the heap; the class metadata is in metaspace.

```java filename:Java
public class Main {
    static class Box { int value; }

    public static void main(String[] args) {
        int a = 10;           // primitive local → in main's stack frame
        int b = a;            // copies the value
        b++;

        Box x = new Box();    // reference x on the stack, Box object on the heap
        Box y = x;            // copies the reference, not the object
        y.value = 42;

        System.out.println(a + " " + b);
        System.out.println(x.value + " " + (x == y));
    }
}
```

```text filename:Output
10 11
42 true
```

# Stack frames and StackOverflowError

1. <strong>Call</strong>

   Calling a method pushes a new frame onto the current thread's stack.

2. <strong>Execute</strong>

   The frame holds the method's parameters and locals, plus an operand stack the bytecode works on.

3. <strong>Return</strong>

   The frame is popped — its locals disappear instantly. No GC is needed for stack memory.

```java filename:Java
public class Main {
    static int depth = 0;

    static void recurse() {
        depth++;
        recurse();              // no base case → a new frame on every call
    }

    public static void main(String[] args) {
        try {
            recurse();
        } catch (StackOverflowError e) {
            System.out.println("StackOverflowError after more than 1000 frames: " + (depth > 1000));
        }
    }
}
```

```text filename:Output
StackOverflowError after more than 1000 frames: true
```

# OutOfMemoryError

Run with a deliberately tiny heap (`-Xmx64m`) and ask for a 400 MB array:

```java filename:Java
public class Main {
    public static void main(String[] args) {
        try {
            int[] huge = new int[100_000_000];      // ~400 MB
            System.out.println(huge.length);
        } catch (OutOfMemoryError e) {
            System.out.println("OutOfMemoryError: " + e.getMessage());
        }
    }
}
```

```text filename:Output
OutOfMemoryError: Java heap space
```

|  | `StackOverflowError` | `OutOfMemoryError` |
| --- | --- | --- |
| Area | A thread's stack | Heap, metaspace, direct buffers, native threads… |
| Typical cause | Unbounded / too deep recursion | Leak (objects stay reachable), or heap simply too small |
| Fix | Base case, iteration, or bigger `-Xss` | Fix the leak (heap dump), then size `-Xmx` |
| Type | Both extend `Error` (via `VirtualMachineError`) — not meant to be caught in normal code |  |

# Sizing flags

| Flag | Meaning | Example |
| --- | --- | --- |
| `-Xms` | Initial heap size | `-Xms512m` |
| `-Xmx` | Maximum heap size (default: 1/4 of physical RAM) | `-Xmx2g` |
| `-Xss` | Stack size per thread | `-Xss1m` |
| `-XX:MaxMetaspaceSize` | Cap metaspace (unbounded by default) | `-XX:MaxMetaspaceSize=256m` |
| `-XX:+HeapDumpOnOutOfMemoryError` | Write a `.hprof` heap dump when OOM happens | with `-XX:HeapDumpPath=/tmp` |

```filename:Terminal
$ java -Xms256m -Xmx1g -Xss512k -XX:+HeapDumpOnOutOfMemoryError App.java
$ java -XX:+PrintFlagsFinal -version | grep -E "MaxHeapSize|ThreadStackSize"
```

# Escape analysis

The JIT checks whether an object <em>escapes</em> the method that creates it (returned, stored in a field, passed to another thread). If it doesn't, the JIT may <strong>scalar-replace</strong> it — keep its fields in registers/stack slots and never allocate it on the heap at all.

```java filename:Java
public class Main {
    record Point(int x, int y) {}

    static int distanceSquared(int x, int y) {
        Point p = new Point(x, y);      // never escapes → candidate for scalar replacement
        return p.x() * p.x() + p.y() * p.y();
    }

    public static void main(String[] args) {
        long sum = 0;
        for (int i = 0; i < 1_000; i++) sum += distanceSquared(i, i);
        System.out.println(sum);
    }
}
```

```text filename:Output
665667000
```

> [!NOTE] Key point
>
> "All objects live on the heap" is the <em>language model</em>. Escape analysis is an invisible optimisation — your program behaves exactly the same either way.

```question
Where are local variables, objects and static variables stored?

---

Local primitives and local references are in the thread's stack frame. Objects (including their instance fields) are on the heap. Static fields are stored with the class's `Class` object on the heap (Java 8+); the class metadata itself is in metaspace.
```

```question
What replaced PermGen and why?

---

Metaspace (Java 8). PermGen had a fixed maximum size and caused `OutOfMemoryError: PermGen space` in apps that load many classes (app servers, dynamic proxies). Metaspace lives in native memory and grows on demand; cap it with `-XX:MaxMetaspaceSize`.
```

```question
Is the stack or the heap thread-safe?

---

Each thread has its own stack, so locals are never shared — they are inherently thread-confined. The heap is shared by all threads, so objects reachable from more than one thread need synchronization.
```
