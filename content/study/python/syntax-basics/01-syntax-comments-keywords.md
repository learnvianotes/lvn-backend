---
id: 38e80eea-5bf3-757c-8453-072bb3bbf379
key: topic:python/syntax-basics
subject: python
topic: syntax-basics
title: Syntax, Comments & Keywords
slug: syntax-comments-keywords
order: 1
---

The rules of how Python code is <em>written</em>: indentation instead of braces, comments and docstrings, how lines continue, what you may name things, and the reserved keywords.

# Indentation is the block structure

Where C and Java use `{ }`, Python uses a colon `:` followed by an <strong>indented block</strong>. Every line in a block must use the same indentation — the convention is <strong>4 spaces</strong>.

```python filename:Python
def classify(n):
    if n < 0:
        return "negative"        # inside the if-block
    elif n == 0:
        return "zero"
    return "positive"            # back at the function-block level

print(classify(-3), classify(0), classify(7))   # negative zero positive
```

```python filename:Python
src = "def f():\nreturn 1\n"          # body not indented
try:
    compile(src, "<demo>", "exec")
except IndentationError as e:
    print(type(e).__name__, "-", e.msg)   # IndentationError - expected an indented block after function definition on line 1
```

> [!WARNING] Tabs vs spaces
>
> Mixing tabs and spaces raises `TabError` in Python 3. Configure your editor to insert 4 spaces when you press Tab.

# Comments &amp; docstrings

> [!NOTE] # comment
>
> Ignored by the interpreter. Explains <em>why</em> the code does something — the code already says <em>what</em>.

> [!NOTE] Docstring
>
> A string literal as the <strong>first statement</strong> of a module, class or function. Stored in `__doc__`, shown by `help()` and IDEs.

```python filename:Python
def area(r):
    """Return the area of a circle of radius r.

    Uses 3.14159 for pi; pass a float or int.
    """
    # the formula is pi * r squared
    return 3.14159 * r * r

print(area.__doc__.splitlines()[0])   # Return the area of a circle of radius r.
print(round(area(2), 2))              # 12.57
```

> [!NOTE] Key point
>
> Python has no block-comment syntax. Use several `#` lines. A bare triple-quoted string in the middle of code is <em>evaluated and thrown away</em> — it works as a comment but is not one.

# Statements vs expressions

> [!INFO]
>
> <strong>Expression</strong> — anything that produces a value: `2 + 3`, `len(xs)`, `x if c else y`, `lambda n: n * 2`. Expressions can appear inside other expressions.

> [!INFO]
>
> <strong>Statement</strong> — an instruction that does something: `x = 5`, `if`, `for`, `def`, `import`, `return`. A statement cannot be used where a value is expected.

```python filename:Python
x = 5                                   # assignment statement
y = (x * 2) + 1                         # the right side is an expression
print(y, (z := x + 1), z)               # 11 6 6   ← := is an assignment *expression*
print(eval("x * 10"))                   # 50       ← eval evaluates one expression
exec("w = x + 100")                     # exec runs statements
print(w)                                # 105
```

> [!NOTE] Key point
>
> That's why `lambda` bodies must be a single expression (no `=`, no `for`), and why `if x = 5:` is a syntax error — assignment is a statement.

# Long lines &amp; multiple statements

```python filename:Python
total = (1 + 2 +
         3 + 4)                # implicit continuation inside ( ) [ ] { }
fruits = [
    "apple",
    "banana",                  # a trailing comma is allowed — cleaner diffs
]
legacy = 1 + \
         2                     # explicit backslash continuation (avoid)
a = 1; b = 2                   # ; separates statements (discouraged)
print(total, len(fruits), legacy, a + b)   # 10 2 3 3
```

> [!TIP] Do
>
> Wrap long expressions in parentheses and break after an operator or comma.

> [!DANGER] Avoid
>
> Backslash continuations — a single trailing space after `\` becomes a syntax error.

# Names (identifiers)

| Rule / convention | Example |
| --- | --- |
| Letters, digits, `_`; can't start with a digit | `total_2` ✓ · `2total` ✗ |
| Case-sensitive | `count`, `Count` and `COUNT` are three names |
| Can't be a keyword | `class = 1` ✗ → `class_ = 1` ✓ |
| Unicode letters allowed | `π = 3.14159` works (but stick to ASCII in shared code) |
| `snake_case` | variables, functions, modules |
| `PascalCase` | classes |
| `UPPER_CASE` | constants (by convention only — nothing stops reassignment) |
| `_leading` | internal / private by convention |
| `__dunder__` | reserved for Python's special names |
| `_` | a throwaway value: `for _ in range(3)`; in the REPL it's the last result |

```python filename:Python
print("my_var".isidentifier(), "2cool".isidentifier())   # True False
π = 3.14159
print(round(2 * π, 2))                                    # 6.28
```

> [!WARNING] Watch out
>
> Don't shadow built-ins: `list = [1, 2]` or `id = 5` hides the built-in `list()` / `id()` for the rest of the scope, leading to confusing `TypeError: 'list' object is not callable`.

# Keywords &amp; soft keywords

Keywords are reserved words you can't use as names. <strong>Soft keywords</strong> (`match`, `case`, `type`, `_`) are keywords only in specific positions, so old code using `match` as a variable still works.

```python filename:Python
import keyword
print(len(keyword.kwlist))                                     # 35
print(keyword.iskeyword("class"), keyword.iskeyword("match"))  # True False
print(keyword.softkwlist)                                      # ['_', 'case', 'match', 'type']
match = "still a valid variable name"
print(match.split()[0])                                        # still
```

| Purpose | Keywords |
| --- | --- |
| Values | `True` `False` `None` |
| Logic &amp; tests | `and` `or` `not` `in` `is` |
| Branching | `if` `elif` `else` |
| Loops | `for` `while` `break` `continue` |
| Functions | `def` `return` `lambda` `yield` `global` `nonlocal` |
| Classes &amp; modules | `class` `import` `from` `as` |
| Errors &amp; resources | `try` `except` `finally` `raise` `assert` `with` |
| Async | `async` `await` |
| Misc | `pass` `del` |

# Placeholders: `pass` and `...`

```python filename:Python
def todo():
    pass                  # a statement that does nothing

class Config: ...         # Ellipsis — a common "fill in later" body

print(todo(), Config.__name__, ...)   # None Config Ellipsis
```

# Exploring from the REPL: `help`, `dir`, `type`

```python filename:Python
print(type(3.0).__name__)                             # float
print([n for n in dir(str) if n.startswith("st")])    # ['startswith', 'strip']
print(len.__doc__.splitlines()[0])                    # Return the number of items in a container.
```

```filename:REPL
>>> help(str.split)       # full documentation (q to quit)
>>> dir([])               # every attribute/method of a list
>>> 2 + 3
5
>>> _ * 10                # _ holds the last REPL result
50
```

```question
Why does Python use indentation instead of braces?

---

To make the visual structure <em>be</em> the actual structure — code that looks nested is nested. It removes a whole class of bugs (misleading indentation) and style debates, and keeps code readable.
```

```question
What is the difference between a comment and a docstring?

---

A comment (`#`) is discarded by the parser. A docstring is a real string object stored in the `__doc__` attribute of a module, class or function, so `help()`, IDEs and documentation tools can read it at runtime.
```

```question
Is match a keyword?

---

It's a <strong>soft keyword</strong>: it acts as a keyword only at the start of a `match` statement, so `match = 5` is still a legal assignment. The same applies to `case`, `type` and `_`.
```
