---
id: 9ce258e4-9d2f-7f52-a550-b6abefb34287
key: topic:c/fixed-width-limits
subject: c
topic: fixed-width-limits
title: limits.h, stdint.h & Fixed-Width Types
slug: limits-h-stdint-h-fixed-width-types
order: 1
---

`<limits.h>` tells you the range of the built-in types on <em>this</em> platform; `<stdint.h>` gives you types with an <em>exact</em> width when you need one.

# limits.h and float.h

```c filename:C
#include <stdio.h>
#include <limits.h>
#include <float.h>

int main(void) {
    printf("CHAR_BIT  = %d\n", CHAR_BIT);
    printf("SCHAR     = %d .. %d\n", SCHAR_MIN, SCHAR_MAX);
    printf("UCHAR_MAX = %d\n", UCHAR_MAX);
    printf("SHRT      = %d .. %d\n", SHRT_MIN, SHRT_MAX);
    printf("INT       = %d .. %d\n", INT_MIN, INT_MAX);
    printf("UINT_MAX  = %u\n", UINT_MAX);
    printf("LLONG_MAX = %lld\n", LLONG_MAX);
    printf("DBL_MAX   = %g, DBL_EPSILON = %g\n", DBL_MAX, DBL_EPSILON);
    return 0;
}
```

```text filename:Output
CHAR_BIT  = 8
SCHAR     = -128 .. 127
UCHAR_MAX = 255
SHRT      = -32768 .. 32767
INT       = -2147483648 .. 2147483647
UINT_MAX  = 4294967295
LLONG_MAX = 9223372036854775807
DBL_MAX   = 1.79769e+308, DBL_EPSILON = 2.22045e-16
```

# stdint.h — exact, least and fast types

| Type | Meaning |
| --- | --- |
| `int8_t`, `int16_t`, `int32_t`, `int64_t` | Exactly N bits, two’s complement (optional but universally available) |
| `uint8_t` … `uint64_t` | Unsigned exact-width |
| `int_least16_t` | Smallest type with at least 16 bits |
| `int_fast32_t` | Fastest type with at least 32 bits |
| `intmax_t` / `uintmax_t` | Widest integer type |
| `intptr_t` / `uintptr_t` | Integer that can hold a pointer value |
| `size_t` (`<stddef.h>`) | Unsigned result of `sizeof`; use for sizes and indexes |
| `ptrdiff_t` (`<stddef.h>`) | Signed difference of two pointers |

# Printing them portably: inttypes.h

```c filename:C
#include <stdio.h>
#include <stdint.h>
#include <inttypes.h>

int main(void) {
    int64_t big = INT64_MAX;
    uint8_t small = UINT8_MAX;
    uint32_t mask = 0xDEADBEEF;
    printf("big   = %" PRId64 "\n", big);
    printf("small = %" PRIu8 "\n", small);
    printf("mask  = 0x%" PRIX32 "\n", mask);
    printf("sizes = %zu %zu %zu\n", sizeof(int8_t), sizeof(int32_t), sizeof(uint64_t));
    return 0;
}
```

```text filename:Output
big   = 9223372036854775807
small = 255
mask  = 0xDEADBEEF
sizes = 1 4 8
```

> [!NOTE] Key point
>
> `PRId64` is a string macro such as `"lld"` or `"ld"`; string-literal concatenation glues it into the format. This avoids guessing whether `int64_t` is `long` or `long long` on a given platform.

> [!TIP] Do
>
> Use `uint8_t` for bytes, `uint32_t` for bit masks and file formats, `size_t` for sizes and array indexes.

> [!DANGER] Avoid
>
> Assume `long` is 64 bits — it is 32 bits on 64-bit Windows.

```question
When should you use int vs int32\_t?

---

Use `int` for ordinary counters and arithmetic where the natural word size is fine. Use exact-width types when layout matters: binary file formats, network protocols, hardware registers, hashing and bit manipulation.
```

```question
What is size\_t and why is it unsigned?

---

`size_t` is the unsigned integer type returned by `sizeof` and taken by `malloc`, `strlen`, `memcpy`… It is large enough to hold the size of any object. It is unsigned because sizes are never negative — beware loops like `for (size_t i = n - 1; i >= 0; i--)`, which never end.
```
