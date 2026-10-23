---
id: 2e7ff878-970b-7f5c-931d-494d29fad2bf
key: topic:c/preprocessor
subject: c
topic: preprocessor
title: Preprocessor & Macros
slug: preprocessor-macros
order: 1
---

Before compilation, the preprocessor rewrites the source text: it pastes in headers, expands macros and keeps or drops code with conditionals. It knows nothing about C types or scope.

| Directive | Purpose |
| --- | --- |
| `#include <x.h>` / `"x.h"` | Paste a file (angle brackets: system paths; quotes: current dir first) |
| `#define NAME value` | Object-like macro |
| `#define F(a, b) (…)` | Function-like macro |
| `#undef NAME` | Remove a definition |
| `#if` / `#elif` / `#else` / `#endif` | Conditional compilation on constant expressions |
| `#ifdef` / `#ifndef` / `defined(X)` | Is a macro defined? |
| `#error "msg"` | Stop compilation with a message |
| `#pragma` | Implementation-specific (`#pragma once`, `#pragma pack`) |
| `#line` | Change reported line numbers (used by code generators) |

# Macros and their pitfalls

```c filename:C
#include <stdio.h>

#define SQUARE_BAD(x) x * x
#define SQUARE(x) ((x) * (x))            /* parenthesise every argument AND the whole body */
#define MAX(a, b) ((a) > (b) ? (a) : (b))

int main(void) {
    printf("%d\n", SQUARE_BAD(2 + 3));   /* 2 + 3 * 2 + 3 = 11 */
    printf("%d\n", SQUARE(2 + 3));       /* 25 */
    printf("%d\n", 100 / SQUARE(5));     /* 4 — without outer parens: 100 / 5 * 5 = 100 */

    int i = 5, j = 3;
    int m = MAX(i++, j);                 /* i++ is evaluated TWICE */
    printf("m = %d, i = %d\n", m, i);
    return 0;
}
```

```text filename:Output
11
25
4
m = 6, i = 7
```

> [!WARNING] Watch out
>
> Function-like macros evaluate arguments as many times as they appear. Never pass expressions with side effects (`i++`, function calls). Prefer `static inline` functions — they are type-checked and evaluate arguments once.

# Multi-statement macros: do { } while (0)

```c filename:C
#include <stdio.h>

#define SWAP(a, b) do { int tmp_ = (a); (a) = (b); (b) = tmp_; } while (0)

int main(void) {
    int x = 1, y = 2;
    if (x < y)
        SWAP(x, y);        /* expands to ONE statement, so the else still pairs correctly */
    else
        printf("no swap\n");
    printf("%d %d\n", x, y);
    return 0;
}
```

```text filename:Output
2 1
```

# Stringising #, token pasting ##, predefined macros

```c filename:C
#include <stdio.h>

#define STR(x) #x
#define XSTR(x) STR(x)                    /* expand first, then stringise */
#define VERSION 3
#define DEBUG_PRINT(var) printf(#var " = %d\n", var)
#define MAKE_GETTER(field) int get_##field(void) { return field; }

int width = 80;
MAKE_GETTER(width)                        /* defines int get_width(void) */

int main(void) {
    int count = 42;
    DEBUG_PRINT(count);
    printf("%s %s\n", STR(VERSION), XSTR(VERSION));
    printf("%d\n", get_width());
    printf("line %d of %s, C standard %ld\n", __LINE__, __func__, __STDC_VERSION__);
    return 0;
}
```

```text filename:Output
count = 42
VERSION 3
80
line 17 of main, C standard 201710
```

| Macro | Value |
| --- | --- |
| `__FILE__`, `__LINE__` | Current file name and line |
| `__func__` | Current function name (a predefined identifier, not a macro) |
| `__DATE__`, `__TIME__` | Compilation date and time |
| `__STDC_VERSION__` | `199901L` (C99), `201112L` (C11), `201710L` (C17), `202311L` (C23) |
| `__GNUC__`, `__clang__`, `_WIN32`, `__linux__`, `__APPLE__` | Compiler / platform detection |

# Conditional compilation

```c filename:C%20%E2%80%94%20compiled%20on%20macOS%20with%20-DBUFFER_SIZE%3D1024
#include <stdio.h>

#define LOG_LEVEL 2

#ifndef BUFFER_SIZE
#define BUFFER_SIZE 256                   /* default unless -DBUFFER_SIZE=... is passed */
#endif

#if LOG_LEVEL >= 2
#define LOG(msg) printf("[debug] %s\n", msg)
#else
#define LOG(msg) ((void)0)
#endif

int main(void) {
    LOG("starting");
#if defined(__APPLE__)
    printf("macOS build, buffer %d\n", BUFFER_SIZE);
#elif defined(__linux__)
    printf("Linux build, buffer %d\n", BUFFER_SIZE);
#else
    printf("other build, buffer %d\n", BUFFER_SIZE);
#endif
    return 0;
}
```

```text filename:Output
[debug] starting
macOS build, buffer 1024
```

```c filename:C%20%E2%80%94%20assert%20aborts%20the%20program%20when%20the%20condition%20is%20false
#include <stdio.h>
#include <assert.h>

int main(void) {
    int balance = 10;
    assert(balance >= 0);           /* active unless NDEBUG is defined */
    balance -= 25;
    assert(balance >= 0 && "balance went negative");
    printf("unreachable\n");
    return 0;
}
```

```text filename:stderr
Assertion failed: (balance >= 0 && "balance went negative"), function main, file main.c, line 8.
```

```question
What is the difference between a macro and an inline function?

---

A macro is textual substitution before compilation: no type checking, arguments may be evaluated several times, no scope, hard to debug. An `inline` function is a real function the compiler may expand in place: arguments are evaluated once and type-checked, and it follows normal scope rules. Macros are still needed for stringising, token pasting, conditional compilation and type-generic tricks.
```

```question
Why wrap a multi-statement macro in do { ... } while (0)?

---

It turns the macro into a single statement that requires a trailing semicolon, so it works correctly as the body of an unbraced `if`/`else`. A bare `{ … }` block followed by `;` would break an `if … else`.
```

```question
What does #include &lt;file&gt; vs #include "file" do?

---

Both paste the file’s contents. `"file"` searches the directory of the current file first, then the system paths; `<file>` searches only the system/`-I` paths. Use quotes for your own headers.
```
