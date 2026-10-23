---
id: 7b0a7772-845b-7e61-8d18-e7a8da307d88
key: topic:python/exceptions-advanced
subject: python
topic: exceptions-advanced
title: Exception Hierarchy & Advanced Handling
slug: exception-hierarchy-advanced-handling
order: 1
---

Beyond `try`/`except`: the full class tree, designing your own error hierarchy, chaining, notes, exception groups, warnings and the patterns (EAFP, retry) that production code relies on.

# The class tree

```text filename:Built-in%20exception%20hierarchy%20(abridged)
BaseException
├── SystemExit              ← sys.exit()
├── KeyboardInterrupt       ← Ctrl-C
├── GeneratorExit           ← generator.close()
├── BaseExceptionGroup
└── Exception               ← everything you normally catch
    ├── ArithmeticError     → ZeroDivisionError, OverflowError
    ├── LookupError         → KeyError, IndexError
    ├── OSError             → FileNotFoundError, PermissionError, TimeoutError, ConnectionError…
    ├── ValueError          → UnicodeDecodeError…
    ├── TypeError, AttributeError, NameError, ImportError (→ ModuleNotFoundError)
    ├── RuntimeError        → RecursionError, NotImplementedError
    ├── StopIteration, StopAsyncIteration
    ├── ExceptionGroup
    └── Warning             → DeprecationWarning, UserWarning, SyntaxWarning…
```

```python filename:Python
print(issubclass(KeyboardInterrupt, Exception))       # False
print(issubclass(KeyboardInterrupt, BaseException))   # True
print(issubclass(KeyError, LookupError), issubclass(ZeroDivisionError, ArithmeticError))   # True True
print([c.__name__ for c in FileNotFoundError.__mro__])
# ['FileNotFoundError', 'OSError', 'Exception', 'BaseException', 'object']
```

> [!NOTE] Key point
>
> `except Exception` deliberately does <strong>not</strong> catch `SystemExit`, `KeyboardInterrupt` or `GeneratorExit` — those mean “stop now”, and swallowing them makes a program impossible to quit. A bare `except:` catches `BaseException`, which is why it's banned in good code.

```python filename:Python
import sys
try:
    sys.exit(2)                    # sys.exit just raises SystemExit
except SystemExit as e:
    print("exit code", e.code)     # exit code 2
```

# Designing a custom hierarchy

A library should raise its <strong>own</strong> base exception, with specific subclasses underneath. Callers can then catch everything from your library in one clause, or one precise failure.

```python filename:Python
class PaymentError(Exception):
    """Base class for every error this library raises."""

class CardDeclined(PaymentError):
    def __init__(self, reason):
        super().__init__(f"card declined ({reason})")
        self.reason = reason

class GatewayTimeout(PaymentError):
    pass

def charge(amount):
    if amount < 0:
        raise ValueError("amount must be >= 0")     # caller bug → a built-in error
    if amount > 1000:
        raise CardDeclined("limit")
    return "ok"

try:
    charge(5000)
except PaymentError as e:                           # the whole family
    print(type(e).__name__, "|", e, "|", e.reason)  # CardDeclined | card declined (limit) | limit
```

> [!NOTE] Inherit from Exception
>
> Never from `BaseException` — your errors should be catchable with `except Exception`.

> [!NOTE] Name ends in Error
>
> `ConfigError`, `RateLimitError` — the PEP 8 convention.

> [!NOTE] Carry data
>
> Store useful fields (`self.status`, `self.retry_after`) instead of making callers parse the message.

> [!NOTE] Reuse built-ins for caller bugs
>
> Wrong argument type → `TypeError`; bad value → `ValueError`. Custom classes are for <em>domain</em> failures.

# Catching several types &amp; re-raising

```python filename:Python
def to_int(x):
    try:
        return int(x)
    except (TypeError, ValueError) as e:     # a tuple catches any of them
        return type(e).__name__

print(to_int("7"), to_int("x"), to_int(None))   # 7 ValueError TypeError

log = []
def load(key):
    try:
        return {"a": 1}[key]
    except KeyError:
        log.append(f"missing {key}")          # do something useful…
        raise                                 # …then re-raise the SAME exception

try:
    load("b")
except KeyError as e:
    print(repr(e), log)                       # KeyError('b') ['missing b']
```

> [!WARNING] Watch out
>
> `except` clauses are tried top to bottom and the first match wins — put <strong>subclasses before base classes</strong>. `except OSError:` above `except FileNotFoundError:` makes the second one unreachable.

