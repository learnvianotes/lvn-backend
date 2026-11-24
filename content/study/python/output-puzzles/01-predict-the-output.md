---
id: aa967bc1-3280-7dcd-9419-612a836b2636
key: topic:python/output-puzzles
subject: python
topic: output-puzzles
title: Predict the Output
slug: predict-the-output
order: 1
---

Short snippets interviewers love because the obvious answer is wrong. Predict first, then read the explanation — every output below was produced by running the code.

> [!NOTE] How to use this page
>
> Each puzzle tests one rule. When you get one wrong, go back to the topic it names — the rule matters more than the trivia.

# Mutability &amp; names

```question
Default argument shared between calls

---

`def append_to(x, target=[]):`<br>`    target.append(x)`<br>`    return target`<br><br>`print(append_to(1))        # [1]`<br>`print(append_to(2))        # [1, 2]`<br>`print(append_to(3, []))    # [3]`

The default list is created <strong>once</strong> when `def` runs and reused by every call that doesn't pass `target`. → <em>Functions &amp; Arguments</em>.
```

```question
Multiplying a nested list

---

`board = [[" "] * 2] * 2`<br>`board[0][0] = "X"`<br>`print(board)               # [['X', ' '], ['X', ' ']]`

`* 2` copies the <em>reference</em> to the inner list, so both rows are the same object. Use `[[" "] * 2 for _ in range(2)]`. → <em>Lists &amp; Tuples</em>.
```

```question
Augmented assignment on a tuple item

---

`t = ([1], 2)`<br>`try:`<br>`    t[0] += [3]`<br>`except TypeError as e:`<br>`    print(type(e).__name__)   # TypeError`<br>`print(t)                      # ([1, 3], 2)`

`t[0] += [3]` first extends the list in place (succeeds), then tries to store it back into the tuple (fails). The error is raised <strong>after</strong> the mutation. → <em>Identity, Mutability &amp; Copying</em>.
```

```question
Rebinding vs mutating a parameter

---

`def f(xs):`<br>`    xs.append(1)`<br>`    xs = [99]`<br>`    xs.append(2)`<br><br>`data = []`<br>`f(data)`<br>`print(data)                # [1]`

The first `append` mutates the caller's list. `xs = [99]` rebinds only the local name, so later changes don't reach the caller.
```

# Scope &amp; closures

```question
UnboundLocalError

---

`count = 10`<br>`def bump():`<br>`    try:`<br>`        count += 1`<br>`    except UnboundLocalError:`<br>`        return "unbound"`<br>`print(bump())              # unbound`

Assigning to `count` anywhere in the function makes it local for the <strong>whole</strong> function, so reading it first fails. Use `global count` (or better, return the new value). → <em>Scope &amp; Closures</em>.
```

```question
Closures in a loop

---

`adders = [lambda x: x + i for i in range(3)]`<br>`print([f(10) for f in adders])   # [12, 12, 12]`

All lambdas share the same `i`, read when they are called — after the loop left it at 2. Bind it early: `lambda x, i=i: x + i`.
```

```question
Class variable vs instance variable

---

`class Dog:`<br>`    tricks = []`<br>`    def add(self, t):`<br>`        self.tricks.append(t)`<br><br>`a, b = Dog(), Dog()`<br>`a.add("roll")`<br>`print(b.tricks)            # ['roll']`

`tricks` lives on the class and is shared by every instance. Create it in `__init__` instead. → <em>Classes &amp; Objects</em>.
```

# Operators &amp; values

```question
Chained comparisons and precedence

---

`print(1 < 2 == 2)          # True`<br>`print((1 < 2) == 2)        # False`<br>`print(-2 ** 2)             # -4`<br>`print(not 1 == 2)          # True`

`1 < 2 == 2` means `1 < 2 and 2 == 2`. `True == 2` is `False` because `True` is `1`. `**` binds tighter than unary minus. `not` has lower precedence than `==`. → <em>Operators &amp; Precedence</em>.
```

```question
Floats and rounding

---

`print(0.1 + 0.2 == 0.3)       # False`<br>`print(round(0.5), round(1.5), round(2.5))   # 0 2 2`<br>`print(-7 // 2, -7 % 2)        # -4 1`

