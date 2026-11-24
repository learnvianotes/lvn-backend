---
id: ae9ef263-a535-7ad7-9aa1-65b919837de7
key: topic:python/multiprocessing-module
subject: python
topic: multiprocessing-module
title: Multiprocessing
slug: multiprocessing
order: 1
---

`multiprocessing` runs code in separate processes — each with its own interpreter, memory and GIL — so CPU-bound Python work finally uses every core.

> [!INFO]
>
> <strong>Process</strong> — an independent program instance with its own address space. Processes share nothing by default; data moves between them by <strong>pickling</strong> it through pipes or queues.

# Processes vs threads

|  | Threads | Processes |
| --- | --- | --- |
| Memory | Shared | Separate (copy or explicit sharing) |
| GIL | One GIL for all threads | One GIL <strong>per process</strong> → true parallelism |
| Start-up cost | \~microseconds | \~milliseconds (a new interpreter) |
| Communication | Any object, directly | Pickled messages: `Queue`, `Pipe`, shared memory |
| A crash | Can take down the whole program | Isolated to that process |
| Use for | I/O-bound work | CPU-bound work |

# `Process`: start, join, exit code

```python filename:Python
from multiprocessing import Process, current_process

def work(n):
    print(f"{current_process().name}: {n * n}")

if __name__ == "__main__":
    procs = [Process(target=work, args=(i,), name=f"P{i}") for i in range(3)]
    for p in procs:
        p.start()
    for p in procs:
        p.join()
    print("exit codes:", [p.exitcode for p in procs])
```

```text filename:Output%20(the%20P%20lines%20can%20appear%20in%20any%20order)
P0: 0
P1: 1
P2: 4
exit codes: [0, 0, 0]
```

> [!WARNING] Required
>
> The `if __name__ == "__main__":` guard is <strong>mandatory</strong> with the `spawn` and `forkserver` start methods: each child re-imports your module, and without the guard it would start children of its own, recursively.

# `Pool`: parallel map

```python filename:Python
from multiprocessing import Pool

def square(x):
    return x * x

def power(base, exp):
    return base ** exp

if __name__ == "__main__":
    with Pool(processes=4) as pool:
        print(pool.map(square, range(6)))                 # [0, 1, 4, 9, 16, 25]
        print(list(pool.imap(square, range(3))))          # [0, 1, 4]  ← lazy, in order
        print(sorted(pool.imap_unordered(square, range(3))))   # [0, 1, 4]  ← as they finish
        print(pool.starmap(power, [(2, 3), (3, 2)]))      # [8, 9]  ← unpacks tuples
        r = pool.apply_async(square, (7,))
        print(r.get(timeout=5))                           # 49
```

| Method | Returns | Use when |
| --- | --- | --- |
| `map(f, it, chunksize)` | A list, in input order (blocks) | All inputs known, results fit in memory |
| `imap(f, it)` | A lazy iterator, in order | Large inputs; process results as a stream |
| `imap_unordered(f, it)` | A lazy iterator, completion order | Order doesn't matter — fastest feedback |
| `starmap(f, pairs)` | A list; each tuple is unpacked into args | Functions of several arguments |
| `apply_async(f, args)` | An `AsyncResult` (`.get()`) | One-off background calls |

> [!NOTE] Performance
>
> For many tiny tasks, pass a larger `chunksize` to `map`/`imap` — sending each item separately costs more in pickling and IPC than the work itself.

# Start methods

| Method | How the child starts | Default on |
| --- | --- | --- |
| `spawn` | A fresh interpreter imports your module, then runs the target. Safe, slower. | Windows, <strong>macOS</strong> (since 3.8) |
| `fork` | The OS copies the parent process (memory included). Fast, but unsafe if the parent has threads. | Linux before 3.14 |
| `forkserver` | A clean server process is started once and forks children on request. | <strong>Linux since 3.14</strong> |

```python filename:Python
import multiprocessing as mp

print(mp.cpu_count() > 0)                                     # True
print(mp.get_start_method() in {"fork", "spawn", "forkserver"})   # True
print("spawn" in mp.get_all_start_methods())                  # True  ← available everywhere
```

Choose explicitly with `mp.set_start_method("spawn")` once at start-up, or better, a context: `ctx = mp.get_context("spawn"); ctx.Pool(...)`. Code that works under `spawn` works everywhere.

