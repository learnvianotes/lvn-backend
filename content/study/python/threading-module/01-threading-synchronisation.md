---
id: cffc86bc-1fa8-7bbd-acfa-a68ff3b5a174
key: topic:python/threading-module
subject: python
topic: threading-module
title: Threading & Synchronisation
slug: threading-synchronisation
order: 1
---

`threading` runs functions in OS threads that share one memory space. Sharing is the superpower and the danger — the synchronisation primitives (`Lock`, `Event`, `Queue`, …) are how you stay correct.

> [!INFO]
>
> <strong>Thread</strong> — an independent flow of execution inside one process. All threads see the same globals and heap objects, so they can communicate cheaply — and corrupt each other's data if they write without coordination.

# Creating, starting &amp; joining threads

Pass a `target` callable (plus `args`/`kwargs`), or subclass `Thread` and override `run()`. `start()` launches the thread; `join()` waits for it to finish.

```python filename:Python
import threading

results = {}

def square(n):
    results[n] = n * n                    # each thread writes its own key

threads = [threading.Thread(target=square, args=(i,), name=f"worker-{i}") for i in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()                              # wait for all of them
print(sorted(results.items()))            # [(0, 0), (1, 1), (2, 4), (3, 9)]
print(threads[0].name, threads[0].is_alive())   # worker-0 False

class Downloader(threading.Thread):       # subclass style
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.size = None
    def run(self):                        # called in the new thread by start()
        self.size = len(self.url)         # stands in for a real download

d = Downloader("https://example.com")
d.start(); d.join()
print(d.size)                             # 19
```

> [!WARNING] Watch out
>
> Call `start()`, not `run()`. `t.run()` just executes the function in the <em>current</em> thread — no concurrency at all, and no error to tell you.

| Method / attribute | Meaning |
| --- | --- |
| `t.start()` | Begin running `run()` in a new OS thread (once per thread object) |
| `t.join(timeout=None)` | Block until the thread ends (or the timeout passes) |
| `t.is_alive()` | Still running? |
| `t.daemon` | Daemon threads don't keep the program alive |
| `threading.current_thread()` | The `Thread` object running this code |
| `threading.active_count()` | Number of live threads |

# Daemon threads

The interpreter exits when all <strong>non-daemon</strong> threads have finished. Daemon threads are killed abruptly at exit — fine for background heartbeats, dangerous for anything that writes files or commits transactions.

```python filename:Python
import threading

def heartbeat(stop):
    while not stop.is_set():
        stop.wait(0.01)                   # sleep, but wake up immediately when stopped

stop = threading.Event()
t = threading.Thread(target=heartbeat, args=(stop,), daemon=True)
t.start()
print(t.daemon, t.is_alive())             # True True
stop.set(); t.join()                      # a clean shutdown is still better
print(t.is_alive())                       # False
```

# Race conditions: why `x += 1` isn't safe

A thread switch can happen <strong>between any two bytecodes</strong>. `counter += 1` is a read, an add and a write — three steps:

```python filename:Python
import dis

def increment():
    global counter
    counter += 1

ops = [i.opname for i in dis.get_instructions(increment)]
print([op for op in ops if op in ("LOAD_GLOBAL", "BINARY_OP", "STORE_GLOBAL")])
# ['LOAD_GLOBAL', 'BINARY_OP', 'STORE_GLOBAL']
```

| Step | Thread A | Thread B | `counter` |
| --- | --- | --- | --- |
| 1 | reads 5 |  | 5 |
| 2 |  | reads 5 | 5 |
| 3 | computes 6, writes 6 |  | 6 |
| 4 |  | computes 6, writes 6 | 6 — one increment <strong>lost</strong> |

> [!NOTE] Key point
>
> Races are non-deterministic: the code may pass a thousand runs and fail in production. The fix is to make the read-modify-write <strong>atomic</strong> with a lock.

# Lock &amp; RLock

