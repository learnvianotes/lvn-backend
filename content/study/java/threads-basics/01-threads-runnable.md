---
id: 78b91f30-237f-79b8-93de-15a3b1f96082
key: topic:java/threads-basics
subject: java
topic: threads-basics
title: Threads & Runnable
slug: threads-runnable
order: 1
---

A thread is an independent path of execution inside one JVM process — create it with a `Runnable`, start it with `start()`, wait for it with `join()`.

> [!INFO]
>
> <strong>Thread</strong> — the smallest unit the OS schedules. All threads of a process share its heap (objects, static fields) but each has its <em>own stack</em> (local variables, call frames) and program counter.

# Process vs thread

|  | Process | Thread |
| --- | --- | --- |
| Memory | Own address space | Shares the process heap; own stack |
| Creation cost | Heavy (fork, new address space) | Lighter (\~1 MB stack reserved for a platform thread) |
| Communication | IPC: pipes, sockets, files | Shared objects — fast, but needs synchronisation |
| Crash impact | Isolated | An uncaught error kills only that thread, but corrupted shared state affects all |
| In Java | `ProcessBuilder`, one JVM = one process | `Thread`, executors, virtual threads |

# Creating and joining threads

Give each thread its own slice of the work, `start()` them, then `join()` before reading the results — `join()` both waits <em>and</em> guarantees you see everything the thread wrote.

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        long[] sums = new long[2];
        Thread t1 = new Thread(() -> sums[0] = sum(1, 50), "worker-1");
        Thread t2 = new Thread(() -> sums[1] = sum(51, 100), "worker-2");
        t1.start();                 // both now run concurrently with main
        t2.start();
        t1.join();                  // wait for each to finish
        t2.join();
        System.out.println(t1.getName() + " -> " + sums[0]);
        System.out.println(t2.getName() + " -> " + sums[1]);
        System.out.println("total = " + (sums[0] + sums[1]));
    }

    static long sum(int from, int to) {
        long s = 0;
        for (int i = from; i <= to; i++) s += i;
        return s;
    }
}
```

```text filename:Output
worker-1 -> 1275
worker-2 -> 3775
total = 5050
```

# Three ways to define the task

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread a = new Greeter();                       // 1. subclass Thread
        a.setName("greeter");
        a.start();
        a.join();

        Runnable task = new Runnable() {                // 2. implement Runnable
            @Override public void run() {
                System.out.println("2. Runnable on " + Thread.currentThread().getName());
            }
        };
        Thread b = new Thread(task, "runner");
        b.start();
        b.join();

        Thread c = new Thread(                          // 3. lambda (Runnable is functional)
            () -> System.out.println("3. lambda on " + Thread.currentThread().getName()), "lambda");
        c.start();
        c.join();
    }
}

class Greeter extends Thread {
    @Override public void run() {
        System.out.println("1. Thread subclass on " + getName());
    }
}
```

```text filename:Output
1. Thread subclass on greeter
2. Runnable on runner
3. lambda on lambda
```

> [!TIP] Do
>
> Implement `Runnable` (or `Callable`) and hand it to a thread or executor — the task stays independent of <em>how</em> it is run, and your class can still extend something else.

> [!DANGER] Avoid
>
> Extending `Thread` just to override `run()` — it burns your single superclass slot and couples the work to one thread.

# `start()` vs `run()`

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Runnable r = () -> System.out.println("running in " + Thread.currentThread().getName());
        Thread t = new Thread(r, "worker");
        t.run();     // an ordinary method call — runs on main, no new thread
        t.start();   // creates the new call stack and calls run() there
        t.join();
        try {
            t.start();   // a Thread object can be started only once
        } catch (IllegalThreadStateException e) {
            System.out.println("second start(): " + e.getClass().getSimpleName());
        }
    }
}
```

```text filename:Output
running in main
running in worker
second start(): IllegalThreadStateException
```

# Thread lifecycle

`NEW` → `RUNNABLE` → `BLOCKED` / `WAITING` / `TIMED_WAITING` → `RUNNABLE` → `TERMINATED`

| `Thread.State` | Meaning | Entered by |
| --- | --- | --- |
| `NEW` | Created, not yet started | `new Thread(...)` |
| `RUNNABLE` | Running <em>or</em> ready to run (the JVM doesn't distinguish) | `start()`; also while doing blocking I/O |
| `BLOCKED` | Waiting to acquire a monitor lock | entering a `synchronized` block held by another thread |
| `WAITING` | Waiting indefinitely for another thread | `wait()`, `join()`, `LockSupport.park()` |
| `TIMED_WAITING` | Waiting with a timeout | `sleep(ms)`, `wait(ms)`, `join(ms)` |
| `TERMINATED` | `run()` returned or threw | end of `run()` |

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Object lock = new Object();
        Thread t = new Thread(() -> {
            synchronized (lock) { System.out.println("worker got the lock"); }
        });
        System.out.println("before start: " + t.getState());
        synchronized (lock) {                      // main holds the lock...
            t.start();
            while (t.getState() != Thread.State.BLOCKED) Thread.onSpinWait();
            System.out.println("waiting for lock: " + t.getState());
        }                                          // ...and releases it here
        t.join();
        System.out.println("after join: " + t.getState());
    }
}
```

