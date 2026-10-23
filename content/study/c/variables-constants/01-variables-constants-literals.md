---
id: 70bb74dd-90cf-709a-956d-85d502af8bf4
key: topic:c/variables-constants
subject: c
topic: variables-constants
title: Variables, Constants & Literals
slug: variables-constants-literals
order: 1
---

A variable is a named, typed region of memory. C gives you three kinds of constants: literals, `const` objects, and `#define` / `enum` names.

# Declaring and initialising

```c filename:C
#include <stdio.h>

int main(void) {
    int a = 10, b = 20;        /* several on one line */
    double ratio = a / (double)b;
    char grade = 'A';
    int uninit;                /* indeterminate value — do not read it! */
    uninit = 5;                /* assign before use */
    printf("%d %d %.2f %c %d\n", a, b, ratio, grade, uninit);
    return 0;
}
```

```text filename:Output
10 20 0.50 A 5
```

> [!WARNING] Watch out
>
> Local (automatic) variables are <strong>not</strong> initialised — their initial value is garbage and reading it is undefined behaviour. Globals and `static` variables are zero-initialised.

# Identifier rules

- Letters, digits and `_`; cannot start with a digit; case-sensitive (`count` ≠ `Count`).
- Cannot be a keyword (`int`, `return`, `static`, `sizeof`…).
- Names starting with `_` + uppercase letter or `__` are <em>reserved</em> for the implementation — don’t use them.
- Convention: `snake_case` for variables and functions, `UPPER_CASE` for macros and constants.

# Literals

| Literal | Type | Example |
| --- | --- | --- |
| Decimal / octal / hex integer | `int` (or larger if needed) | `42`, `052`, `0x2A` |
| Suffixes `u`, `l`, `ll` | `unsigned`, `long`, `long long` | `42u`, `42L`, `42ULL` |
| Floating | `double` by default | `3.14`, `1e-3`, `2.5f` (float), `2.5L` (long double) |
| Character | `int` (!) | `'A'`, `'\n'`, `'\0'`, `'\x41'` |
| String | `char[N]` (array incl. NUL) | `"hi"` has 3 bytes |
| Compound (C99) | unnamed object | `(int[]){1, 2, 3}` |

```c filename:C
#include <stdio.h>

int main(void) {
    printf("%d %d %d\n", 42, 052, 0x2A);         /* same number, three bases */
    printf("%zu %zu %zu\n", sizeof 42, sizeof 42L, sizeof 42.0f);
    printf("[%s] has %zu bytes\n", "hi", sizeof "hi");
    printf("tab[\t] quote[\"] backslash[\\] newline next:\n.\n");
    return 0;
}
```

```text filename:Output
42 42 42
4 8 4
[hi] has 3 bytes
tab[	] quote["] backslash[\] newline next:
.
```

> [!WARNING] Watch out
>
> A leading `0` makes an integer literal <strong>octal</strong>: `010` is 8, and `09` is a compile error.

# Three ways to name a constant

| Form | Example | Typed? | Scope | Notes |
| --- | --- | --- | --- | --- |
| `#define` | `#define MAX 100` | No | From definition to end of file | Text substitution by the preprocessor; no address |
| `const` | `const int max = 100;` | Yes | Block / file | A read-only <em>variable</em>; not a constant expression in C (can’t size a global array) |
| `enum` | `enum { MAX = 100 };` | `int` | Block / file | A true integer constant expression, visible to the debugger |

```c filename:C
#include <stdio.h>

#define PI 3.14159
enum { SIZE = 4 };

int main(void) {
    const int answer = 42;
    int arr[SIZE] = {1, 2, 3, 4};           /* enum constant can size an array */
    printf("%.2f %d %d\n", PI * 2, answer, arr[SIZE - 1]);
    return 0;
}
```

```text filename:Output
6.28 42 4
```

```c filename:C%20%E2%80%94%20modifying%20a%20const%20is%20a%20compile%20error
int main(void) {
    const int limit = 10;
    limit = 20;              /* error: cannot assign to a const-qualified variable */
    return limit;
}
```

```question
What is the difference between #define and const?

---

`#define` is a preprocessor text replacement: no type, no scope, no storage, invisible to the debugger, and prone to precedence surprises. `const` creates a typed, scoped, read-only object with an address. In C (unlike C++) a `const int` is not a constant expression, so `enum` or `#define` is still used for array sizes and `case` labels.
```

```question
What value does an uninitialised variable have?

---

Objects with <em>static</em> storage duration (globals, `static` locals) are zero-initialised. <em>Automatic</em> locals have an indeterminate value; reading it is undefined behaviour, which is why compilers warn (`-Wuninitialized`).
```