# Everything crosses the boundary by pickling

Arguments, return values and queue items are pickled in the parent and unpickled in the child. Functions are pickled <strong>by name</strong>, so the target must be importable: a module-level `def`, not a lambda, nested function or something defined in the REPL.

```python filename:Python
import pickle

def module_level(x):
    return x

try:
    pickle.dumps(lambda x: x)
except pickle.PicklingError:
    print("lambdas can't be sent to a worker")   # lambdas can't be sent to a worker
```

> [!WARNING] Watch out
>
> Large arguments are copied for every task. Send small descriptions (file paths, index ranges) and let workers load the data, or use shared memory.

# Communicating: Queue &amp; Pipe

```python filename:Python
from multiprocessing import Process, Queue, Pipe

def producer(q):
    for i in range(3):
        q.put(i * 10)
    q.put(None)                           # sentinel: "no more"

def echo(conn):
    msg = conn.recv()
    conn.send(msg.upper())
    conn.close()

if __name__ == "__main__":
    q = Queue()
    p = Process(target=producer, args=(q,)); p.start()
    items = []
    while (item := q.get()) is not None:
        items.append(item)
    p.join()
    print(items)                          # [0, 10, 20]

    parent, child = Pipe()                # two connected ends
    p = Process(target=echo, args=(child,)); p.start()
    parent.send("hello")
    print(parent.recv())                  # HELLO
    p.join()
```

# Sharing state

> [!NOTE] Value / Array
>
> A single number or fixed array in shared memory, with an optional lock: `Value('i', 0)`, `Array('d', 10)`.

> [!NOTE] shared_memory
>
> A raw named block of bytes any process can attach to — zero-copy for NumPy arrays (3.8+).

> [!NOTE] Manager()
>
> A server process holding real `dict`/`list` objects; others use proxies. Flexible but slow (every access is IPC).

```python filename:Python
from multiprocessing import Process, Value, Manager

def add(counter, n):
    for _ in range(n):
        with counter.get_lock():          # += on shared memory still needs the lock
            counter.value += 1

def record(d, key):
    d[key] = key * 2

if __name__ == "__main__":
    counter = Value("i", 0)
    ps = [Process(target=add, args=(counter, 1000)) for _ in range(4)]
    for p in ps: p.start()
    for p in ps: p.join()
    print(counter.value)                  # 4000

    with Manager() as m:
        d = m.dict()
        ps = [Process(target=record, args=(d, k)) for k in range(3)]
        for p in ps: p.start()
        for p in ps: p.join()
        print(dict(sorted(d.items())))    # {0: 0, 1: 2, 2: 4}
```

`shared_memory` hands out a named buffer; another process attaches by name. Here both ends live in one process to show the API:

```python filename:Python
from multiprocessing import shared_memory

shm = shared_memory.SharedMemory(create=True, size=4)
try:
    shm.buf[:4] = bytes([1, 2, 3, 4])
    other = shared_memory.SharedMemory(name=shm.name)   # normally done in another process
    print(list(other.buf[:4]))                          # [1, 2, 3, 4]
    other.close()
finally:
    shm.close()
    shm.unlink()                          # free the block (only the creator does this)
```

> [!TIP] Do
>
> Use processes for CPU-heavy, independent chunks of work; keep messages small; prefer `ProcessPoolExecutor` or `Pool` over hand-managed `Process` objects.

> [!DANGER] Avoid
>
> Spawning a process per tiny task, sharing huge objects through a `Manager`, or forgetting the `__main__` guard.

```question
Why does multiprocessing need if \_\_name\_\_ == "\_\_main\_\_"?

---

With `spawn`/`forkserver` the child process imports your main module to find the target function. Without the guard, that import would execute the process-creating code again — infinite recursion (Python raises a `RuntimeError` to stop it).
```

```question
How do processes share data?

---

By default they don't — each has its own memory. You send pickled messages (`Queue`, `Pipe`, pool arguments/results), or share explicitly with `Value`/`Array`, `shared_memory`, or a `Manager` proxy.
```

```question
fork vs spawn?

---

`fork` copies the running parent (fast, inherits everything — including held locks from other threads, which can deadlock). `spawn` starts a fresh interpreter (slower, but clean and portable). macOS and Windows default to `spawn`; Linux moved from `fork` to `forkserver` in 3.14.
```
