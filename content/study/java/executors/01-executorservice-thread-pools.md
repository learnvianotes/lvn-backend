---
id: 363c9112-22c0-76ef-989b-bde879db1a77
key: topic:java/executors
subject: java
topic: executors
title: ExecutorService & Thread Pools
slug: executorservice-thread-pools
order: 1
---

Don't create a thread per task — submit tasks to an `ExecutorService`, which reuses a pool of threads and gives you `Future`s for the results.

> [!INFO]
>
> <strong>ExecutorService</strong> — an `Executor` (runs `Runnable`s) that also manages its own lifecycle (`shutdown`) and returns a `Future` for each submitted `Runnable`/`Callable`.

# Why a pool?

> [!NOTE] Reuse
>
> Creating a platform thread costs a syscall and \~1 MB of stack. A pool pays it once.

> [!NOTE] Bounded resources
>
> 10 000 requests don't become 10 000 threads — the queue absorbs bursts.

> [!NOTE] Results & errors
>
> `Future.get()` returns the value or rethrows the task's exception.

> [!NOTE] Separation
>
> Business code submits tasks; the pool decides how and where they run.

# submit, Future and invokeAll

```java filename:Java
import java.util.List;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(3);
        try {
            Future<Integer> f = pool.submit(() -> 6 * 7);          // Callable<Integer>
            System.out.println("answer = " + f.get());            // blocks until done

            List<Callable<String>> tasks = List.of(() -> "a".repeat(3), () -> "b".repeat(2), () -> "c");
            for (Future<String> r : pool.invokeAll(tasks)) {       // results in task order
                System.out.println(r.get());
            }

            Future<?> g = pool.submit(() -> { });                  // Runnable
            System.out.println("runnable result = " + g.get());

            Future<Integer> bad = pool.submit(() -> 1 / 0);
            try {
                bad.get();
            } catch (ExecutionException e) {                        // the task's exception is wrapped
                System.out.println("cause: " + e.getCause());
            }
        } finally {
            pool.shutdown();                                        // stop accepting, finish queued
            System.out.println("terminated = " + pool.awaitTermination(1, TimeUnit.SECONDS));
        }
    }
}
```

```text filename:Output
answer = 42
aaa
bb
c
runnable result = null
cause: java.lang.ArithmeticException: / by zero
terminated = true
```

| `Future` method | Purpose |
| --- | --- |
| `get()` / `get(t, unit)` | Wait for the result; throws `ExecutionException` (task failed), `TimeoutException`, `InterruptedException` |
| `isDone()` | Completed normally, exceptionally or cancelled |
| `cancel(mayInterrupt)` | Try to cancel; `true` interrupts a running task |
| `resultNow()` / `state()` | Java 19+: read a completed result without checked exceptions |

# Executors factory methods

| Factory | Pool | Watch out |
| --- | --- | --- |
| `newFixedThreadPool(n)` | `n` threads, unbounded `LinkedBlockingQueue` | Queue can grow until `OutOfMemoryError` |
| `newCachedThreadPool()` | 0…∞ threads, idle ones die after 60 s, `SynchronousQueue` | Unbounded <em>threads</em> under load |
| `newSingleThreadExecutor()` | 1 thread, tasks run sequentially in order | Same unbounded queue |
| `newScheduledThreadPool(n)` | Delayed / periodic tasks (`schedule`, `scheduleAtFixedRate`) | Replaces `java.util.Timer` |
| `newWorkStealingPool()` | `ForkJoinPool` with one queue per worker | Good for many small CPU tasks |
| `newVirtualThreadPerTaskExecutor()` | Java 21: one virtual thread per task | For blocking I/O workloads |

# Shutting down

1. <strong>`shutdown()`</strong>

   No new tasks accepted; already submitted ones still run.

2. <strong>`awaitTermination(t, unit)`</strong>

   Block until all tasks finish or the timeout elapses; returns `true` if terminated.

3. <strong>`shutdownNow()`</strong>

   Interrupt running tasks and return the ones never started (tasks must respond to interrupts).

