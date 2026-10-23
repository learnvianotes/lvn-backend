---
id: 03b95950-0b98-79af-ace9-83abfc7522c7
key: topic:java/virtual-threads
subject: java
topic: virtual-threads
title: Virtual Threads (Java 21)
slug: virtual-threads-java-21
order: 1
---

Virtual threads (JEP 444, final in Java 21) are lightweight threads managed by the JVM — you can have <em>millions</em>, so plain blocking code scales like async code.

> [!INFO]
>
> <strong>Virtual thread</strong> — a `java.lang.Thread` not tied to an OS thread. The JVM <em>mounts</em> it on a small pool of <strong>carrier</strong> (platform) threads; when it blocks on I/O, `sleep` or a lock, it <em>unmounts</em> and the carrier runs another virtual thread.

# Platform vs virtual threads

|  | Platform thread | Virtual thread |
| --- | --- | --- |
| Backed by | One OS thread for its whole life | Any carrier thread, only while running |
| Stack | Fixed, \~1 MB reserved | Heap-allocated, grows as needed (KBs) |
| How many | Thousands | Millions |
| Creation | Expensive — pool them | Cheap — create one per task, <strong>never pool</strong> |
| Scheduler | OS | JVM (`ForkJoinPool` of carriers, \~one per core) |
| Always daemon? | Configurable | Yes; priority fixed |
| Best for | CPU-bound work, long-lived threads | High-concurrency blocking I/O (servers, clients) |

# Creating virtual threads

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread v = Thread.ofVirtual().name("v-worker").start(() ->
            System.out.println(Thread.currentThread().getName()
                + " virtual=" + Thread.currentThread().isVirtual()
                + " daemon=" + Thread.currentThread().isDaemon()));
        v.join();

        Thread quick = Thread.startVirtualThread(() -> System.out.println("started with startVirtualThread"));
        quick.join();

        Thread unstarted = Thread.ofVirtual().unstarted(() -> { });
        System.out.println("state = " + unstarted.getState());

        Thread p = Thread.ofPlatform().name("p-worker").start(() ->
            System.out.println(Thread.currentThread().getName() + " virtual=" + Thread.currentThread().isVirtual()));
        p.join();
    }
}
```

```text filename:Output
v-worker virtual=true daemon=true
started with startVirtualThread
state = NEW
p-worker virtual=false
```

# One virtual thread per task

10 000 tasks that each block for 10 ms. A pool of 100 platform threads would need \~1 s; with a thread per task the sleeps all overlap and the whole batch finishes in roughly the time of one.

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class Main {
    public static void main(String[] args) throws Exception {
        List<Future<Integer>> results = new ArrayList<>();
        try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < 10_000; i++) {
                int n = i;
                results.add(exec.submit(() -> {
                    Thread.sleep(10);          // blocking call: the virtual thread unmounts
                    return n;
                }));
            }
        }                                      // close() waits for all 10 000
        long sum = 0;
        for (Future<Integer> f : results) sum += f.resultNow();
        System.out.println(results.size() + " tasks, sum = " + sum);
    }
}
```

```text filename:Output
10000 tasks, sum = 49995000
```

# When they help — and when they don't

> [!NOTE] Great for
>
> Thread-per-request servers, calling many HTTP/DB services, anything that spends most of its time <strong>waiting</strong>. Write simple blocking code; get async-level throughput.

> [!NOTE] No gain for
>
> <strong>CPU-bound</strong> work — there are still only as many carriers as cores. Virtual threads increase <em>throughput</em> for waiting tasks, not the <em>speed</em> of a single task.

# Pitfalls

| Pitfall | Why | Instead |
| --- | --- | --- |
| Pooling virtual threads | They are cheap; pooling just limits concurrency | One per task; limit access to a scarce resource with a `Semaphore` |
| <strong>Pinning</strong> (Java 21) | Blocking inside `synchronized` (or a native call) keeps the carrier occupied | Use `ReentrantLock` around blocking I/O; diagnose with `-Djdk.tracePinnedThreads=full` (fixed for `synchronized` in JDK 24, JEP 491) |
| Heavy `ThreadLocal` caches | A million threads × a cached object each = memory blow-up | Pass context explicitly; scoped values (preview) |
| Long CPU loops | No time-slicing preemption between virtual threads | Keep CPU-heavy work on a platform pool |

> [!WARNING] Watch out
>
> Virtual threads are always daemon threads: if `main` returns without joining them (or closing their executor), the JVM exits and their work is lost.

> [!NOTE] Related previews
>
> <strong>Structured concurrency</strong> (`StructuredTaskScope`, preview in Java 21, needs `--enable-preview`) treats a group of subtasks as one unit: fork them, `join()` the scope, and if one fails the others are cancelled — no leaked threads. <strong>Scoped values</strong> (also preview) are the virtual-thread-friendly replacement for `ThreadLocal`.

```question
Do virtual threads make code faster?

---

Not individual tasks — a CPU-bound computation runs at the same speed. They raise <em>throughput</em> for I/O-bound workloads by letting you have one cheap thread per concurrent task, so waiting no longer ties up an expensive OS thread.
```

```question
What is a carrier thread? What is pinning?

---

A carrier is the platform thread (from a `ForkJoinPool`) a virtual thread is mounted on while it runs. Pinning happens when a virtual thread blocks but can't unmount — in Java 21, while inside a `synchronized` block or a native method — so the carrier is blocked too, reducing scalability.
```

```question
Should you use a thread pool of virtual threads?

---

No. Pools exist to amortise expensive thread creation and cap resource use; virtual threads are cheap, so create one per task (`newVirtualThreadPerTaskExecutor`). To cap access to a limited resource, use a `Semaphore` instead.
```
