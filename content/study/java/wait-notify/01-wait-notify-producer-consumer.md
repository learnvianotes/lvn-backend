---
id: eb7daae8-57b3-7d93-b25d-6e7a5a746844
key: topic:java/wait-notify
subject: java
topic: wait-notify
title: wait/notify & Producer–Consumer
slug: wait-notify-producer-consumer
order: 1
---

`wait()` and `notify()` let threads <em>coordinate</em> — sleep until a condition becomes true — instead of busy-spinning. In modern code a `BlockingQueue` usually does this for you.

> [!INFO]
>
> <strong>Guarded wait</strong> — a thread holding an object's monitor calls `wait()` in a `while (!condition)` loop: it releases the monitor and sleeps until another thread calls `notify()`/`notifyAll()` on the same object, then re-acquires the monitor and re-checks the condition.

# The rules

| Method (on `Object`) | Effect |
| --- | --- |
| `wait()` | Release this object's monitor and wait (state `WAITING`) until notified or interrupted |
| `wait(ms)` | Same, with a timeout (`TIMED_WAITING`) |
| `notify()` | Wake <em>one</em> arbitrary waiting thread |
| `notifyAll()` | Wake <em>all</em> waiting threads — they compete for the monitor and re-check their conditions |

- All three must be called while holding the object's monitor (inside `synchronized (obj)`), otherwise `IllegalMonitorStateException`.
- Always wait in a <strong>`while`</strong> loop, never `if`: threads can wake <em>spuriously</em>, and another thread may have consumed the condition first.
- Prefer `notifyAll()` unless all waiters are interchangeable and only one can proceed.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Object o = new Object();
        try {
            o.wait();                           // not holding o's monitor!
        } catch (IllegalMonitorStateException | InterruptedException e) {
            System.out.println(e.getClass().getSimpleName());
        }
    }
}
```

```text filename:Output
IllegalMonitorStateException
```

# A bounded buffer with wait/notifyAll

```java filename:Java
import java.util.ArrayDeque;
import java.util.Queue;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BoundedBuffer buf = new BoundedBuffer(2);
        Thread producer = new Thread(() -> {
            try {
                for (int i = 1; i <= 5; i++) buf.put(i);
                buf.put(-1);                              // poison pill: "no more items"
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        Thread consumer = new Thread(() -> {
            try {
                int sum = 0;
                for (int x; (x = buf.take()) != -1; ) {
                    System.out.println("consumed " + x);
                    sum += x;
                }
                System.out.println("sum = " + sum);
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        producer.start(); consumer.start();
        producer.join();  consumer.join();
    }
}

class BoundedBuffer {
    private final Queue<Integer> items = new ArrayDeque<>();
    private final int capacity;

    BoundedBuffer(int capacity) { this.capacity = capacity; }

    synchronized void put(int x) throws InterruptedException {
        while (items.size() == capacity) wait();   // full: wait for space
        items.add(x);
        notifyAll();                               // wake consumers
    }

    synchronized int take() throws InterruptedException {
        while (items.isEmpty()) wait();            // empty: wait for data
        int x = items.remove();
        notifyAll();                               // wake producers
        return x;
    }
}
```

```text filename:Output
consumed 1
consumed 2
consumed 3
consumed 4
consumed 5
sum = 15
```

# The modern way: `BlockingQueue`

```java filename:Java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<String> queue = new ArrayBlockingQueue<>(2);
        Thread producer = new Thread(() -> {
            try {
                for (String job : new String[]{"resize", "upload", "notify"}) queue.put(job);
                queue.put("DONE");
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        producer.start();
        for (String job; !(job = queue.take()).equals("DONE"); ) {
            System.out.println("processing " + job);
        }
        producer.join();
        System.out.println("queue empty: " + queue.isEmpty());
    }
}
```

```text filename:Output
processing resize
processing upload
processing notify
queue empty: true
```

| `BlockingQueue` op | Full / empty behaviour |
| --- | --- |
| `put(e)` / `take()` | Block until space / an element is available |
| `offer(e)` / `poll()` | Return `false` / `null` immediately |
| `offer(e, t, unit)` / `poll(t, unit)` | Block up to a timeout |
| `add(e)` / `remove()` | Throw an exception |

Implementations: `ArrayBlockingQueue` (bounded, array), `LinkedBlockingQueue` (optionally bounded), `PriorityBlockingQueue`, `SynchronousQueue` (capacity 0 — a direct hand-off), `DelayQueue`.

# Deadlock

> [!INFO]
>
> <strong>Deadlock</strong> — two or more threads each hold a lock the other needs, so all wait forever. It needs all four Coffman conditions: mutual exclusion, hold-and-wait, no preemption, circular wait.

Here T1 locks `a` then wants `b`, while T2 locks `b` then wants `a`. The latch makes the bad interleaving certain; the JVM's `ThreadMXBean` detects the cycle (the same thing `jstack` reports).

```java filename:Java
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Object a = new Object(), b = new Object();
        CountDownLatch bothHoldOne = new CountDownLatch(2);
        Thread t1 = worker("T1", a, b, bothHoldOne);
        Thread t2 = worker("T2", b, a, bothHoldOne);   // opposite order!
        t1.start(); t2.start();
        while (t1.getState() != Thread.State.BLOCKED || t2.getState() != Thread.State.BLOCKED) {
            Thread.sleep(10);
        }
        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        System.out.println("deadlocked threads: " + mx.findDeadlockedThreads().length);
        System.out.println("T1 waits for a lock owned by " + mx.getThreadInfo(t1.threadId()).getLockOwnerName());
        System.out.println("T2 waits for a lock owned by " + mx.getThreadInfo(t2.threadId()).getLockOwnerName());
    }

    static Thread worker(String name, Object first, Object second, CountDownLatch latch) {
        Thread t = new Thread(() -> {
            synchronized (first) {
                latch.countDown();
                try { latch.await(); } catch (InterruptedException e) { return; }
                synchronized (second) { System.out.println(name + " finished"); }
            }
        }, name);
        t.setDaemon(true);                 // lets the JVM exit despite the deadlock
        return t;
    }
}
```

```text filename:Output
deadlocked threads: 2
T1 waits for a lock owned by T2
T2 waits for a lock owned by T1
```

# Avoiding deadlock: a global lock order

```java filename:Java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Account x = new Account(1, 1000), y = new Account(2, 1000);
        Thread t1 = new Thread(() -> { for (int i = 0; i < 1000; i++) transfer(x, y, 1); });
        Thread t2 = new Thread(() -> { for (int i = 0; i < 1000; i++) transfer(y, x, 2); });
        t1.start(); t2.start();
        t1.join();  t2.join();
        System.out.println("x = " + x.balance + ", y = " + y.balance + ", total = " + (x.balance + y.balance));
    }

    static void transfer(Account from, Account to, int amount) {
        Account first = from.id < to.id ? from : to;   // always lock the lower id first
        Account second = first == from ? to : from;
        synchronized (first) {
            synchronized (second) {
                from.balance -= amount;
                to.balance += amount;
            }
        }
    }
}

class Account {
    final int id;
    int balance;
    Account(int id, int balance) { this.id = id; this.balance = balance; }
}
```

```text filename:Output
x = 2000, y = 0, total = 2000
```

> [!NOTE] Lock ordering
>
> Acquire locks in one global order (by id, by `System.identityHashCode`) — breaks circular wait.

> [!NOTE] Timeouts
>
> `ReentrantLock.tryLock(timeout)` — give up, release what you hold, retry.

> [!NOTE] Fewer locks
>
> Hold one lock at a time; never call unknown (alien) code while holding a lock.

> [!NOTE] Higher-level tools
>
> Concurrent collections, executors and immutable data remove most explicit locking.

> [!WARNING] Watch out
>
> Other liveness failures: <strong>livelock</strong> (threads keep reacting to each other and make no progress), <strong>starvation</strong> (a thread never gets the lock/CPU — e.g. unfair locks under heavy contention).

```question
Why must wait() be called inside a while loop?

---

Because waking up does not mean the condition is true: <em>spurious wakeups</em> are allowed, `notifyAll()` wakes threads whose condition may still be false, and another thread may grab the monitor and consume the item first. Re-checking in a `while` handles all three.
```

```question
wait() vs sleep()?

---

`wait()` is an `Object` method, must hold that object's monitor, <em>releases</em> it and waits for a notify. `sleep()` is a static `Thread` method, needs no lock, and keeps all locks it holds. Both throw `InterruptedException`.
```

```question
Why are wait/notify defined on Object and not Thread?

---

Because they operate on a <em>monitor</em>, and every object is a monitor. Threads wait on the condition guarded by a particular object's lock, so the methods belong to the lock object.
```

```question
How do you detect a deadlock in production?

---

Take a thread dump (`jstack <pid>`, `jcmd <pid> Thread.print`, or VisualVM/JMC) — it prints "Found one Java-level deadlock" with the cycle. Programmatically, `ThreadMXBean.findDeadlockedThreads()`.
```