Since Java 19 `ExecutorService` is `AutoCloseable`: `close()` calls `shutdown()` and waits for every task, so try-with-resources is the tidiest pattern.

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class Main {
    public static void main(String[] args) throws Exception {
        List<Future<Integer>> squares = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
            for (int i = 1; i <= 5; i++) {
                int n = i;
                squares.add(pool.submit(() -> n * n));
            }
        }                                   // close(): shutdown + wait for all tasks
        int total = 0;
        for (Future<Integer> f : squares) total += f.resultNow();
        System.out.println("sum of squares = " + total);
    }
}
```

```text filename:Output
sum of squares = 55
```

> [!WARNING] Watch out
>
> A pool that is never shut down keeps its non-daemon threads alive, so the JVM never exits. And a forgotten `Future` hides exceptions: `execute()` prints an uncaught task exception, but `submit()` stores it in the `Future` until someone calls `get()`.

# ThreadPoolExecutor: the real knobs

| Parameter | Meaning |
| --- | --- |
| `corePoolSize` | Threads kept alive even when idle |
| `maximumPoolSize` | Upper bound — extra threads are created only when the queue is <strong>full</strong> |
| `keepAliveTime` | How long threads above core may stay idle |
| `workQueue` | Where waiting tasks go: bounded `ArrayBlockingQueue` recommended |
| `threadFactory` | Name threads (`order-worker-1`), set daemon/priority |
| `handler` | Rejection policy when both queue and max threads are full |

task arrives → threads &lt; core? new thread → else queue it → queue full? thread up to max → else reject

```java filename:Java
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        CountDownLatch gate = new CountDownLatch(1);
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
            1, 1, 0, TimeUnit.SECONDS,                 // exactly one thread
            new ArrayBlockingQueue<>(1),               // room for one waiting task
            new ThreadPoolExecutor.AbortPolicy());     // default: throw when full
        Runnable blocker = () -> {
            try { gate.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        };
        pool.execute(blocker);                         // runs on the only thread
        pool.execute(blocker);                         // waits in the queue
        try {
            pool.execute(blocker);                     // no thread, no queue space
        } catch (RejectedExecutionException e) {
            System.out.println("3rd task rejected");
        }
        System.out.println("pool size = " + pool.getPoolSize() + ", queued = " + pool.getQueue().size());
        gate.countDown();
        pool.shutdown();
        pool.awaitTermination(1, TimeUnit.SECONDS);
        System.out.println("completed = " + pool.getCompletedTaskCount());
    }
}
```

```text filename:Output
3rd task rejected
pool size = 1, queued = 1
completed = 2
```

| Rejection policy | Behaviour |
| --- | --- |
| `AbortPolicy` (default) | Throw `RejectedExecutionException` |
| `CallerRunsPolicy` | Run the task on the submitting thread — natural back-pressure |
| `DiscardPolicy` | Silently drop the new task |
| `DiscardOldestPolicy` | Drop the oldest queued task, retry the new one |

# How many threads?

`threads ≈ cores × (1 + wait time / compute time)`

- <strong>CPU-bound</strong> (hashing, parsing, math): about `Runtime.getRuntime().availableProcessors()` threads — more only adds context switching.
- <strong>I/O-bound</strong> (HTTP calls, DB queries): many more, since threads mostly wait. On Java 21 prefer virtual threads here.
- Use separate pools for separate kinds of work, so a slow dependency can't starve everything (bulkheads).

```question
submit() vs execute()?

---

`execute(Runnable)` comes from `Executor`, returns nothing, and an exception goes to the thread's uncaught-exception handler. `submit()` accepts `Runnable` or `Callable`, returns a `Future`, and captures any exception inside it (rethrown as `ExecutionException` from `get()`).
```

```question
Why is Executors.newFixedThreadPool considered risky in production?

---

Its `LinkedBlockingQueue` is unbounded: if producers outpace workers, tasks pile up until `OutOfMemoryError`. Construct a `ThreadPoolExecutor` with a bounded queue, named threads and an explicit rejection policy instead.
```

```question
When does a ThreadPoolExecutor create threads beyond corePoolSize?

---

Only when the work queue is full. With an unbounded queue, `maximumPoolSize` is never reached — a common surprise.
```

```question
shutdown() vs shutdownNow()?

---

`shutdown()` is graceful: no new tasks, queued and running tasks complete. `shutdownNow()` interrupts running tasks, drains the queue and returns the unstarted tasks. Follow either with `awaitTermination` to actually wait.
```
