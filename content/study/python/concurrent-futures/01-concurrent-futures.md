---
id: 1ab2e676-3807-7665-a5ca-554451dc5bf2
key: topic:python/concurrent-futures
subject: python
topic: concurrent-futures
title: concurrent.futures
slug: concurrent-futures
order: 1
---

One high-level API for both threads and processes: submit callables to an <em>executor</em> and get back <em>futures</em> — placeholders for results that will arrive later.

> [!INFO]
>
> <strong>Future</strong> — an object representing a pending result. You can ask whether it's `done()`, block on `result()`, fetch its `exception()`, `cancel()` it, or attach callbacks.

# The Executor API

| Call | Does |
| --- | --- |
| `ex.submit(f, *args, **kw)` | Schedule one call → returns a `Future` immediately |
| `ex.map(f, *iterables, timeout=None)` | Like built-in `map`, run in parallel; results in <strong>input order</strong> |
| `ex.shutdown(wait=True, cancel_futures=False)` | Stop accepting work; called automatically by `with` |
| `as_completed(futures, timeout)` | Yield futures as they <strong>finish</strong> |
| `wait(futures, timeout, return_when)` | Block until ALL\_COMPLETED / FIRST\_COMPLETED / FIRST\_EXCEPTION |

# submit, result &amp; map

```python filename:Python
from concurrent.futures import ThreadPoolExecutor

def square(x):
    return x * x

with ThreadPoolExecutor(max_workers=3) as ex:
    fut = ex.submit(square, 7)
    print(fut.result())                   # 49  ← blocks until ready
    print(fut.done())                     # True
    print(list(ex.map(square, [3, 1, 2])))   # [9, 1, 4]  ← input order, always
```

# as\_completed: handle results as they arrive

```python filename:Python
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

def job(name, delay):
    time.sleep(delay)                     # stands in for a network call
    return name

with ThreadPoolExecutor() as ex:
    futures = {ex.submit(job, n, d): n for n, d in [("slow", 0.05), ("fast", 0.0), ("mid", 0.02)]}
    finished = [f.result() for f in as_completed(futures)]   # completion order
print(sorted(finished))                   # ['fast', 'mid', 'slow']
print(len(futures))                       # 3
```

> [!NOTE] Key point
>
> Map each future back to its input with a dict (`{future: input}`), because `as_completed` yields them in whatever order they finish.

# Exceptions travel through the future

An exception raised in a worker is stored in the future and <strong>re-raised when you call </strong><strong>`result()`</strong> — nothing is printed if you never ask.

```python filename:Python
from concurrent.futures import ThreadPoolExecutor

def risky(x):
    if x == 2:
        raise ValueError("bad input 2")
    return x

with ThreadPoolExecutor() as ex:
    futures = [ex.submit(risky, i) for i in range(4)]
    outcomes = []
    for f in futures:
        try:
            outcomes.append(f.result())
        except ValueError as e:
            outcomes.append(f"error: {e}")
print(outcomes)                           # [0, 1, 'error: bad input 2', 3]
print(type(futures[2].exception()).__name__)   # ValueError
```

> [!WARNING] Watch out
>
> With `ex.map`, the first failing item raises when the iterator reaches it, and you lose the remaining results. Use `submit` + per-future `try` when some inputs may fail.

# wait, cancel &amp; timeouts

```python filename:Python
import threading
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

gate = threading.Event()
with ThreadPoolExecutor(max_workers=2) as ex:
    quick = ex.submit(lambda: "quick")
    blocked = ex.submit(gate.wait)        # can't finish until the gate opens
    done, pending = wait([quick, blocked], return_when=FIRST_COMPLETED)
    print([f.result() for f in done], len(pending))   # ['quick'] 1
    gate.set()
```

```python filename:Python
import threading
from concurrent.futures import ThreadPoolExecutor

started, gate = threading.Event(), threading.Event()

def blocker():
    started.set()
    gate.wait()
    return "finished"

with ThreadPoolExecutor(max_workers=1) as ex:
    running = ex.submit(blocker)          # occupies the only worker
    queued = ex.submit(print, "never")    # waits in the queue
    started.wait()
    print(queued.cancel(), queued.cancelled())   # True True  ← not started yet
    print(running.cancel())               # False  ← already running: can't cancel
    try:
        running.result(timeout=0.01)
    except TimeoutError:
        print("timed out")                # timed out
    gate.set()
print(running.result())                   # finished
```

> [!NOTE] Key point
>
> A timeout on `result()` only stops <em>you</em> waiting — the task keeps running. Threads can't be killed; design long tasks to check a stop `Event`.

# Callbacks

```python filename:Python
from concurrent.futures import ThreadPoolExecutor

log = []
with ThreadPoolExecutor() as ex:
    f = ex.submit(sum, [1, 2, 3])
    f.add_done_callback(lambda fut: log.append(fut.result() * 10))
print(log)                                # [60]
```

# Processes &amp; interpreters: same API

```python filename:Python
from concurrent.futures import ProcessPoolExecutor

def count_primes(limit):
    return sum(all(n % d for d in range(2, int(n ** 0.5) + 1)) for n in range(2, limit))

if __name__ == "__main__":
    with ProcessPoolExecutor() as ex:     # one worker per CPU core by default
        print(list(ex.map(count_primes, [10_000, 20_000], chunksize=1)))   # [1229, 2262]
```

| Executor | Parallel CPU? | Default `max_workers` | Notes |
| --- | --- | --- | --- |
| `ThreadPoolExecutor` | No (GIL) | `min(32, cpu_count + 4)` | I/O-bound; shares memory |
| `ProcessPoolExecutor` | Yes | number of CPUs | Arguments/results must pickle; needs `__main__` guard |
| `InterpreterPoolExecutor` (3.14) | Yes | number of CPUs | Sub-interpreters in one process, each with its own GIL |

> [!TIP] Do
>
> Size thread pools for the I/O you're waiting on (tens of workers is fine); size process pools to the number of cores.

> [!DANGER] Avoid
>
> Using a `ProcessPoolExecutor` for tiny tasks — pickling and IPC overhead will make it slower than a plain loop.

```question
What's the difference between ex.map and submit + as\_completed?

---

`map` returns results in input order and raises the first exception when you reach it — simple and tidy. `submit` returns one `Future` per call; with `as_completed` you process each result as soon as it's ready and handle failures individually.
```

```question
How do you get an exception out of a worker thread?

---

Call `future.result()` — it re-raises the worker's exception in the caller — or inspect `future.exception()`. With raw `threading.Thread`, exceptions are only reported by `threading.excepthook`, which is why executors are usually nicer.
```
