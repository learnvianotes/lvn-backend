---
id: 68e91b04-0d7c-783b-8059-f9f0eba5c6c1
key: topic:python/code-quality
subject: python
topic: code-quality
title: PEP 8, Linters & Formatters
slug: pep-8-linters-formatters
order: 1
---

Consistent style makes code easier to read and review. PEP 8 defines the conventions; formatters and linters apply and enforce them automatically so humans can review logic instead of whitespace.

# PEP 8 essentials

| Topic | Convention |
| --- | --- |
| Indentation | 4 spaces, never tabs |
| Line length | 79 in PEP 8; most teams use 88 (Black/Ruff) or 100 |
| Functions, variables, modules | `snake_case` |
| Classes, exceptions, type variables | `PascalCase` (`HttpError`, `UserProfile`) |
| Constants | `UPPER_SNAKE_CASE` at module level |
| Internal names | `_leading_underscore` |
| Blank lines | 2 around top-level functions/classes, 1 between methods |
| Imports | One per line, at the top: standard library → third-party → local, each group separated |
| Whitespace | `x = f(a, b)`, `items[1:2]`, no spaces inside brackets, `def f(x=1)` without spaces around `=` |
| Comparisons | `is None`, `if not items:`, `isinstance(x, int)` instead of `type(x) == int` |

```python filename:Python
import os                                  # 1. standard library
from collections import Counter

# import requests                          # 2. third-party
# from .models import User                 # 3. local package

MAX_RETRIES = 3


class RetryPolicy:
    """Decide whether a failed request should be retried."""

    def __init__(self, max_retries: int = MAX_RETRIES) -> None:
        self.max_retries = max_retries

    def should_retry(self, attempt: int, status: int) -> bool:
        return attempt < self.max_retries and status >= 500


policy = RetryPolicy()
print(policy.should_retry(1, 503), policy.should_retry(3, 503))   # True False
```

# Docstrings (PEP 257)

```python filename:Python
def transfer(src: str, dst: str, amount: float) -> str:
    """Move money between two accounts.

    Args:
        src: Account id to debit.
        dst: Account id to credit.
        amount: Positive amount in rupees.

    Returns:
        The transaction id.

    Raises:
        ValueError: If amount is not positive.
    """
    if amount <= 0:
        raise ValueError("amount must be positive")
    return f"txn:{src}->{dst}:{amount}"

print(transfer.__doc__.splitlines()[0])      # Move money between two accounts.
print(transfer("a1", "b2", 50))              # txn:a1->b2:50
```

> [!NOTE] Key point
>
> A one-line summary in the imperative mood, a blank line, then details. Google style (above) and NumPy style are both common — pick one per project. Tools like Sphinx and mkdocstrings turn them into documentation.

# The tools

| Tool | Role | Notes |
| --- | --- | --- |
| <strong>Ruff</strong> | Linter + formatter | Written in Rust, very fast; replaces Flake8, isort, pyupgrade and most plugins |
| <strong>Black</strong> | Formatter | “Uncompromising” — one style, no debates; Ruff's formatter is compatible |
| isort | Import sorter | Built into Ruff (`I` rules) |
| Flake8 / Pylint | Linters | Older; Pylint is slower but checks more design issues |
| <strong>mypy</strong> / pyright | Type checkers | Catch type errors statically — see <em>Type Hints &amp; mypy</em> |
| <strong>pre-commit</strong> | Git hook runner | Runs the tools on every commit |
| Bandit | Security linter | Flags `eval`, `shell=True`, weak hashes… |

```filename:Terminal
$ pip install ruff
$ ruff check .              # lint
$ ruff check . --fix        # auto-fix what's safe (unused imports, sorting…)
$ ruff format .             # format (Black-compatible)
```

```text filename:ruff%20check%20output
app.py:1:8: F401 [*] `os` imported but unused
app.py:14:5: E722 Do not use bare `except`
app.py:20:15: B006 Do not use mutable data structures for argument defaults
Found 3 errors.
[*] 1 fixable with the `--fix` option.
```

# Configuration in pyproject.toml

```python filename:pyproject.toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM"]   # pycodestyle, pyflakes, isort, bugbear, pyupgrade, simplify

[tool.mypy]
strict = true
```

```filename:pre-commit
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

$ pip install pre-commit && pre-commit install   # now runs on every git commit
```

# The Zen of Python

```python filename:Python
import codecs, contextlib, io

with contextlib.redirect_stdout(io.StringIO()):
    import this                           # "import this" prints the poem on first import
zen = codecs.decode(this.s, "rot13").splitlines()
print(zen[2])                             # Beautiful is better than ugly.
print(zen[3])                             # Explicit is better than implicit.
print(zen[8])                             # Readability counts.
```

# Code-review checklist

- Names say what things are; no single letters except loop indices and math.
- Functions do one thing, are short, and return early instead of nesting deeply.
- No bare `except:`, no mutable default arguments, no unused imports or variables.
- Public functions have type hints and a docstring.
- Resources are opened with `with`; no secrets in code or logs.
- New behaviour has tests; the formatter, linter and type checker pass in CI.

```question
What is PEP 8?

---

The official style guide for Python code: naming, indentation, line length, whitespace, imports and comments. Its goal is readability and consistency; it explicitly says consistency within a project matters more than following it to the letter.
```

```question
Linter vs formatter?

---

A formatter rewrites layout (spacing, line breaks, quotes) without changing meaning — Black, `ruff format`. A linter analyses code for likely bugs and style violations (unused imports, bare except, mutable defaults) and reports or fixes them — Ruff, Flake8, Pylint.
```
