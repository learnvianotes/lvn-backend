---
id: ac0f6f8e-bafb-7198-967c-81663770b13d
key: topic:python/exceptions
subject: python
topic: exceptions
title: "Exceptions: try, except, raise"
slug: exceptions-try-except-raise
order: 1
---

Errors are objects that propagate up the call stack until something handles them. `try` / `except` catches them, `raise` creates them, and `finally` (or `with`) guarantees cleanup.

> [!INFO]
>
> <strong>Exception</strong> — an object (an instance of a class derived from `BaseException`) that interrupts normal flow. If no `except` clause up the call stack matches it, the program stops and prints a <em>traceback</em>.

# How an exception travels

1. <strong>Raised</strong>

   Something fails (`int('x')`) or your code runs `raise SomeError(...)`.

2. <strong>Unwinds</strong>

   Python abandons the current function and looks for a matching `except` in each caller, innermost first.

3. <strong>Handled — or not</strong>

   The first matching `except` runs and execution continues after its `try` statement. With no match, the traceback is printed and the interpreter exits with status 1.

```python filename:Python
def level3():
    return int("not a number")      # raises ValueError here

def level2():
    return level3()                  # no handler → passes through

def level1():
    try:
        return level2()
    except ValueError:
        return "handled in level1"

print(level1())                      # handled in level1
```

# try / except / else / finally

```python filename:Python
def parse(value):
    try:
        n = int(value)
    except ValueError as e:
        return f"bad input: {e}"
    else:
        return n * 2            # runs only if no exception
    finally:
        pass                    # always runs: close files, release locks

print(parse("21"))              # 42
print(parse("x"))               # bad input: invalid literal for int() with base 10: 'x'
```

| Block | Runs when |
| --- | --- |
| `try` | Always — the code that might fail |
| `except E` | An exception of type `E` (or a subclass) was raised |
| `else` | The `try` block finished <strong>without</strong> an exception |
| `finally` | Always, even after `return`, `break` or an unhandled error |

> [!NOTE] Key point
>
> Keep only the risky line in `try` and put the follow-up work in `else` — otherwise a bug in the follow-up code could be caught by an `except` that was never meant for it.

# Raising &amp; custom exceptions

```python filename:Python
class InsufficientFunds(Exception):
    def __init__(self, needed):
        super().__init__(f"need {needed} more")
        self.needed = needed

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFunds(amount - balance)
    return balance - amount

try:
    withdraw(100, 150)
except InsufficientFunds as e:
    print(e, e.needed)          # need 50 more 50

try:
    try:
        {}["k"]
    except KeyError as e:
        raise LookupError("config missing") from e    # keep the original cause
except LookupError as e:
    print(repr(e.__cause__))    # KeyError('k')
```

> [!TIP] Do
>
> Catch the most specific exception you can handle, keep `try` blocks small, and re-raise with `raise` (no argument) to preserve the traceback.

> [!DANGER] Avoid
>
> Bare `except:` or `except Exception: pass` — it hides bugs, and a bare `except` even swallows `KeyboardInterrupt`.

# Exception hierarchy (the useful part)

| Exception | Typical cause |
| --- | --- |
| `ValueError` | Right type, wrong value: `int('x')` |
| `TypeError` | Wrong type: `'a' + 1` |
| `KeyError` / `IndexError` | Missing dict key / list index out of range (both are `LookupError`s) |
| `AttributeError` | Object has no such attribute |
| `NameError` | Name not defined (typo, or used before assignment) |
| `ZeroDivisionError` | Division by zero (an `ArithmeticError`) |
| `FileNotFoundError` | Missing file (an `OSError`) |
| `StopIteration` | Iterator is exhausted |
| `RecursionError` | Recursion deeper than `sys.getrecursionlimit()` |

The full tree, `BaseException` vs `Exception`, exception groups and chaining are in <strong>Exception Hierarchy &amp; Advanced Handling</strong>.

# Guaranteed cleanup: `finally` and `with`

```python filename:Python
from contextlib import suppress

events = []
def risky():
    try:
        events.append("open")
        raise RuntimeError("boom")
    finally:
        events.append("close")          # runs even though the error escapes

try:
    risky()
except RuntimeError:
    pass
print(events)                           # ['open', 'close']

with suppress(FileNotFoundError):       # ignore one specific, expected error
    open("definitely-missing.txt")
print("still running")                  # still running
```

> [!NOTE] Key point
>
> `with` is the idiomatic way to pair setup with cleanup (files, locks, connections). How it works and how to write your own is covered in <strong>Context Managers &amp; contextlib</strong>.

```question
What is the difference between else and finally in a try statement?

---

`else` runs only when the `try` block raised nothing — it's for the success path. `finally` runs no matter what (success, exception, `return`, `break`) — it's for cleanup.
```
