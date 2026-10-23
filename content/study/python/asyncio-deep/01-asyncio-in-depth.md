---
id: 6f2ca396-fe97-70a5-a549-7ef60d3ea580
key: topic:python/asyncio-deep
subject: python
topic: asyncio-deep
title: asyncio in Depth
slug: asyncio-in-depth
order: 1
---

`asyncio` runs thousands of I/O tasks on <strong>one thread</strong> by switching between them at every `await`. It's cooperative multitasking: fast and lock-free, as long as nobody blocks the loop.

> [!INFO]
>
> <strong>Event loop</strong> — a scheduler that runs ready tasks one at a time. A task runs until it `await`s something that isn't ready (a socket, a timer); the loop then parks it and runs another task, resuming it when its I/O completes.

# Coroutines, tasks &amp; futures

| Object | What it is | Created by |
| --- | --- | --- |
| Coroutine | The paused computation returned by calling an `async def` function. Does <strong>nothing</strong> until awaited or wrapped in a task. | `coro = fetch()` |
| Task | A coroutine scheduled on the loop — it runs concurrently with the code that created it. | `asyncio.create_task(coro)`, `TaskGroup.create_task` |
| Future | A low-level placeholder for a result; tasks are futures. Rarely created by hand. | `loop.create_future()` |

```python filename:Python
import asyncio

async def greet(name):
    await asyncio.sleep(0)                # yield control to the loop once
    return f"hi {name}"

coro = greet("asha")
print(type(coro).__name__)                # coroutine  ← nothing has run yet
print(asyncio.run(coro))                  # hi asha    ← run() starts a loop, runs it, closes it
```

# Sequential awaits vs concurrent tasks

```python filename:Python
import asyncio

async def job(name, delay, log):
    log.append(f"start {name}")
    await asyncio.sleep(delay)
    log.append(f"end {name}")

async def sequential():
    log = []
    await job("a", 0.02, log)             # waits for a to finish…
    await job("b", 0.01, log)             # …before b even starts
    return log

async def concurrent():
    log = []
    t1 = asyncio.create_task(job("a", 0.02, log))   # both scheduled now
    t2 = asyncio.create_task(job("b", 0.01, log))
    await t1
    await t2
    return log

print(asyncio.run(sequential()))   # ['start a', 'end a', 'start b', 'end b']
print(asyncio.run(concurrent()))   # ['start a', 'start b', 'end b', 'end a']
```

> [!WARNING] Watch out
>
> `await coro()` one after another is <strong>sequential</strong>. Concurrency only happens when several tasks exist at once — via `create_task`, `gather` or a `TaskGroup`.

# gather

```python filename:Python
import asyncio

async def fetch(i):
    await asyncio.sleep(0.01 * (3 - i))   # later items finish first…
    if i == 1:
        raise ValueError(f"item {i} failed")
    return i * 10

async def main():
    results = await asyncio.gather(*(fetch(i) for i in range(3)), return_exceptions=True)
    print(results)                        # [0, ValueError('item 1 failed'), 20]  ← …but order = input order
    try:
        await asyncio.gather(fetch(0), fetch(1))
    except ValueError as e:
        print("first error:", e)          # first error: item 1 failed

asyncio.run(main())
```

# TaskGroup — structured concurrency (3.11+)

`async with asyncio.TaskGroup()` waits for every task created in it. If one fails, the others are <strong>cancelled</strong> and all errors are raised together as an `ExceptionGroup` — no orphaned tasks.

```python filename:Python
import asyncio

async def worker(n):
    await asyncio.sleep(0.01)
    if n == 2:
        raise KeyError(n)
    return n

async def main():
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(worker(n)) for n in range(2)]
    print([t.result() for t in tasks])    # [0, 1]  ← all done when the block exits

    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(worker(2))
            slow = tg.create_task(asyncio.sleep(10))
    except* KeyError as eg:
        print(type(eg).__name__, len(eg.exceptions))   # ExceptionGroup 1
    print(slow.cancelled())               # True  ← the sibling was cancelled

asyncio.run(main())
```

> [!NOTE] Key point
>
> Prefer `TaskGroup` over bare `create_task` + `gather` in new code. A bare task that nobody keeps a reference to can even be garbage-collected mid-flight — keep references or use a group.

# Timeouts &amp; cancellation

```python filename:Python
import asyncio

async def main():
    try:
        async with asyncio.timeout(0.01):          # 3.11+
            await asyncio.sleep(1)
    except TimeoutError:
        print("timeout block")                     # timeout block

    try:
        await asyncio.wait_for(asyncio.sleep(1), timeout=0.01)
    except TimeoutError:
        print("wait_for")                          # wait_for

asyncio.run(main())
```

```python filename:Python
import asyncio

async def worker(log):
    try:
        await asyncio.sleep(1)
    except asyncio.CancelledError:
        log.append("cleaning up")
        raise                             # always re-raise CancelledError

async def main():
    log = []
    t = asyncio.create_task(worker(log))
    await asyncio.sleep(0)                # let it start
    t.cancel()                            # throws CancelledError into it at its await
    try:
        await t
    except asyncio.CancelledError:
        log.append("cancelled")
    print(log, t.cancelled())             # ['cleaning up', 'cancelled'] True

asyncio.run(main())
```

