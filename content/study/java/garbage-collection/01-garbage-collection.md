---
id: fca4d0af-01b4-71b2-9c26-d2901e7b5cec
key: topic:java/garbage-collection
subject: java
topic: garbage-collection
title: Garbage Collection
slug: garbage-collection
order: 1
---

The garbage collector frees heap objects that are no longer <em>reachable</em> — you never call `free`, but you still decide what stays reachable.

> [!INFO]
>
> <strong>Garbage</strong> — an object that cannot be reached by following references from any <strong>GC root</strong>. Reference counting is <em>not</em> used, so cycles of objects pointing at each other are still collected.

# GC roots and reachability

- Local variables and parameters in every live thread's stack frames.
- Static fields of loaded classes.
- Active threads themselves.
- JNI references held by native code, and objects used as monitors (`synchronized`).

```java filename:Java
public class Main {
    static class Node { Node next; }

    public static void main(String[] args) {
        Node a = new Node();
        Node b = new Node();
        a.next = b;
        b.next = a;          // a cycle: a → b → a

        a = null;
        b = null;            // no root reaches the cycle any more → both are garbage
        System.out.println("the cycle is unreachable and will be collected");
    }
}
```

```text filename:Output
the cycle is unreachable and will be collected
```

# Generational collection

<strong>Weak generational hypothesis</strong>: most objects die young (temporary strings, iterators, DTOs). So the heap is split and the young part is collected often and cheaply.

1. <strong>Allocate in Eden</strong>

   `new` bumps a pointer in a thread-local allocation buffer — allocation is extremely cheap.

2. <strong>Minor GC</strong>

   When Eden fills, live objects are copied to a Survivor space; everything left in Eden is reclaimed at once.

3. <strong>Age and promote</strong>

   Each survived minor GC increments an object's age; past a threshold it is <em>promoted</em> to the old generation.

4. <strong>Major / full GC</strong>

   When the old generation fills, it is collected too — more expensive, historically the source of long pauses.

| Phase / term | Meaning |
| --- | --- |
| <strong>Mark</strong> | Trace from the roots and mark every reachable object. |
| <strong>Sweep</strong> | Reclaim the memory of unmarked objects. |
| <strong>Compact</strong> | Slide live objects together to remove fragmentation. |
| <strong>Copying</strong> | Copy live objects to an empty space (used for the young gen: cost ∝ live objects, not heap size). |
| <strong>Stop-the-world (STW)</strong> | All application threads are paused while the GC works. |
| <strong>Concurrent</strong> | GC work done while application threads keep running. |

# The collectors

| Collector | Flag | Best for | Notes |
| --- | --- | --- | --- |
| Serial | `-XX:+UseSerialGC` | Tiny heaps, single-core containers | One thread, stop-the-world |
| Parallel | `-XX:+UseParallelGC` | Batch jobs — maximum throughput | Many threads, still STW |
| <strong>G1</strong> (default since 9) | `-XX:+UseG1GC` | General purpose, heaps of GBs | Region-based; targets a pause goal (`-XX:MaxGCPauseMillis=200`) |
| ZGC | `-XX:+UseZGC` (generational in 21: `-XX:+ZGenerational`) | Huge heaps, low latency | Pauses under a millisecond, mostly concurrent |
| Shenandoah | `-XX:+UseShenandoahGC` | Low latency | Concurrent compaction (OpenJDK builds) |
| CMS | — | — | Deprecated in 9, <strong>removed in 14</strong> |

```filename:Terminal
$ java -XX:+UseZGC -Xmx4g -Xlog:gc App.java      # choose a collector, log each GC
$ java -Xlog:gc*:file=gc.log App.java            # detailed GC log to a file
$ jcmd <pid> GC.heap_info                        # inspect a running JVM
```

# System.gc(), finalize() and cleanup

> [!WARNING] Watch out
>
> `System.gc()` is only a <strong>hint</strong> — the JVM may ignore it (`-XX:+DisableExplicitGC`), and when honoured it usually triggers an expensive full GC. Never call it to “free memory”.

> [!WARNING] finalize()
>
> `finalize()` is <strong>deprecated for removal</strong> (Java 9/18): it runs at an unpredictable time or never, slows GC, and can resurrect objects. Release resources with `try-with-resources`; for a safety net use `java.lang.ref.Cleaner`.

```java filename:Java
import java.lang.ref.Cleaner;

public class Main {
    static final Cleaner CLEANER = Cleaner.create();

    static class Resource implements AutoCloseable {
        private final Cleaner.Cleanable cleanable;

        Resource(String name) {
            // the cleanup action must NOT capture `this`, or the object never becomes unreachable
            cleanable = CLEANER.register(this, () -> System.out.println("released " + name));
        }

        @Override
        public void close() { cleanable.clean(); }   // runs the action at most once
    }

    public static void main(String[] args) {
        try (Resource r = new Resource("db-connection")) {
            System.out.println("using the resource");
        }
        System.out.println("after try");
    }
}
```

```text filename:Output
using the resource
released db-connection
after try
```

# Tuning in practice

1. Measure first: GC logs (`-Xlog:gc`), JDK Flight Recorder (`-XX:StartFlightRecording`), `jstat -gc <pid>`.
2. Size the heap: set `-Xms` = `-Xmx` for servers to avoid resizing.
3. Pick the collector by goal: throughput → Parallel, balanced → G1, latency → ZGC.
4. Reduce garbage: reuse builders, avoid needless boxing, stream large files instead of loading them.

```question
Can an object be garbage collected while it still references other objects?

---

Yes. Reachability is about incoming references <em>from roots</em>. An object that points to others — even a whole cycle — is garbage as soon as no root can reach it.
```

```question
What is a stop-the-world pause and how do modern collectors reduce it?

---

A pause during which all application threads are stopped so the GC can work on a consistent heap. G1 limits pause length by collecting a subset of regions per cycle; ZGC and Shenandoah do marking <em>and</em> compaction concurrently, keeping pauses below \~1 ms regardless of heap size.
```

```question
Minor GC vs major GC?

---

A minor GC collects only the young generation — frequent and fast because most young objects are dead. A major (old-gen) or full GC collects the old generation or the whole heap — rarer and much more expensive.
```

```question
Does calling System.gc() guarantee collection?

---

No. It is a request the JVM may ignore. Code that depends on it for correctness is broken.
```