```text filename:Output
before start: NEW
waiting for lock: BLOCKED
worker got the lock
after join: TERMINATED
```

# `sleep`, interrupt and daemon threads

Java has no safe way to <em>kill</em> a thread (`stop()` is deprecated and removed in practice). Instead you <strong>interrupt</strong> it — a polite request the thread must check for. Blocking calls (`sleep`, `wait`, `join`, `BlockingQueue.take`) respond by throwing `InterruptedException` and <em>clearing</em> the flag.

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread sleeper = new Thread(() -> {
            try {
                Thread.sleep(10_000);
                System.out.println("woke normally");
            } catch (InterruptedException e) {
                System.out.println("sleep interrupted, flag now " + Thread.currentThread().isInterrupted());
            }
        });
        sleeper.start();
        sleeper.interrupt();
        sleeper.join();

        Thread spinner = new Thread(() -> {
            long n = 0;
            while (!Thread.currentThread().isInterrupted()) n++;   // cooperative check
            System.out.println("spinner saw the interrupt and stopped");
        });
        spinner.start();
        spinner.interrupt();
        spinner.join();

        Thread daemon = new Thread(() -> {
            while (true) {
                try { Thread.sleep(1000); } catch (InterruptedException e) { return; }
            }
        });
        daemon.setDaemon(true);          // must be set before start()
        daemon.start();
        System.out.println("daemon? " + daemon.isDaemon() + " - JVM exits without waiting for it");
    }
}
```

```text filename:Output
sleep interrupted, flag now false
spinner saw the interrupt and stopped
daemon? true - JVM exits without waiting for it
```

| Method | What it does |
| --- | --- |
| `Thread.sleep(ms)` | Pause the <em>current</em> thread; keeps any locks it holds |
| `t.join()` / `t.join(ms)` | Wait until `t` terminates (happens-before: you see all its writes) |
| `t.interrupt()` | Set `t`'s interrupt flag; wakes it from `sleep`/`wait`/`join` |
| `Thread.interrupted()` | <em>Static</em>: test <strong>and clear</strong> the current thread's flag |
| `t.isInterrupted()` | Test the flag without clearing it |
| `t.setDaemon(true)` | Background thread — the JVM exits when only daemons remain |
| `Thread.yield()` | Hint to the scheduler; practically never needed |

> [!WARNING] Watch out
>
> Never swallow `InterruptedException` with an empty `catch`. Either propagate it, or restore the flag with `Thread.currentThread().interrupt()` so code higher up can see the request to stop.

```question
What is the difference between start() and run()?

---

`start()` asks the JVM to create a new thread, which then calls `run()` on its own stack. Calling `run()` directly is just a normal method call on the <em>current</em> thread — no concurrency. `start()` may be called only once per `Thread` object (`IllegalThreadStateException` otherwise).
```

```question
Runnable vs Callable?

---

`Runnable.run()` returns `void` and cannot throw checked exceptions. `Callable<V>.call()` returns a value and may throw `Exception`. Threads accept only `Runnable`; executors accept both and return a `Future` for either.
```

```question
How do you stop a thread?

---

Cooperatively: call `interrupt()` (or set a `volatile` flag) and have the thread check `isInterrupted()` / catch `InterruptedException` and return. `Thread.stop()` is deprecated because it releases locks mid-update and leaves objects corrupted.
```

```question
Does sleep() release the lock?

---

No. `sleep()` keeps every monitor the thread holds. `wait()` is the one that releases the monitor of the object it is called on while waiting.
```
