---
id: f0e62d3e-cb92-7afe-b99c-bf8995709b0a
key: topic:java/concurrent-utilities
subject: java
topic: concurrent-utilities
title: ConcurrentHashMap, Atomics & Locks
slug: concurrenthashmap-atomics-locks
order: 1
---

`java.util.concurrent` replaces most hand-written `synchronized`/`wait` code with tested building blocks: concurrent collections, atomic variables, explicit locks and synchronizers.

# Thread-safe maps compared

|  | `Hashtable` | `Collections.synchronizedMap` | `ConcurrentHashMap` |
| --- | --- | --- | --- |
| Locking | Every method locks the whole table | Every method locks one mutex | CAS + per-bin locks; reads are lock-free |
| Concurrent reads/writes | No | No | Yes |
| `null` keys/values | Not allowed | Allowed (if the backing map allows) | <strong>Not allowed</strong> |
| Iteration while modifying | Fail-fast | Must lock manually; else CME | Weakly consistent, never throws CME |
| Atomic compound ops | No | No | `merge`, `compute`, `putIfAbsent`… |
| Status | Legacy | Simple wrapper | Default choice |

```java filename:Java
import java.util.List;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        ConcurrentHashMap<String, Integer> counts = new ConcurrentHashMap<>();
        List<String> words = List.of("a", "b", "a", "c", "a", "b");

        Runnable countAll = () -> { for (String w : words) counts.merge(w, 1, Integer::sum); };  // atomic
        Thread[] ts = new Thread[4];
        for (int i = 0; i < ts.length; i++) (ts[i] = new Thread(countAll)).start();
        for (Thread t : ts) t.join();

        System.out.println(new TreeMap<>(counts));     // sorted for display
        counts.computeIfAbsent("d", k -> 0);
        counts.compute("d", (k, v) -> v + 100);
        System.out.println("d = " + counts.get("d") + ", size = " + counts.size());
    }
}
```

```text filename:Output
{a=12, b=8, c=4}
d = 100, size = 4
```

> [!WARNING] Watch out
>
> `if (!map.containsKey(k)) map.put(k, v);` is a check-then-act race even on a `ConcurrentHashMap` — each call is atomic, the pair is not. Use `putIfAbsent`, `computeIfAbsent` or `merge`.

# Atomic variables and CAS

> [!INFO]
>
> <strong>CAS (compare-and-swap)</strong> — a single CPU instruction: <em>if the value is still </em><em>`expected`</em><em>, set it to </em><em>`new`</em>. Atomic classes retry CAS in a loop, giving lock-free thread safety for single variables.

```java filename:Java
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        AtomicInteger a = new AtomicInteger(5);
        System.out.println(a.compareAndSet(5, 10) + " " + a.get());   // expected 5: swap
        System.out.println(a.compareAndSet(5, 20) + " " + a.get());   // stale expectation: no swap
        System.out.println(a.updateAndGet(x -> x * 3));
        System.out.println(a.getAndIncrement() + " then " + a.get());

        AtomicInteger hits = new AtomicInteger();
        LongAdder adder = new LongAdder();
        Runnable work = () -> {
            for (int i = 0; i < 10_000; i++) { hits.incrementAndGet(); adder.increment(); }
        };
        Thread[] ts = new Thread[4];
        for (int i = 0; i < ts.length; i++) (ts[i] = new Thread(work)).start();
        for (Thread t : ts) t.join();
        System.out.println("AtomicInteger = " + hits.get() + ", LongAdder = " + adder.sum());
    }
}
```

```text filename:Output
true 10
false 10
30
30 then 31
AtomicInteger = 40000, LongAdder = 40000
```

| Class | Use |
| --- | --- |
| `AtomicInteger` / `AtomicLong` | Counters, sequence numbers, `compareAndSet` state machines |
| `AtomicBoolean` | Run-once flags (`if (started.compareAndSet(false, true))`) |
| `AtomicReference<V>` | Swap an immutable object atomically |
| `LongAdder` | Hot counters under heavy contention — cells per thread, summed on read |
| `AtomicIntegerArray` | Per-index atomic updates |

> [!NOTE] Key point
>
> ABA problem: CAS only checks the <em>value</em>, so A → B → A looks unchanged. When it matters (lock-free stacks), use `AtomicStampedReference`, which pairs the reference with a version stamp.

# ReentrantLock and Condition

An explicit `Lock` does what `synchronized` does plus: try without blocking, time out, be interrupted while waiting, optional fairness, and several wait-sets (`Condition`s) per lock.

```java filename:Java
import java.util.concurrent.locks.ReentrantLock;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        ReentrantLock lock = new ReentrantLock();
        lock.lock();                                   // main holds it
        try {
            Thread t = new Thread(() -> System.out.println("worker tryLock: " + lock.tryLock()));
            t.start();
            t.join();
        } finally {
            lock.unlock();                             // ALWAYS unlock in finally
        }
        Thread t2 = new Thread(() -> {
            if (lock.tryLock()) {
                try { System.out.println("worker tryLock after unlock: true"); }
                finally { lock.unlock(); }
            }
        });
        t2.start();
        t2.join();
        System.out.println("held now? " + lock.isLocked());
    }
}
```

