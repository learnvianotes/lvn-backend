---
id: 37987bbf-89ab-774d-9f4b-075a9d545818
key: topic:c/data-types
subject: c
topic: data-types
title: Data Types & Sizes
slug: data-types-sizes
order: 1
---

C has a handful of built-in arithmetic types whose sizes are <em>implementation-defined</em> — the standard only guarantees minimum ranges. Always measure with `sizeof`.

# The basic types

| Type | Guaranteed minimum | Typical size (64-bit Linux/macOS) | Format |
| --- | --- | --- | --- |
| `char` | 8 bits | 1 byte | `%c` / `%d` |
| `short` | 16 bits | 2 bytes | `%hd` |
| `int` | 16 bits | 4 bytes | `%d` |
| `long` | 32 bits | 8 bytes (4 on 64-bit Windows) | `%ld` |
| `long long` | 64 bits | 8 bytes | `%lld` |
| `float` | \~6 decimal digits | 4 bytes (IEEE 754 single) | `%f` |
| `double` | \~10 digits (15 in practice) | 8 bytes (IEEE 754 double) | `%f` / `%lf` |
| `long double` | ≥ `double` | 16 bytes x86-64 Linux, <strong>8</strong> on Apple arm64 | `%Lf` |
| `_Bool` / `bool` | holds 0 or 1 | 1 byte | `%d` |
| `void` | no value | — | — |

> [!NOTE] Key point
>
> Size ordering is guaranteed: `sizeof(char) == 1 ≤ sizeof(short) ≤ sizeof(int) ≤ sizeof(long) ≤ sizeof(long long)`. A “byte” in C is `CHAR_BIT` bits — 8 on every mainstream platform.

# Measure with sizeof

```c filename:C%20%E2%80%94%20output%20from%20a%2064-bit%20Apple%20arm64%20machine
#include <stdio.h>
#include <stdbool.h>

int main(void) {
    printf("char        %zu\n", sizeof(char));
    printf("short       %zu\n", sizeof(short));
    printf("int         %zu\n", sizeof(int));
    printf("long        %zu\n", sizeof(long));
    printf("long long   %zu\n", sizeof(long long));
    printf("float       %zu\n", sizeof(float));
    printf("double      %zu\n", sizeof(double));
    printf("long double %zu\n", sizeof(long double));
    printf("bool        %zu\n", sizeof(bool));
    printf("pointer     %zu\n", sizeof(void *));
    return 0;
}
```

```text filename:Output
char        1
short       2
int         4
long        8
long long   8
float       4
double      8
long double 8
bool        1
pointer     8
```

`sizeof` is an <em>operator</em>, not a function: it is evaluated at compile time (except for VLAs), and its result has type `size_t` — print it with `%zu`. Parentheses are only needed around a type: `sizeof x` works for a variable.

# signed and unsigned

| Type | Range with 32-bit int |
| --- | --- |
| `int` (= `signed int`) | −2 147 483 648 … 2 147 483 647 |
| `unsigned int` | 0 … 4 294 967 295 |
| `signed char` | −128 … 127 |
| `unsigned char` | 0 … 255 (the type for raw bytes) |
| plain `char` | <strong>either</strong> — signed on x86 and Apple arm64, unsigned on Linux ARM |

```c filename:C
#include <stdio.h>

int main(void) {
    unsigned int u = 0;
    u = u - 1;                    /* unsigned arithmetic wraps modulo 2^32 — well defined */
    printf("%u\n", u);

    unsigned char byte = 250;
    byte += 10;                   /* 260 mod 256 */
    printf("%d\n", byte);
    return 0;
}
```

```text filename:Output
4294967295
4
```

> [!WARNING] Watch out
>
> Unsigned overflow wraps around (defined). <strong>Signed</strong> overflow is <em>undefined behaviour</em> — the compiler may assume it never happens. See the UB topic.

# Floating point

```c filename:C
#include <stdio.h>

int main(void) {
    double a = 0.1 + 0.2;
    printf("%.17f\n", a);
    printf("%s\n", a == 0.3 ? "equal" : "not equal");

    float f = 16777217.0f;        /* 2^24 + 1 cannot be stored in a float */
    printf("%.1f\n", f);
    printf("%f %f\n", 7 / 2.0, (double)(7 / 2));
    return 0;
}
```

```text filename:Output
0.30000000000000004
not equal
16777216.0
3.500000 3.000000
```

> [!NOTE] Key point
>
> Never compare floating-point values with `==`. Compare with a tolerance: `fabs(a - b) < 1e-9`. Use `double` by default — `float` only when memory matters (large arrays, GPUs).

# Characters are small integers

```c filename:C
#include <stdio.h>

int main(void) {
    char c = 'A';
    printf("%c %d %c %d\n", c, c, c + 2, '0');
    printf("digit value: %d\n", '7' - '0');
    printf("sizeof 'A' = %zu\n", sizeof 'A');   /* a char literal has type int in C */
    return 0;
}
```

```text filename:Output
A 65 C 48
digit value: 7
sizeof 'A' = 4
```

```question
What is the size of int in C?

---

Implementation-defined; the standard only requires at least 16 bits. On virtually every modern desktop/server platform (ILP32, LP64, LLP64) it is 32 bits. That is why portable code uses `<stdint.h>` types such as `int32_t` when the exact width matters.
```

```question
Is char signed or unsigned?

---

Implementation-defined. `char`, `signed char` and `unsigned char` are three distinct types. Use `unsigned char` for raw bytes and cast to `unsigned char` before passing a `char` to `<ctype.h>` functions.
```

```question
What does sizeof('A') return in C and in C++?

---

In C a character constant has type `int`, so `sizeof('A')` is `sizeof(int)` (usually 4). In C++ it has type `char`, so the result is 1.
```