```python filename:Python
import threading

class BankAccount:
    def __init__(self):
        self.balance = 0
        self._lock = threading.Lock()

    def deposit(self, amount):
        with self._lock:                  # acquire … release, even on exceptions
            self.balance += amount

acct = BankAccount()

def worker():
    for _ in range(10_000):
        acct.deposit(1)

threads = [threading.Thread(target=worker) for _ in range(5)]
for t in threads: t.start()
for t in threads: t.join()
print(acct.balance)                       # 50000

lock = threading.Lock()
lock.acquire()
print(lock.acquire(timeout=0.01))         # False  ← a Lock is not re-entrant
lock.release()
```

A plain `Lock` deadlocks if the <strong>same</strong> thread tries to take it twice. An `RLock` (re-entrant lock) counts acquisitions by its owner — handy when one locked method calls another.

```python filename:Python
import threading

class Inventory:
    def __init__(self):
        self._lock = threading.RLock()
        self.items = {}

    def add(self, name, qty=1):
        with self._lock:
            self.items[name] = self.items.get(name, 0) + qty

    def add_many(self, names):
        with self._lock:                  # held here…
            for n in names:
                self.add(n)               # …and re-acquired inside add(): OK with RLock

inv = Inventory()
inv.add_many(["pen", "pen", "ink"])
print(inv.items)                          # {'pen': 2, 'ink': 1}
```

# Semaphore, Event &amp; Condition

> [!NOTE] Semaphore(n)
>
> A lock that up to `n` threads can hold at once — limit concurrent DB connections or API calls. `BoundedSemaphore` also errors if released too often.

> [!NOTE] Event
>
> A thread-safe boolean flag: `set()`, `clear()`, `wait()`. Great for “start now” and “please stop” signals.

> [!NOTE] Condition
>
> A lock plus wait/notify: threads sleep until <em>some predicate</em> becomes true — the building block of queues.

> [!NOTE] Barrier(n)
>
> `n` threads each call `wait()`; all are released together once the last one arrives.

```python filename:Python
import threading, time

sem = threading.Semaphore(2)              # at most 2 inside at a time
active = peak = 0
guard = threading.Lock()

def task():
    global active, peak
    with sem:
        with guard:
            active += 1
            peak = max(peak, active)
        time.sleep(0.01)
        with guard:
            active -= 1

threads = [threading.Thread(target=task) for _ in range(6)]
for t in threads: t.start()
for t in threads: t.join()
print(peak <= 2)                          # True

ready = threading.Event()
log = []

def waiter():
    ready.wait()                          # blocks until set()
    log.append("go")

w = threading.Thread(target=waiter); w.start()
log.append("setting up")
ready.set(); w.join()
print(log)                                # ['setting up', 'go']

cond = threading.Condition()
items, got = [], []

def consumer():
    with cond:
        cond.wait_for(lambda: len(items) >= 3)   # sleeps; re-checks after each notify
        got.extend(items)

c = threading.Thread(target=consumer); c.start()
for i in range(3):
    with cond:
        items.append(i)
        cond.notify()
c.join()
print(got)                                # [0, 1, 2]
```

# Producer–consumer with `queue.Queue`

`queue.Queue` is already thread-safe and does all the locking for you. It's the cleanest way for threads to hand work to each other — prefer it to sharing lists and locks.

```python filename:Python
import queue, threading

q = queue.Queue(maxsize=5)                # put() blocks when full → back-pressure
results = []
STOP = object()                           # a unique sentinel

def consumer():
    while True:
        n = q.get()
        if n is STOP:
            q.task_done()
            break
        results.append(n * n)             # list.append is safe; fancier updates need a lock
        q.task_done()

workers = [threading.Thread(target=consumer) for _ in range(3)]
for w in workers: w.start()
for n in range(10):                       # the producer
    q.put(n)
for _ in workers:
    q.put(STOP)                           # one sentinel per consumer
q.join()                                  # wait until every item is task_done()
for w in workers: w.join()
print(sorted(results))                    # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

| Queue class | Order |
| --- | --- |
| `queue.Queue` | FIFO |
| `queue.LifoQueue` | LIFO (a stack) |
| `queue.PriorityQueue` | Smallest item first — put `(priority, item)` tuples |
| `queue.SimpleQueue` | Unbounded FIFO without `task_done`/`join` — simpler, faster |

> [!NOTE] 3.13+
>
> Since 3.13, `Queue.shutdown()` wakes blocked `get()`/`put()` callers with `queue.ShutDown` — an alternative to sentinel values.

# Per-thread data: `threading.local`

```python filename:Python
import threading