```text filename:Output
worker tryLock: false
worker tryLock after unlock: true
held now? false
```

```java filename:Java%20%E2%80%94%20Condition%20(compile-checked)
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

class LockBuffer<T> {
    private final Deque<T> items = new ArrayDeque<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();    // two separate wait-sets
    private final Condition notEmpty = lock.newCondition();

    LockBuffer(int capacity) { this.capacity = capacity; }

    void put(T x) throws InterruptedException {
        lock.lock();
        try {
            while (items.size() == capacity) notFull.await();
            items.addLast(x);
            notEmpty.signal();              // wake only a consumer
        } finally {
            lock.unlock();
        }
    }

    T take() throws InterruptedException {
        lock.lock();
        try {
            while (items.isEmpty()) notEmpty.await();
            T x = items.removeFirst();
            notFull.signal();               // wake only a producer
            return x;
        } finally {
            lock.unlock();
        }
    }
}
```

|  | `synchronized` | `ReentrantLock` |
| --- | --- | --- |
| Release | Automatic at block end | Manual `unlock()` in `finally` |
| Try / timeout | No | `tryLock()`, `tryLock(t, unit)` |
| Interruptible wait for lock | No | `lockInterruptibly()` |
| Fairness | No | `new ReentrantLock(true)` (FIFO-ish, slower) |
| Conditions | One wait-set (`wait`/`notify`) | Many (`newCondition()`) |
| Reentrant | Yes | Yes |

`ReentrantReadWriteLock` lets many readers in at once but writers alone — good for read-mostly data. `StampedLock` (Java 8) adds optimistic reads for even cheaper read paths.

# Synchronizers

| Tool | What it does | Reusable? | Typical use |
| --- | --- | --- | --- |
| `CountDownLatch(n)` | `await()` blocks until `countDown()` was called `n` times | No | Wait for N services to start / N tasks to finish |
| `CyclicBarrier(n, action)` | `n` threads wait for each other, then all continue | Yes | Phased parallel algorithms |
| `Semaphore(permits)` | `acquire()`/`release()` permits | Yes | Limit concurrency (max 10 DB connections) |
| `Phaser` | Flexible barrier with dynamic parties | Yes | Multi-phase work with join/leave |
| `Exchanger` | Two threads swap objects | Yes | Pipeline buffers |

```java filename:Java
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        // CountDownLatch: wait for 3 workers
        CountDownLatch done = new CountDownLatch(3);
        List<String> results = new CopyOnWriteArrayList<>();
        for (String svc : List.of("db", "cache", "queue")) {
            new Thread(() -> { results.add(svc + " ready"); done.countDown(); }).start();
        }
        done.await();
        System.out.println(results.stream().sorted().toList());

        // Semaphore: at most 2 tasks inside at once
        Semaphore permits = new Semaphore(2);
        AtomicInteger inside = new AtomicInteger(), maxInside = new AtomicInteger();
        try (ExecutorService pool = Executors.newFixedThreadPool(6)) {
            for (int i = 0; i < 6; i++) {
                pool.submit(() -> {
                    permits.acquire();
                    try {
                        maxInside.accumulateAndGet(inside.incrementAndGet(), Math::max);
                        Thread.sleep(20);
                        inside.decrementAndGet();
                    } finally {
                        permits.release();
                    }
                    return null;
                });
            }
        }
        System.out.println("max concurrent <= 2: " + (maxInside.get() <= 2));
    }
}
```

```text filename:Output
[cache ready, db ready, queue ready]
max concurrent <= 2: true
```

> [!NOTE] Key point
>
> Other concurrent collections: `CopyOnWriteArrayList` (copy on every write — ideal for rarely-changed listener lists), `ConcurrentLinkedQueue` (lock-free queue), `ConcurrentSkipListMap`/`Set` (sorted, concurrent `TreeMap`/`TreeSet`).

```question
How does ConcurrentHashMap achieve thread safety (Java 8+)?

---

The table is an array of bins. Inserting into an empty bin uses CAS; otherwise the thread locks only that bin's first node. Reads are lock-free via volatile reads. Long bins turn into red-black trees. Resizing is done cooperatively by several threads. (Java 7 used 16 lock <em>segments</em> instead.)
```

```question
Why doesn't ConcurrentHashMap allow null?

---

Ambiguity: `get(k)` returning `null` could mean "absent" or "mapped to null", and unlike a single-threaded map you can't follow up with `containsKey` atomically — another thread may change the map in between.
```

```question
AtomicInteger vs LongAdder?

---

`AtomicInteger` is one CAS'd variable — exact reads, but many threads hammering it retry a lot. `LongAdder` spreads increments over per-thread cells and sums on `sum()`, scaling far better for write-heavy counters, at the cost of a non-atomic snapshot read.
```

```question
CountDownLatch vs CyclicBarrier?

---

A latch is one-shot: some threads count down, others await; it cannot be reset. A barrier makes a fixed group of threads wait for <em>each other</em>, can run a barrier action, and resets automatically for the next round.
```
