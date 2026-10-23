---
id: ace6681c-0977-71d2-9341-2f27d8f80bae
key: topic:java/references-memory-leaks
subject: java
topic: references-memory-leaks
title: References & Memory Leaks
slug: references-memory-leaks
order: 1
---

Java has garbage collection, not leak immunity: anything you keep <em>reachable by accident</em> is a leak.

> [!INFO]
>
> <strong>Memory leak (Java)</strong> — objects that are no longer needed but are still reachable from a GC root, so the collector can never reclaim them. The heap slowly fills until `OutOfMemoryError`.

# Four reference strengths

| Type | Collected when… | `get()` after collection | Typical use |
| --- | --- | --- | --- |
| <strong>Strong</strong> (`Obj o = …`) | Never, while reachable | — | Normal code |
| <strong>Soft</strong> — `SoftReference` | Only when memory is low (before OOM) | `null` | Memory-sensitive caches |
| <strong>Weak</strong> — `WeakReference` | At the next GC once only weakly reachable | `null` | `WeakHashMap`, canonicalising maps, listener registries |
| <strong>Phantom</strong> — `PhantomReference` | After finalisation; enqueued for cleanup | always `null` | Post-mortem cleanup (`Cleaner` is built on it) |

```java filename:Java
import java.lang.ref.WeakReference;

public class Main {
    public static void main(String[] args) {
        StringBuilder data = new StringBuilder("payload");
        WeakReference<StringBuilder> weak = new WeakReference<>(data);

        System.out.println(weak.get());          // still strongly reachable via `data`
        data = null;                             // drop the only strong reference
        System.gc();                             // a hint — usually honoured in practice
        System.out.println(weak.get());
    }
}
```

```text filename:Typical%20output
payload
null
```

> [!NOTE] Key point
>
> Weak/soft clearing depends on when the GC actually runs, so never write logic that <em>needs</em> a reference to be cleared at a particular moment.

# WeakHashMap

Keys are held weakly: when a key has no strong references elsewhere, its entry disappears on a later GC. Useful for attaching metadata to objects you don't own.

> [!WARNING] Watch out
>
> A `WeakHashMap` with `String` literal keys or boxed small integers never clears — those keys are strongly held by the string pool / `Integer` cache. And a value that refers back to its own key keeps the key alive.

# The usual leak suspects

| Leak | Why it's reachable | Fix |
| --- | --- | --- |
| Static collection used as a cache | Static fields are GC roots — the map lives as long as the class | Bounded cache (LRU via `LinkedHashMap.removeEldestEntry`, Caffeine), or eviction |
| Listeners / callbacks never removed | The subject's listener list points at every subscriber | Unregister in a `close()`; or weak listeners |
| Non-static inner class / lambda captures | An inner instance holds `Outer.this`; lambdas hold captured variables | Use `static` nested classes; capture only what you need |
| `ThreadLocal` in thread pools | Pool threads never die, so their thread-local values never go away | `try { … } finally { tl.remove(); }` |
| Unclosed resources | Streams, connections, native buffers hold memory and file handles | `try-with-resources` |
| Wrong `equals`/`hashCode` as map key | Duplicate keys pile up; mutated keys become unreachable-yet-present | Immutable keys with a correct contract |

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static final List<Runnable> LISTENERS = new ArrayList<>();   // static → a GC root

    public static void main(String[] args) {
        for (int i = 0; i < 1_000; i++) {
            byte[] buffer = new byte[10_000];
            LISTENERS.add(() -> System.out.print(buffer.length));   // lambda captures buffer
        }
        // ~10 MB can never be freed: every buffer is reachable through LISTENERS
        System.out.println("listeners: " + LISTENERS.size());

        LISTENERS.clear();                 // unsubscribe → buffers become garbage
        System.out.println("listeners: " + LISTENERS.size());
    }
}
```

```text filename:Output
listeners: 1000
listeners: 0
```

```java filename:Java
public class Main {
    private static final ThreadLocal<StringBuilder> BUFFER =
            ThreadLocal.withInitial(StringBuilder::new);

    static String handle(String request) {
        try {
            StringBuilder sb = BUFFER.get();
            sb.setLength(0);
            return sb.append("handled ").append(request).toString();
        } finally {
            BUFFER.remove();          // pooled threads live forever — always clean up
        }
    }

    public static void main(String[] args) {
        System.out.println(handle("GET /"));
    }
}
```

```text filename:Output
handled GET /
```

# Finding a leak

1. <strong>Confirm</strong>

   Heap usage after each full GC keeps climbing (GC logs, JFR, VisualVM / JConsole graphs).

2. <strong>Dump the heap</strong>

   `jcmd <pid> GC.heap_dump heap.hprof` (or `jmap -dump:live,format=b,file=heap.hprof <pid>`, or `-XX:+HeapDumpOnOutOfMemoryError`).

3. <strong>Analyse</strong>

   Open it in Eclipse MAT or VisualVM: look at the dominator tree and the <em>path to GC roots</em> of the biggest retained sets.

4. <strong>Fix &amp; verify</strong>

   Remove the unintended reference, then re-run and compare dumps.

```filename:Terminal
$ jcmd                                   # list running JVMs
$ jcmd <pid> GC.class_histogram | head   # which classes use the most memory
$ jcmd <pid> GC.heap_dump /tmp/heap.hprof
$ jstat -gcutil <pid> 1000               # GC utilisation every second
```

```question
How can a garbage-collected language leak memory?

---

The GC only frees <em>unreachable</em> objects. If a static map, a listener list, a thread-local in a pooled thread or a long-lived object keeps a reference to data you no longer need, that data is reachable and stays forever.
```

```question
SoftReference vs WeakReference?

---

A weakly reachable object is cleared at the next GC. A softly reachable object is kept until the JVM is short of memory, which makes soft references suitable for simple memory-sensitive caches (though a proper bounded cache is usually better).
```

```question
Why can a non-static inner class cause a leak?

---

Every instance of a non-static inner class holds a hidden reference to its enclosing instance (`Outer.this`). If the inner object outlives the outer one (e.g. registered as a callback), the whole outer object is retained. Make it a `static` nested class.
```