```python filename:Python
try:
    1 / 0
except ZeroDivisionError as e:
    saved = e
print("e" in dir(), type(saved).__name__)    # False ZeroDivisionError
```

> [!NOTE] Key point
>
> The name bound by `except … as e` is <strong>deleted</strong> when the block ends (to break a reference cycle through the traceback). Assign it to another name if you need it later.

# Chaining: `__context__` vs `__cause__`

```python filename:Python
def implicit():
    try:
        1 / 0
    except ZeroDivisionError:
        raise ValueError("bad ratio")              # error while handling another

def explicit():
    try:
        1 / 0
    except ZeroDivisionError as e:
        raise ValueError("bad ratio") from e       # "this caused that"

def hidden():
    try:
        1 / 0
    except ZeroDivisionError:
        raise ValueError("bad ratio") from None    # hide the internal detail

def inspect(f):
    try:
        f()
    except ValueError as e:
        return type(e.__cause__).__name__, type(e.__context__).__name__, e.__suppress_context__

print(inspect(implicit))   # ('NoneType', 'ZeroDivisionError', False)
print(inspect(explicit))   # ('ZeroDivisionError', 'ZeroDivisionError', True)
print(inspect(hidden))     # ('NoneType', 'ZeroDivisionError', True)
```

| You write | Attribute set | Traceback says |
| --- | --- | --- |
| `raise New()` inside `except` | `__context__` | “During handling of the above exception, another exception occurred” |
| `raise New() from e` | `__cause__` (+ `__context__`) | “The above exception was the direct cause of the following exception” |
| `raise New() from None` | `__suppress_context__ = True` | Only the new exception |

# Adding context: `add_note` (3.11+)

```python filename:Python
import traceback

def parse_row(n, text):
    try:
        return int(text)
    except ValueError as e:
        e.add_note(f"while parsing row {n} of users.csv")
        raise

try:
    parse_row(3, "abc")
except ValueError as e:
    print(e.__notes__)                                       # ['while parsing row 3 of users.csv']
    print(traceback.format_exception_only(e)[-1].strip())    # while parsing row 3 of users.csv
```

Notes are printed under the error message in tracebacks — a lightweight way to add context without wrapping the exception in a new type.

# ExceptionGroup and `except*` (3.11+)

When several independent operations fail at once (parallel tasks, validating many fields), raise them <strong>together</strong> as an `ExceptionGroup`. `except*` handles each type inside the group; several `except*` clauses can run for one group.

```python filename:Python
def validate(user):
    errors = []
    if not user.get("name"):
        errors.append(ValueError("name is required"))
    if not isinstance(user.get("age"), int):
        errors.append(TypeError("age must be an int"))
    if "@" not in user.get("email", ""):
        errors.append(ValueError("email is invalid"))
    if errors:
        raise ExceptionGroup("invalid user", errors)

try:
    validate({"name": "", "age": "x", "email": "nope"})
except* ValueError as eg:
    print("values:", [str(e) for e in eg.exceptions])   # values: ['name is required', 'email is invalid']
except* TypeError as eg:
    print("types:", [str(e) for e in eg.exceptions])    # types: ['age must be an int']
```

```python filename:Python
eg = ExceptionGroup("batch", [ValueError(1), KeyError(2), ValueError(3)])
values, rest = eg.split(ValueError)
print(len(values.exceptions), [type(e).__name__ for e in rest.exceptions])   # 2 ['KeyError']
```

> [!NOTE] Key point
>
> `asyncio.TaskGroup` raises an `ExceptionGroup` when tasks fail, so `except*` is the natural way to handle concurrent failures.

# Inspecting tracebacks

```python filename:Python
import traceback

def inner():
    return 1 / 0
def outer():
    return inner()

try:
    outer()
except ZeroDivisionError as e:
    frames = traceback.extract_tb(e.__traceback__)
    print([f.name for f in frames])                          # ['<module>', 'outer', 'inner']
    print(traceback.format_exception_only(e)[0].strip())     # ZeroDivisionError: division by zero
```

`traceback.format_exc()` returns the full traceback as a string (for logging); `logger.exception("msg")` does the same automatically inside an `except` block.

# `assert` — for invariants, not validation