ctx = threading.local()                   # each thread sees its own attributes
seen = {}

def current_user_greeting():
    return f"hi {ctx.user}"               # no need to pass user down the call chain

def handle(user):
    ctx.user = user
    seen[user] = current_user_greeting()

threads = [threading.Thread(target=handle, args=(u,)) for u in ("asha", "ravi")]
for t in threads: t.start()
for t in threads: t.join()
print(sorted(seen.values()))              # ['hi asha', 'hi ravi']
print(hasattr(ctx, "user"))               # False  ← the main thread never set it
```

# Deadlocks &amp; lock ordering

Thread 1 holds lock A and waits for B; thread 2 holds B and waits for A — both wait forever. The standard cure is to <strong>always acquire locks in one global order</strong>.

```python filename:Python
import threading

class Account:
    def __init__(self, id, balance):
        self.id, self.balance = id, balance
        self.lock = threading.Lock()

def transfer(src, dst, amount):
    first, second = sorted((src, dst), key=lambda a: a.id)   # fixed order, whatever the direction
    with first.lock, second.lock:
        src.balance -= amount
        dst.balance += amount

a, b = Account(1, 100), Account(2, 100)
t1 = threading.Thread(target=lambda: [transfer(a, b, 1) for _ in range(1000)])
t2 = threading.Thread(target=lambda: [transfer(b, a, 1) for _ in range(1000)])
t1.start(); t2.start(); t1.join(); t2.join()
print(a.balance, b.balance)               # 100 100
```

- Take locks in a consistent order (by id, by name, by address).
- Hold locks for as short a time as possible; never call unknown code (callbacks, I/O) while holding one.
- Use `lock.acquire(timeout=…)` to detect a stuck lock instead of hanging forever.
- Prefer message passing (`queue.Queue`) over many fine-grained locks.

# Timer

```python filename:Python
import threading

fired = threading.Event()
t = threading.Timer(0.01, fired.set)      # run fired.set() after 10 ms, in a new thread
t.start()
print(fired.wait(timeout=1))              # True

never = threading.Timer(10, print, args=("never printed",))
never.start()
never.cancel(); never.join()              # cancel before it fires
print(never.is_alive())                   # False
```

# Which built-in operations are thread-safe?

| Usually atomic (single operation on a built-in) | NOT atomic — needs a lock |
| --- | --- |
| `L.append(x)`, `L.pop()`, `L.extend(ys)` | `x += 1`, `L[i] += 1`, `d[k] += 1` |
| `d[k] = v`, `d.get(k)`, `d.pop(k, None)` | `if k not in d: d[k] = v` (check-then-act) |
| `x = L[i]`, `q.put(x)`, `q.get()` | `d[k] = d.get(k, 0) + 1` |
| `d.setdefault(k, v)` | Any sequence of several operations that must stay consistent |

> [!WARNING] Watch out
>
> Atomicity of single built-in operations is a CPython implementation detail (the GIL on the default build, per-object locks on the free-threaded build). It's fine to rely on `queue.Queue`; for your own invariants, use a lock.

```question
What is a race condition and how do you prevent one?

---

The result depends on the unpredictable interleaving of threads — typically two threads doing read-modify-write on shared data. Prevent it by making the critical section atomic with a `Lock`, by confining data to one thread (`queue.Queue`, `threading.local`), or by using immutable data.
```

```question
Lock vs RLock?

---

A `Lock` can be acquired once; a second `acquire()` — even from the same thread — blocks. An `RLock` records its owner and a counter, so the owning thread can re-acquire it (it must release it the same number of times). Use `RLock` when locked methods call other locked methods.
```

```question
What is a deadlock and how do you avoid it?

---

Two or more threads each wait for a lock held by another, so none can proceed. Avoid it with a global lock-ordering rule, minimal lock scope, timeouts on `acquire`, and message passing instead of shared locks.
```
