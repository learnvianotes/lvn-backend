---
id: 34affb0f-a9e7-7660-baa6-afc51ed4ef1d
key: topic:python/testing
subject: python
topic: testing
title: "Testing: unittest & pytest"
slug: testing-unittest-pytest
order: 1
---

Automated tests prove your code works today and keep it working tomorrow. Python ships `unittest` and `doctest`; most projects use `pytest` for its plain `assert`s and fixtures.

# Why and what to test

> [!NOTE] Unit tests
>
> One function or class in isolation. Fast (milliseconds) — the bulk of your suite.

> [!NOTE] Integration tests
>
> Several parts together: your code + a real database, file system or HTTP layer.

> [!NOTE] End-to-end tests
>
> The whole system as a user sees it. Slow and brittle — keep few of them.

> [!NOTE] Regression tests
>
> Every fixed bug gets a test that failed before the fix, so it can't come back.

A good test follows <strong>Arrange → Act → Assert</strong>: set up inputs, call the code once, check the result.

# assert — the building block

```python filename:Python
def slugify(title: str) -> str:
    return "-".join(title.lower().split())

# Arrange, Act, Assert — a test is just code that raises if something is wrong
assert slugify("Hello World") == "hello-world"
assert slugify("  Python   Notes ") == "python-notes"
try:
    assert slugify("A B") == "a_b", "separator should be a hyphen"
except AssertionError as e:
    print("failed:", e)             # failed: separator should be a hyphen
```

> [!WARNING] Watch out
>
> `assert` statements are removed when Python runs with `-O`. Use them in tests and for internal sanity checks — never to validate user input in production code.

# unittest — the built-in framework

```python filename:Python
import io, unittest

class Stack:
    def __init__(self):
        self._items = []
    def push(self, x):
        self._items.append(x)
    def pop(self):
        if not self._items:
            raise IndexError("pop from empty stack")
        return self._items.pop()

class StackTest(unittest.TestCase):
    def setUp(self):                         # runs before EACH test method
        self.s = Stack()

    def test_push_then_pop(self):
        self.s.push(1)
        self.s.push(2)
        self.assertEqual(self.s.pop(), 2)

    def test_pop_empty_raises(self):
        with self.assertRaises(IndexError):
            self.s.pop()

    def test_many_values(self):
        for value in [0, "x", None]:
            with self.subTest(value=value):  # each case reported separately
                self.s.push(value)
                self.assertIs(self.s.pop(), value)

suite = unittest.defaultTestLoader.loadTestsFromTestCase(StackTest)
result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(suite)
print(result.testsRun, len(result.failures), len(result.errors))   # 3 0 0
print(result.wasSuccessful())                                        # True
```

| Assertion | Checks |
| --- | --- |
| `assertEqual(a, b)` / `assertNotEqual` | `a == b` |
| `assertTrue(x)` / `assertFalse(x)` | Truthiness |
| `assertIs(a, b)` / `assertIsNone(x)` | Identity |
| `assertIn(a, b)` | Membership |
| `assertRaises(E)` | The block raises `E` (use as a context manager) |
| `assertAlmostEqual(a, b, places=7)` | Floats close enough |
| `assertCountEqual(a, b)` | Same items, any order |

> [!NOTE] Key point
>
> `setUp`/`tearDown` run around every test; `setUpClass`/`tearDownClass` once per class. Test methods must start with `test`. Run everything with `python -m unittest discover`.

# pytest — less boilerplate

```python filename:Python
# test_cart.py
import pytest
from shop.cart import Cart

@pytest.fixture
def cart():                                   # fresh object for every test that asks for it
    c = Cart()
    c.add("pen", price=10, qty=2)
    return c

def test_total(cart):
    assert cart.total() == 20                 # plain assert — pytest shows both sides on failure

@pytest.mark.parametrize("qty, expected", [(1, 10), (3, 30), (0, 0)])
def test_line_total(qty, expected):
    c = Cart()
    c.add("pen", price=10, qty=qty)
    assert c.total() == expected

def test_negative_qty_rejected():
    with pytest.raises(ValueError, match="qty"):
        Cart().add("pen", price=10, qty=-1)

def test_export(cart, tmp_path):              # built-in fixture: a fresh temp directory
    path = tmp_path / "cart.json"
    cart.save(path)
    assert path.exists()
```

```filename:Terminal
$ pip install pytest
$ pytest                       # finds test_*.py files and test_* functions
$ pytest -q -k "total"         # quiet, only tests whose name matches
$ pytest -x --lf               # stop at first failure; rerun last failures
$ pytest --cov=shop            # coverage report (pytest-cov plugin)
```

```text filename:pytest%20output
============================= test session starts ==============================
collected 6 items

test_cart.py ......                                                      [100%]

============================== 6 passed in 0.02s ===============================
```

|  | `unittest` | `pytest` |
| --- | --- | --- |
| Install | Built in | `pip install pytest` |
| Style | Classes + `self.assertX` methods | Plain functions + `assert` |
| Setup | `setUp` / `tearDown` | Fixtures, injected by name, with scopes |
| Parametrise | `subTest` | `@pytest.mark.parametrize` |
| Runs the other's tests? | No | Yes — pytest runs unittest suites too |

# doctest — examples that are tests

```python filename:Python
import doctest, io

def median(xs):
    """Return the median of a non-empty list.

    >>> median([3, 1, 2])
    2
    >>> median([4, 1, 3, 2])
    2.5
    """
    s = sorted(xs)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2

runner = doctest.DocTestRunner()
for test in doctest.DocTestFinder().find(median, globs={"median": median}):
    runner.run(test, out=io.StringIO().write)
print(runner.tries, runner.failures)       # 2 0
```

```filename:Terminal
$ python -m doctest -v stats.py     # run every docstring example in a module
$ pytest --doctest-modules          # or let pytest collect them
```

# Coverage &amp; the TDD loop

1. <strong>Red</strong>

   Write a small failing test for the next bit of behaviour.

2. <strong>Green</strong>

   Write the simplest code that makes it pass.

3. <strong>Refactor</strong>

   Clean up with the tests as a safety net; rerun them.

> [!NOTE] Key point
>
> Coverage (`coverage run -m pytest && coverage report`) shows which lines never ran. High coverage doesn't prove correctness, but <strong>uncovered code is definitely untested</strong>.

> [!TIP] Do
>
> Keep tests fast, independent and deterministic; one behaviour per test; descriptive names like `test_pop_empty_raises`.

> [!DANGER] Avoid
>
> Tests that depend on each other's order, the current time, the network or random data without a fixed seed.

```question
What is a fixture in pytest?

---

A function decorated with `@pytest.fixture` that prepares something a test needs (an object, a temp directory, a DB connection). Tests receive it by naming it as a parameter. Fixtures can `yield` to run teardown and have scopes (`function`, `module`, `session`).
```

```question
unittest or pytest?

---

pytest for most projects: less boilerplate, better failure output, fixtures and a large plugin ecosystem — and it runs existing unittest tests. unittest when you can't add dependencies.
```

```question
How do you test code that raises an exception?

---

`with pytest.raises(ValueError, match="..."):` or `with self.assertRaises(ValueError):` around the call. The test fails if the exception is <em>not</em> raised.
```
