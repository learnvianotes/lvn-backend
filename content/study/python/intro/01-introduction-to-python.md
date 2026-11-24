---
id: 528b998c-da11-7383-97d8-c67c23836c67
key: topic:python/intro
subject: python
topic: intro
title: Introduction to Python
slug: introduction-to-python
order: 1
---

A high-level, interpreted, dynamically typed language that favours readability — the most common language for interviews, scripting, data and AI.

> [!INFO]
>
> <strong>Python</strong> — a general-purpose language where <em>code is compiled to bytecode and run by a virtual machine</em> (CPython). You write less code per idea than in C++ or Java, at the cost of raw speed.

# Why Python?

> [!NOTE] Readable
>
> Indentation is syntax, so code looks like pseudocode. Ideal for interviews — the interviewer reads your logic, not boilerplate.

> [!NOTE] Batteries included
>
> A huge standard library: `collections`, `itertools`, `heapq`, `bisect`, `functools`, `json`, `re`, `pathlib`…

> [!NOTE] Dynamic typing
>
> Types belong to <em>values</em>, not variables. A name can point to an `int` now and a `str` later.

> [!NOTE] Everywhere
>
> Web back ends (Django, FastAPI), automation, data science (pandas, NumPy), ML (PyTorch), scripting.

# How Python runs your code

1. <strong>Source</strong>

   You write `app.py` — plain text.

2. <strong>Compile to bytecode</strong>

   CPython parses it and compiles it to bytecode (cached as `__pycache__/*.pyc`).

3. <strong>Run on the PVM</strong>

   The Python Virtual Machine executes the bytecode instruction by instruction — that is the “interpreted” part.

| Implementation | What it is |
| --- | --- |
| <strong>CPython</strong> | The reference implementation, written in C. What you get from python.org. Has the GIL. |
| <strong>PyPy</strong> | JIT-compiled — often several times faster for long-running pure-Python code. |
| <strong>Jython / IronPython</strong> | Python on the JVM / .NET (rarely used today). |

# Your first program

```python filename:Python
name = "Python"
version = 3
print(f"Hello, {name} {version}!")   # Hello, Python 3!
print(type(name), type(version))    # <class 'str'> <class 'int'>
```

```filename:Terminal
$ python3 --version          # check the installed version
$ python3 app.py             # run a file
$ python3                    # interactive REPL (exit with Ctrl-D)
$ python3 -m venv .venv      # create an isolated environment
```

# Style: PEP 8 and the Zen

- 4 spaces per indent level, never tabs.
- `snake_case` for variables and functions, `PascalCase` for classes, `UPPER_CASE` for constants.
- Lines around 79–99 characters; one statement per line.
- Run `import this` to read <em>The Zen of Python</em> — “Readability counts.”, “Explicit is better than implicit.”

> [!NOTE] Version
>
> Python 2 reached end-of-life in 2020. Everything in these notes is Python 3 (3.10+ for `match`).