```python filename:Python
def mean(xs):
    assert xs, "mean() of an empty list"     # a developer's sanity check
    return sum(xs) / len(xs)

try:
    mean([])
except AssertionError as e:
    print(e)                                 # mean() of an empty list
```

> [!WARNING] Watch out
>
> `python -O` strips every `assert`. Never use it to check user input, permissions or anything that must hold in production — `raise ValueError` instead. And `assert (cond, "msg")` is <strong>always true</strong> (a non-empty tuple); Python emits a `SyntaxWarning` for it.

# Warnings

A warning reports something suspicious without stopping the program — most often a deprecation. Warnings are printed once per location by default and can be filtered or turned into errors.

```python filename:Python
import warnings

def old_api():
    warnings.warn("old_api() is deprecated; use new_api()", DeprecationWarning, stacklevel=2)
    return 42

with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    result = old_api()

print(result, caught[0].category.__name__)   # 42 DeprecationWarning
print(caught[0].message)                     # old_api() is deprecated; use new_api()
```

| Filter action | Effect |
| --- | --- |
| `"default"` | Print the first occurrence per location |
| `"always"` | Print every occurrence |
| `"ignore"` | Never print |
| `"error"` | Turn the warning into an exception — great in test suites (`python -W error`, `pytest -W error`) |

# `finally` beats `return`

```python filename:Python
def f():
    try:
        return "from try"
    finally:
        print("finally runs first")   # finally runs first

print(f())                            # from try
```

```python filename:Python
import warnings

# A return inside finally silently DISCARDS an in-flight exception.
# Python 3.14 warns about it at compile time (PEP 765); silenced here to show the behaviour.
src = """
def swallow():
    try:
        raise ValueError("lost!")
    finally:
        return "finally wins"
"""
with warnings.catch_warnings():
    warnings.simplefilter("ignore", SyntaxWarning)
    ns = {}
    exec(src, ns)
print(ns["swallow"]())      # finally wins
```

> [!WARNING] Watch out
>
> Never `return`, `break` or `continue` out of a `finally` block — the exception being propagated vanishes without a trace.

# EAFP, cost and the retry pattern

Setting up a `try` block is essentially free in Python 3.11+ (“zero-cost” exceptions); <em>raising</em> costs a few microseconds. So EAFP — just try and handle failure — is idiomatic when failure is the exception, not the rule.

```python filename:Python
def get_port(cfg):
    try:
        return int(cfg["port"])
    except (KeyError, ValueError):
        return 8080

print(get_port({"port": "5432"}), get_port({}), get_port({"port": "x"}))   # 5432 8080 8080
```

```python filename:Python%20%E2%80%94%20retry%20with%20exponential%20backoff
import time

def retry(fn, attempts=3, base_delay=0.001, retry_on=(ConnectionError, TimeoutError)):
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except retry_on:
            if attempt == attempts:
                raise                                    # out of attempts: propagate
            time.sleep(base_delay * 2 ** (attempt - 1))  # exponential backoff

calls = []
def flaky():
    calls.append(1)
    if len(calls) < 3:
        raise ConnectionError("connection reset")
    return "connected"

print(retry(flaky), len(calls))   # connected 3
```

> [!TIP] Do
>
> Retry only <em>transient</em> errors (timeouts, connection resets), cap the attempts, back off exponentially (add jitter in production) and log each failure.

> [!DANGER] Avoid
>
> Retrying everything — a `ValueError` from bad input will fail identically every time.

# Interview questions

```question
Why shouldn't you write except: or except BaseException:?

---

They catch `KeyboardInterrupt` and `SystemExit` too, so Ctrl-C and `sys.exit()` stop working, and they hide real bugs. Catch `Exception` at most (e.g. at a top-level request handler that logs and continues), and specific types everywhere else.
```

```question
What is the difference between raise X from e and raise X from None?

---

`from e` records `e` as the explicit cause (`__cause__`) and the traceback shows both, linked by “direct cause”. `from None` suppresses the context so only the new exception is shown — useful when the original is an implementation detail.
```

```question
What does except\* do?

---

It matches exceptions <em>inside</em> an `ExceptionGroup`. Each `except*` clause receives a sub-group of the matching exceptions; multiple clauses can run for the same group, and any unmatched exceptions are re-raised in a new group.
```

```question
When would you define a custom exception?

---

When callers need to react to a specific domain failure (`CardDeclined`, `RateLimited`) differently from others. Give the library one base class so callers can catch all of its errors, and attach structured data as attributes.
```