> [!WARNING] Watch out
>
> Swallowing `CancelledError` (`except Exception` doesn't catch it, but a bare `except:` or `except BaseException` does) breaks timeouts and `TaskGroup` shutdown. Clean up, then re-raise.

# Queues &amp; semaphores

```python filename:Python
import asyncio

async def consumer(q, out):
    while True:
        item = await q.get()
        out.append(item * item)
        q.task_done()

async def main():
    q = asyncio.Queue(maxsize=2)          # put() waits when full
    out = []
    workers = [asyncio.create_task(consumer(q, out)) for _ in range(2)]
    for i in range(5):                    # the producer
        await q.put(i)
    await q.join()                        # every item processed
    for w in workers:
        w.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    print(sorted(out))                    # [0, 1, 4, 9, 16]

asyncio.run(main())
```

```python filename:Python
import asyncio

async def main():
    sem = asyncio.Semaphore(3)            # at most 3 "requests" in flight
    active = peak = 0

    async def fetch(i):
        nonlocal active, peak
        async with sem:
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            return i

    results = await asyncio.gather(*(fetch(i) for i in range(10)))
    print(results == list(range(10)), peak)   # True 3

asyncio.run(main())
```

> [!NOTE] Key point
>
> No lock is needed around `active += 1` here: with one thread, a task can only be interrupted at an `await`.

# Blocking code: `asyncio.to_thread`

A blocking call (`time.sleep`, `requests.get`, heavy CPU) freezes the <strong>whole loop</strong> — every other task stops. Push it to a worker thread:

```python filename:Python
import asyncio, time

def blocking_io(x):
    time.sleep(0.01)                      # a blocking library call
    return x * 2

async def main():
    results = await asyncio.gather(
        asyncio.to_thread(blocking_io, 1),   # runs in the default thread pool
        asyncio.to_thread(blocking_io, 2),
    )
    print(results)                        # [2, 4]

asyncio.run(main())
```

# Async iterators &amp; context managers

```python filename:Python
import asyncio
from contextlib import asynccontextmanager

async def ticker(n):                      # async generator
    for i in range(n):
        await asyncio.sleep(0)
        yield i

log = []

@asynccontextmanager
async def connection(name):               # async with → __aenter__ / __aexit__
    log.append(f"open {name}")
    try:
        yield name.upper()
    finally:
        log.append(f"close {name}")

async def main():
    squares = [i * i async for i in ticker(4)]   # async comprehension
    print(squares)                        # [0, 1, 4, 9]
    async with connection("db") as conn:
        log.append(f"using {conn}")
    print(log)                            # ['open db', 'using DB', 'close db']

asyncio.run(main())
```

# Common mistakes

```python filename:Python
import asyncio

async def save():
    return "saved"

async def main():
    result = save()                       # forgot await → just a coroutine object
    print(type(result).__name__)          # coroutine
    result.close()                        # (silences "coroutine was never awaited")
    print(await save())                   # saved

asyncio.run(main())
```

| Mistake | Symptom | Fix |
| --- | --- | --- |
| Forgetting `await` | `RuntimeWarning: coroutine … was never awaited`; nothing happens | `await` it or create a task |
| `time.sleep()` / `requests` in a coroutine | All tasks freeze | `await asyncio.sleep()`, async libraries, or `asyncio.to_thread` |
| CPU-heavy loop in a coroutine | Latency spikes for every other task | `loop.run_in_executor(ProcessPoolExecutor(), …)` |
| Calling `asyncio.run` inside a running loop | `RuntimeError` | `await` the coroutine instead |
| Fire-and-forget tasks without a reference | Task silently disappears; errors never seen | Keep references / use `TaskGroup` |

# Sync vs async at a glance

| Sync | Async |
| --- | --- |
| `def f():` | `async def f():` |
| `f()` | `await f()` |
| `time.sleep(1)` | `await asyncio.sleep(1)` |
| `for x in it:` | `async for x in ait:` |
| `with cm:` | `async with cm:` |
| `threading.Lock` | `asyncio.Lock` (only across `await`s) |
| `queue.Queue` | `asyncio.Queue` |
| `ThreadPoolExecutor.map` | `asyncio.gather` / `TaskGroup` |

```question
How is asyncio different from threading?

---

asyncio uses one thread and <strong>cooperative</strong> switching: tasks yield only at `await`, so there are no surprise interleavings and tasks are very cheap (thousands are fine). Threads are <strong>pre-emptive</strong>: the OS can switch at any bytecode, so shared data needs locks, and each thread costs more memory. Neither gives CPU parallelism under the GIL.
```

```question
What happens if you call a blocking function inside a coroutine?

---

It blocks the event loop thread, so every other task stalls until it returns. Use the async equivalent, or offload with `await asyncio.to_thread(func, …)` (or `run_in_executor` with a process pool for CPU work).
```

```question
gather vs TaskGroup?

---

Both run awaitables concurrently. `gather` returns results in order and, by default, propagates the first exception while leaving the other tasks running (or collects errors with `return_exceptions=True`). `TaskGroup` (3.11+) guarantees structure: if any task fails, the rest are cancelled and all failures are raised as an `ExceptionGroup`.
```
