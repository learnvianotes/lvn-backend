---
id: 233484ea-9ed5-773c-bbf9-3717d35428ef
key: topic:c/undefined-behaviour
subject: c
topic: undefined-behaviour
title: Undefined Behaviour Catalogue
slug: undefined-behaviour-catalogue
order: 1
---

<em>Undefined behaviour</em> (UB) means the standard places <strong>no requirements</strong> on what happens. The program may crash, print garbage, work by luck — or be “optimised” in surprising ways because the compiler assumes UB never happens.

| Kind | Meaning | Example |
| --- | --- | --- |
| <strong>Undefined</strong> | Anything can happen; the whole program is invalid | Signed overflow, out-of-bounds access, NULL dereference |
| <strong>Unspecified</strong> | One of several valid outcomes, not documented | Order of evaluating function arguments |
| <strong>Implementation-defined</strong> | Documented choice of the compiler/platform | `sizeof(int)`, signedness of `char`, right shift of negatives |
| <strong>Locale-specific</strong> | Depends on the current locale | `isalpha` for non-ASCII bytes |

# The catalogue

| Undefined behaviour | Example |
| --- | --- |
| Signed integer overflow | `INT_MAX + 1` |
| Division or modulo by zero; `INT_MIN / -1` | `x / 0` |
| Shift by negative or ≥ width; left-shift of negative | `1 << 32`, `-1 << 1` |
| Array access out of bounds (even reading) | `a[5]` for `int a[5]` |
| Pointer arithmetic beyond one-past-the-end | `p + n + 1` |
| Dereferencing NULL, dangling or misaligned pointers | `*(int *)NULL` |
| Reading an uninitialised automatic variable | `int x; printf("%d", x);` |
| Modifying a variable twice between sequence points | `i = i++;` |
| Modifying a string literal or a `const` object | `char *s = "hi"; s[0] = 'H';` |
| Strict-aliasing violation | Reading a `float` through an `int *` |
| Use after free, double free | see Memory Bugs |
| Falling off a non-void function whose value is used | missing `return` |
| Mismatched `printf` format and argument | `printf("%d", 3.0)` |
| Converting an out-of-range float to an integer | `(int)1e20` |
| Data race between threads | two threads write one variable without sync |

# Signed overflow

```c filename:C
#include <stdio.h>
#include <limits.h>

int main(void) {
    int x = INT_MAX;
    x = x + 1;                      /* UB — not guaranteed to wrap to INT_MIN */
    printf("%d\n", x);
    return 0;
}
```

```text filename:UBSan
main.c:6:11: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
```

Because overflow “cannot happen”, an optimiser may turn `if (x + 1 > x)` into `if (1)` and `for (int i = 0; i <= n; i++)` into a loop that assumes `n < INT_MAX`. Check <em>before</em> the operation:

```c filename:C
#include <stdio.h>
#include <limits.h>
#include <stdbool.h>

bool safe_add(int a, int b, int *out) {
    if ((b > 0 && a > INT_MAX - b) || (b < 0 && a < INT_MIN - b)) return false;
    *out = a + b;
    return true;
}

int main(void) {
    int r;
    printf("%d\n", safe_add(INT_MAX, 1, &r));
    if (safe_add(40, 2, &r)) printf("%d\n", r);
    printf("%d\n", __builtin_add_overflow(INT_MAX, 1, &r));   /* GCC/Clang builtin (C23: ckd_add) */
    return 0;
}
```

```text filename:Output
0
42
1
```

# Division by zero

```c filename:C
#include <stdio.h>

int divide(int a, int b) { return a / b; }

int main(void) {
    printf("%d\n", divide(10, 0));
    return 0;
}
```

```text filename:UBSan
main.c:3:37: runtime error: division by zero
```

# Strict aliasing &amp; type punning

The compiler assumes pointers to different types don’t point to the same memory (except `char *`). To reinterpret bytes, use `memcpy` — it compiles to a single move:

```c filename:C
#include <stdio.h>
#include <string.h>
#include <stdint.h>

int main(void) {
    float f = 1.0f;
    uint32_t bits;
    memcpy(&bits, &f, sizeof bits);           /* well-defined type punning */
    printf("0x%08X\n", (unsigned)bits);       /* IEEE 754: sign 0, exponent 127, mantissa 0 */
    return 0;
}
```

```text filename:Output
0x3F800000
```

# Living with UB

- Compile with `-Wall -Wextra` and fix every warning.
- Test with `-fsanitize=undefined,address` (and `thread` for concurrency).
- Use unsigned types for bit manipulation and wrap-around arithmetic.
- Validate inputs <em>before</em> arithmetic, indexing and shifting.
- `-fwrapv` makes signed overflow wrap (GCC/Clang) — a band-aid, not a fix.

```question
What is undefined behaviour and why does C have it?

---

Behaviour for which the standard imposes no requirements. It exists so C can map directly onto very different hardware and so compilers can optimise aggressively without inserting checks (bounds, overflow, null) — the programmer promises these situations never occur.
```

```question
Why can undefined behaviour 'time travel'?

---

Because a program that executes UB has no defined meaning at all, the optimiser may assume the UB path is never taken and reason backwards — e.g. dereferencing `p` before a `if (p == NULL)` check lets the compiler delete the check, since `p` “must” be non-null.
```

```question
Is i = i++ undefined?

---

Yes (in C). `i` is modified twice without an intervening sequence point — once by the assignment and once by the post-increment. C11 describes this as two <em>unsequenced</em> side effects on the same object, which is undefined.
```
