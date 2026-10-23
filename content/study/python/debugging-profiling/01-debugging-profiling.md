---
id: 05498891-c426-79b2-888b-d07f69667dce
key: topic:python/debugging-profiling
subject: python
topic: debugging-profiling
title: Debugging & Profiling
slug: debugging-profiling
order: 1
---

Debugging finds <em>why</em> code is wrong; profiling finds <em>where</em> it is slow or hungry. Both start with reading carefully and measuring, not guessing.

# Reading a traceback

```text filename:Traceback
Traceback (most recent call last):
  File "report.py", line 12, in <module>
    print(average(scores))
          ~~~~~~~^^^^^^^^
  File "report.py", line 4, in average
    return sum(xs) / len(xs)
           ~~~~~~~~^~~~~~~~~
ZeroDivisionError: division by zero
```

1. <strong>Read the last line first</strong>

   The exception type and message: <em>what</em> went wrong.

2. <strong>Walk up the stack</strong>

   Frames are listed oldest → newest; the last frame is where it was raised.

3. <strong>Find your code</strong>

   Skip library frames; the lowest frame in <em>your</em> file is usually the place to fix.

4. <strong>Use the markers</strong>

   Since 3.11 `~~~^^^` points at the exact sub-expression that failed.

# print, logging and assertions

```python filename:Python
items = [3, 5]
total = sum(items)
print(f"{items=} {total=}")          # items=[3, 5] total=8   ← the "=" specifier labels values
print(f"{total / len(items)=:.2f}")  # total / len(items)=4.00
```

# pdb — the built-in debugger

Put `breakpoint()` where you want to stop (3.7+). The program pauses there with an interactive `(Pdb)` prompt; you can inspect variables, step line by line and continue.

```python filename:Python
def apply_discount(price, pct):
    breakpoint()              # execution pauses here
    return price - price * pct / 100
```

```filename:pdb%20session
> shop.py(3)apply_discount()
-> return price - price * pct / 100
(Pdb) p price, pct
(200, 15)
(Pdb) n
--Return--
(Pdb) c
```

| Command | Does |
| --- | --- |
| `p expr` / `pp expr` | Print / pretty-print an expression |
| `n` (next) | Run the current line, stepping <em>over</em> calls |
| `s` (step) | Step <em>into</em> a function call |
| `c` (continue) | Run until the next breakpoint |
| `r` (return) | Run until the current function returns |
| `l` / `ll` | List source around the current line / the whole function |
| `w` (where) | Show the call stack |
| `u` / `d` | Move up / down the stack to inspect callers |
| `b file:line` / `b func` | Set a breakpoint |
| `q` | Quit |

```filename:Terminal
$ python -m pdb script.py                 # start under the debugger
$ python -m pdb -c continue script.py     # run; drop into pdb post-mortem on a crash
$ PYTHONBREAKPOINT=0 python script.py     # disable every breakpoint() call
```

> [!NOTE] Key point
>
> IDE debuggers (VS Code, PyCharm) do the same with clicks: breakpoints, conditional breakpoints, watch expressions. `faulthandler` (`python -X faulthandler`) dumps tracebacks even on hard crashes and hangs.

# timeit — micro-benchmarks

```python filename:Python
import timeit

setup = "data = list(range(10_000)); s = set(data)"
list_time = timeit.timeit("9_999 in data", setup=setup, number=1_000)
set_time = timeit.timeit("9_999 in s", setup=setup, number=1_000)
print(set_time < list_time)          # True   ← O(1) hash lookup beats an O(n) scan
```

```filename:Terminal
$ python -m timeit -s "xs = list(range(1000))" "sum(xs)"
20000 loops, best of 5: 11.2 usec per loop
```

# cProfile — where does the time go?

```python filename:Python
import cProfile, pstats, io

def slow_square(n):
    return sum(i * i for i in range(n))

def work():
    return [slow_square(20_000) for _ in range(20)]

profiler = cProfile.Profile()
profiler.enable()
work()
profiler.disable()

out = io.StringIO()
stats = pstats.Stats(profiler, stream=out).sort_stats("cumulative")
stats.print_stats(5)
print("slow_square" in out.getvalue())     # True
```

```text filename:Typical%20report%20(timings%20vary)
      400063 function calls in 0.041 seconds

Ordered by: cumulative time

ncalls  tottime  percall  cumtime  percall filename:lineno(function)
     1    0.000    0.000    0.041    0.041 app.py:6(work)
    20    0.000    0.000    0.041    0.002 app.py:3(slow_square)
    20    0.019    0.001    0.041    0.002 {built-in method builtins.sum}
400020    0.022    0.000    0.022    0.000 app.py:4(<genexpr>)
```

| Column | Meaning |
| --- | --- |
| `ncalls` | How many times the function was called |
| `tottime` | Time spent in the function itself, excluding sub-calls |
| `cumtime` | Time including everything it called — sort by this to find hot paths |

```filename:Terminal
$ python -m cProfile -s cumtime app.py      # profile a whole script
$ python -m cProfile -o out.prof app.py && snakeviz out.prof   # visualise
```

# tracemalloc — where does the memory go?

```python filename:Python
import tracemalloc

tracemalloc.start()
big = [str(i) * 10 for i in range(50_000)]
current, peak = tracemalloc.get_traced_memory()
top = tracemalloc.take_snapshot().statistics("lineno")[0]
tracemalloc.stop()
print(peak > 1_000_000, top.size > 1_000_000)   # True True
```

| Tool | Kind | Good for |
| --- | --- | --- |
| `cProfile` | Deterministic, built in | Which functions take the time |
| `py-spy` | Sampling, attaches to a running process | Production processes, no code changes |
| `line_profiler` | Line by line | The slow line inside a known-slow function |
| `scalene` | CPU + memory + GPU sampling | An all-in-one view |
| `memray` / `tracemalloc` | Memory allocations | Leaks and peak usage |

```question
How would you find why a Python program is slow?

---

Reproduce with a realistic input, profile with `cProfile` (or `py-spy` on a live process), sort by cumulative time, then zoom in with `line_profiler` or `timeit`. Fix the biggest hotspot — usually an algorithm or data-structure issue — and measure again.
```

```question
What does breakpoint() do?

---

It calls `sys.breakpointhook()`, which starts `pdb` at that line by default. The `PYTHONBREAKPOINT` environment variable can switch to another debugger or disable it (`=0`).
```
