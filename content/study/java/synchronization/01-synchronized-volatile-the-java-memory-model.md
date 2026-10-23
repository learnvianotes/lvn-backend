---
id: 0a0a0eb5-faf0-7a52-b6d7-4a597eb69c96
key: topic:java/synchronization
subject: java
topic: synchronization
title: synchronized, volatile & the Java Memory Model
slug: synchronized-volatile-the-java-memory-model
order: 1
---

Shared mutable state + more than one thread = a race. `synchronized` gives <em>mutual exclusion and visibility</em>; `volatile` gives <em>visibility and ordering only</em>.

> [!INFO]
>
> <strong>Race condition</strong> — the result depends on the timing of threads. The classic case is `count++`, which is really three steps — <em>read</em>, <em>add 1</em>, <em>write</em> — so two threads can read the same old value and one increment is lost.

# The lost-update problem

```java filename:Java
public class Main {
    static int count = 0;

    public static void main(String[] args) throws InterruptedException {
        Runnable inc = () -> { for (int i = 0; i < 100_000; i++) count++; };
        Thread a = new Thread(inc), b = new Thread(inc);
        a.start(); b.start();
        a.join();  b.join();
        System.out.println("unsafe count = " + count + " (expected 200000)");
    }
}
```

```text filename:Output%20(a%20typical%20run%20%E2%80%94%20different%20every%20time)
unsafe count = 104072 (expected 200000)
```

# The fix: `synchronized`

```java filename:Java
public class Main {
    private int count = 0;

    synchronized void increment() { count++; }     // lock = this
    synchronized int get() { return count; }

    public static void main(String[] args) throws InterruptedException {
        Main counter = new Main();
        Runnable inc = () -> { for (int i = 0; i < 100_000; i++) counter.increment(); };
        Thread a = new Thread(inc), b = new Thread(inc);
        a.start(); b.start();
        a.join();  b.join();
        System.out.println("safe count = " + counter.get());
        System.out.println("correct? " + (counter.get() == 200_000));
    }
}
```

```text filename:Output
safe count = 200000
correct? true
```

Every object has an <strong>intrinsic lock</strong> (monitor). Only one thread at a time can hold it; others trying to enter a `synchronized` region on the same object go `BLOCKED`.

| Form | Lock used | Use when |
| --- | --- | --- |
| `synchronized void m()` | `this` | The whole method touches shared state |
| `static synchronized void m()` | the `Class` object (`Main.class`) | Guarding static fields |
| `synchronized (lock) { ... }` | any object you choose | Only a few lines need the lock — keep critical sections short |

```java filename:Java
import java.util.ArrayList;
import java.util.List;

class Inventory {
    private final Object lock = new Object();      // private lock: outsiders can't grab it
    private final List<String> items = new ArrayList<>();

    void add(String item) {
        String cleaned = item.trim().toLowerCase(); // no lock needed for local work
        synchronized (lock) {                       // lock only the shared mutation
            items.add(cleaned);
        }
    }

    int size() {
        synchronized (lock) { return items.size(); }
    }
}
```

> [!WARNING] Watch out
>
> An instance lock and a static lock are <em>different</em> locks: a `synchronized` instance method and a `static synchronized` method can run at the same time. Also, locking on different objects protects nothing — every access to the shared field must use the <em>same</em> lock.

# Reentrancy

```java filename:Java
public class Main {
    synchronized void outer() {
        System.out.println("outer holds lock: " + Thread.holdsLock(this));
        inner();              // same thread, same lock — no self-deadlock
    }

    synchronized void inner() {
        System.out.println("inner re-entered the same lock");
    }

    public static void main(String[] args) {
        new Main().outer();
    }
}
```

```text filename:Output
outer holds lock: true
inner re-entered the same lock
```

Intrinsic locks are <strong>reentrant</strong>: the JVM keeps a hold count per owning thread, so a synchronized method can call another synchronized method on the same object.

# Visibility and the Java Memory Model

Without synchronisation, a thread may <em>never see</em> another thread's write: values can sit in CPU caches or registers, and the compiler/CPU may reorder instructions. The <strong>Java Memory Model (JMM)</strong> defines when a write is guaranteed visible through <em>happens-before</em> rules.

| Happens-before rule | Guarantee |
| --- | --- |
| Program order | Each action in a thread happens-before later actions in the same thread |
| Monitor lock | Unlocking a monitor happens-before every later lock of the <em>same</em> monitor |
| `volatile` | A write to a volatile field happens-before every later read of it |
| Thread start | `t.start()` happens-before anything `t` does |
| Thread join | Everything `t` does happens-before `t.join()` returns |
| Transitivity | A hb B and B hb C ⇒ A hb C |

# `volatile`

```java filename:Java
public class Main {
    static volatile boolean running = true;     // try removing volatile: the loop may never end

    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(() -> {
            long spins = 0;
            while (running) spins++;
            System.out.println("worker saw running=false and exited");
        });
        worker.start();
        Thread.sleep(50);
        running = false;                        // visible to the worker immediately
        worker.join();
        System.out.println("done");
    }
}
```

```text filename:Output
worker saw running=false and exited
done
```

|  | `volatile` | `synchronized` |
| --- | --- | --- |
| Visibility | Yes | Yes |
| Prevents reordering around it | Yes | Yes |
| Atomic compound actions (`x++`, check-then-act) | <strong>No</strong> | Yes |
| Blocks other threads | Never | Yes (mutual exclusion) |
| Typical use | Status flags, safe publication, DCL | Invariants spanning several fields/steps |

> [!WARNING] Watch out
>
> `volatile int count; count++` is still a race — `volatile` makes each read and write visible but does not make read-modify-write atomic. Use `synchronized`, `AtomicInteger` or `LongAdder`.

# Double-checked locking (lazy singleton)

```java filename:Java
final class Config {
    private static volatile Config instance;    // volatile is essential here

    private Config() { }

    static Config getInstance() {
        Config local = instance;                // 1st check without locking (fast path)
        if (local == null) {
            synchronized (Config.class) {
                local = instance;               // 2nd check under the lock
                if (local == null) {
                    instance = local = new Config();
                }
            }
        }
        return local;
    }
}
```

Without `volatile`, the write of the reference could be reordered before the constructor finishes, so another thread might see a <em>partially constructed</em> object. Simpler alternatives: an `enum` singleton or the holder idiom (`private static class Holder { static final Config I = new Config(); }`) — class initialisation is already thread-safe and lazy.

```question
Is count++ atomic in Java?

---

No — it compiles to read, add, write (`getfield`, `iadd`, `putfield`). Two threads can interleave and lose updates, even if `count` is `volatile`. Use `synchronized`, `AtomicInteger.incrementAndGet()` or `LongAdder`.
```

```question
What does volatile guarantee?

---

Visibility (a read sees the latest write by any thread) and ordering (no reordering across the volatile access; it creates a happens-before edge). It does <em>not</em> give atomicity or mutual exclusion.
```

```question
Synchronized method vs synchronized block?

---

A synchronized method locks `this` (or the `Class` for static methods) for the whole method. A block lets you choose the lock object — often a private final field — and keep the critical section as small as possible, which improves throughput and prevents outside code from locking on your object.
```

```question
Why must the double-checked-locking field be volatile?

---

`instance = new Config()` is allocate → construct → assign, and the JIT/CPU may publish the reference before construction completes. `volatile` forbids that reordering, so a thread that sees a non-null reference also sees a fully initialised object.
```
