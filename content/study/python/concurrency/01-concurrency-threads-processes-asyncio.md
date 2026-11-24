---
id: 25c489b0-ee33-7290-9ae9-4eb3245a2288
key: topic:python/concurrency
subject: python
topic: concurrency
title: "Concurrency: Threads, Processes & asyncio"
slug: concurrency-threads-processes-asyncio
order: 1
---

Three tools for doing many things at once. Which one to pick depends on whether your program waits on I/O or burns CPU — because of the GIL.

> [!INFO]
>
> <strong>GIL (Global Interpreter Lock)</strong> — a mutex in CPython that lets only <strong>one thread execute Python bytecode at a time</strong>. Threads still help while waiting on I/O (the GIL is released), but they don't speed up CPU-bound Python code.

|  | `threading` | `multiprocessing` | `asyncio` |
| --- | --- | --- | --- |
| Model | OS threads, shared memory | Separate processes, separate memory | One thread, cooperative tasks |
| Best for | I/O-bound (network, disk) | <strong>CPU-bound</strong> (math, image processing) | Many concurrent I/O waits (thousands of sockets) |
| GIL | Limits CPU parallelism | Bypassed — each process has its own | Not relevant — single thread |
| Cost | Light; needs locks for shared data | Heavy start-up; data must be pickled | Very light; code must be `async` |

# Concurrency vs parallelism

> [!NOTE] Concurrency
>
> <em>Dealing</em> with many things at once: tasks make progress in overlapping time periods, possibly by taking turns on one core. Threads under the GIL and `asyncio` give you this.

> [!NOTE] Parallelism
>
> <em>Doing</em> many things at once: tasks literally run at the same instant on different cores. In CPython that means processes (or a free-threaded build, or C extensions that release the GIL).

# The GIL in detail

- <strong>What it protects:</strong> CPython's internals — above all the reference counts on every object. Without it, two threads doing `refcount += 1` could corrupt memory.
- <strong>When it is released:</strong> during blocking I/O (`socket.recv`, `file.read`, `time.sleep`), and inside many C extensions doing heavy work (NumPy, `hashlib`, `zlib`). The running thread is also forced to hand it over every few milliseconds (`sys.getswitchinterval()`, 5 ms by default).
- <strong>What it does NOT do:</strong> make <em>your</em> code thread-safe. `counter += 1` is several bytecodes, and a switch can happen between them — you still need locks.
- <strong>Free-threaded build:</strong> CPython 3.13 added an optional build without the GIL (`python3.13t`); in 3.14 it is officially supported (PEP 779) as `python3.14t`. Pure-Python threads then run truly in parallel, at a small single-thread cost.

```python filename:Python
import sys
print(sys.getswitchinterval())                 # 0.005
# Only exists on 3.13+; True on the normal build, False on a free-threaded one:
gil = getattr(sys, "_is_gil_enabled", lambda: True)()
print(isinstance(gil, bool))                   # True
```

# Which tool? A decision flow

1. <strong>Is the work mostly waiting?</strong>

   Network calls, disk, databases, sleeping → it's <strong>I/O-bound</strong>.

2. <strong>I/O-bound, a handful to hundreds of tasks</strong>

   `ThreadPoolExecutor` — works with ordinary blocking libraries like `requests`.

3. <strong>I/O-bound, thousands of connections</strong>

   `asyncio` with async libraries (`aiohttp`, `httpx`, `asyncpg`) — one thread, tiny per-task cost.

4. <strong>Is it computing in Python?</strong>

   Loops, parsing, math → <strong>CPU-bound</strong>: `ProcessPoolExecutor` / `multiprocessing`, or vectorise with NumPy, or a free-threaded build.

5. <strong>Mixed?</strong>

   `asyncio` for the I/O, `loop.run_in_executor` / `asyncio.to_thread` or a process pool for the heavy bits.

# Threads for I/O

```python filename:Python
from concurrent.futures import ThreadPoolExecutor
import time

def fetch(i):
    time.sleep(0.2)              # stands in for a network call (releases the GIL)
    return i * i

start = time.perf_counter()
with ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(fetch, range(5)))
elapsed = time.perf_counter() - start
print(results, elapsed < 0.5)    # [0, 1, 4, 9, 16] True
```

# Processes for CPU

```python filename:Python
from concurrent.futures import ProcessPoolExecutor

def heavy(n):
    return sum(i * i for i in range(n))

if __name__ == "__main__":       # required: child processes re-import this module
    with ProcessPoolExecutor() as pool:
        print(list(pool.map(heavy, [10**6] * 4)))
```

# asyncio for massive I/O concurrency

```python filename:Python
import asyncio

async def download(name, delay):
    await asyncio.sleep(delay)   # yields control while "waiting"
    return f"{name} done"

async def main():
    results = await asyncio.gather(download("a", 0.1), download("b", 0.1))
    print(results)               # ['a done', 'b done']

asyncio.run(main())
```

# Shared state needs a lock

```python filename:Python
import threading

counter = 0
lock = threading.Lock()

def work():
    global counter
    for _ in range(100_000):
        with lock:               # without the lock, updates can be lost
            counter += 1

threads = [threading.Thread(target=work) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)                   # 400000
```

> [!NOTE] Key point
>
> `counter += 1` is several bytecode steps (load, add, store), so a thread switch in between loses updates. Protect shared mutable state with a `Lock` or use a `queue.Queue`.

> [!NOTE] Recent change
>
> Python 3.13 shipped an experimental <em>free-threaded</em> build (no GIL); 3.14 makes it officially supported but still optional — the default `python3` keeps the GIL. For interviews, explain the GIL as above and mention free-threading as the direction of travel.

```question
If Python has a GIL, why are threads useful at all?

---

Because most real programs spend their time <strong>waiting</strong> — for the network, the disk or a database. A thread blocked on I/O releases the GIL, so other threads run meanwhile. Threads give concurrency for I/O-bound work; for CPU-bound pure-Python work use processes (or a free-threaded build).
```

```question
Does the GIL make my code thread-safe?

---

No. It only protects the interpreter's internals. A compound operation like `counter += 1` or check-then-act (`if key not in d: d[key] = …`) can be interrupted between bytecodes, so shared mutable state still needs a `Lock`, a `queue.Queue`, or another synchronisation primitive.
```