Binary floats can't represent 0.1 exactly — compare with `math.isclose`. `round` uses banker's rounding (halves to even). `//` floors toward negative infinity and `%` takes the sign of the divisor. → <em>Numbers</em>.
```

```question
and / or return operands

---

`print(0 or [] or "x")      # x`<br>`print(3 and 0 and 5)       # 0`<br>`print(None or 0)           # 0`

`or` returns the first truthy operand (or the last one); `and` returns the first falsy operand (or the last one). They return objects, not booleans.
```

```question
True is an int

---

`d = {1: "int", True: "bool", 1.0: "float"}`<br>`print(d)                   # {1: 'float'}`<br>`print(sum([True, True, False]))   # 2`

`1 == True == 1.0` and they hash equally, so they are the <strong>same key</strong>: the first key object is kept and the value is overwritten twice.
```

# Iteration &amp; generators

```question
Exhausted iterators

---

`nums = map(lambda n: n * 2, [1, 2, 3])`<br>`print(list(nums))          # [2, 4, 6]`<br>`print(list(nums))          # []`<br>`z = zip("ab", [1, 2])`<br>`print(dict(z), dict(z))    # {'a': 1, 'b': 2} {}`

`map`, `filter`, `zip` and generators are one-shot iterators. Convert to a list once if you need several passes. → <em>Iterators &amp; Generators</em>.
```

```question
Modifying a list while iterating

---

`nums = [1, 2, 2, 3]`<br>`for n in nums:`<br>`    if n == 2:`<br>`        nums.remove(n)`<br>`print(nums)                # [1, 2, 3]`

Removing shifts later items left, so the loop's index skips the second `2`. Build a new list instead: `[n for n in nums if n != 2]`.
```

```question
Generator expression evaluation time

---

`xs = [1, 2, 3]`<br>`gen = (x * 10 for x in xs)`<br>`xs = [7, 8]`<br>`print(list(gen))           # [10, 20, 30]`

The first `for` source of a generator expression is evaluated <strong>immediately</strong>; everything else is lazy. Rebinding `xs` afterwards doesn't affect it.
```

# Exceptions &amp; finally

```question
finally runs even after return

---

`def f():`<br>`    try:`<br>`        return "try"`<br>`    finally:`<br>`        print("finally")   # finally`<br><br>`print(f())                 # try`

`finally` runs on the way out, before the caller receives the return value. (A `return` <em>inside</em> `finally` would override it and swallow exceptions — Python 3.14 warns about that.)
```

```question
The else clause of a loop

---

`for n in range(3):`<br>`    if n == 5:`<br>`        break`<br>`else:`<br>`    print("no break")      # no break`

A loop's `else` runs when the loop ends <strong>without</strong> `break` — think “no-break”, not “otherwise”.
```

```question
Which except catches it?

---

`try:`<br>`    {}["missing"]`<br>`except LookupError:`<br>`    print("LookupError")   # LookupError`<br>`except KeyError:`<br>`    print("KeyError")`

`except` clauses are tried top to bottom and match subclasses. `KeyError` is a subclass of `LookupError`, so the first clause wins — put specific exceptions first.
```

# Classes

```question
MRO in diamond inheritance

---

`class A:`<br>`    def who(self): return "A"`<br>`class B(A):`<br>`    def who(self): return "B" + super().who()`<br>`class C(A):`<br>`    def who(self): return "C" + super().who()`<br>`class D(B, C):`<br>`    pass`<br>`print(D().who())           # BCA`

`super()` follows the MRO `D → B → C → A`, so `B`'s `super()` calls `C`, not `A`. → <em>Inheritance, MRO &amp; super()</em>.
```

```question
\_\_eq\_\_ without \_\_hash\_\_

---

`class P:`<br>`    def __init__(self, x): self.x = x`<br>`    def __eq__(self, o): return self.x == o.x`<br>`print(P.__hash__)          # None`<br>`try:`<br>`    {P(1)}`<br>`except TypeError as e:`<br>`    print(type(e).__name__)   # TypeError`

Defining `__eq__` sets `__hash__` to `None`. Add a `__hash__` based on the same fields (and keep them immutable), or use `@dataclass(frozen=True)`.
```
