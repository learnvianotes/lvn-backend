---
id: 00eafe1d-1af4-7844-81bd-4e79912c1313
key: topic:c/multi-file-programs
subject: c
topic: multi-file-programs
title: Header Files & Multi-File Programs
slug: header-files-multi-file-programs
order: 1
---

Real programs split into modules: a <strong>header</strong> (`.h`) declares the interface, a <strong>source</strong> file (`.c`) implements it, and the linker joins the compiled objects.

# A module: header + implementation

```c filename:C%20%E2%80%94%20mathx.h%20(compile-checked)
/* ---------- mathx.h ---------- */
#ifndef MATHX_H              /* include guard: safe to include twice */
#define MATHX_H

#include <stddef.h>

#define MATHX_PI 3.14159265358979

extern int mathx_calls;                           /* declaration only */

int    mathx_gcd(int a, int b);                   /* prototypes */
double mathx_mean(const double *v, size_t n);

static inline int mathx_sq(int x) { return x * x; }   /* small helpers may live in the header */

#endif /* MATHX_H */
```

```c filename:C%20%E2%80%94%20mathx.c%20(compile-checked)
/* ---------- mathx.c ---------- */
#include <stddef.h>
/* #include "mathx.h"  — always include your own header to check the prototypes match */
extern int mathx_calls;
int mathx_gcd(int a, int b);
double mathx_mean(const double *v, size_t n);

int mathx_calls = 0;                              /* the one definition */

static int abs_int(int x) { return x < 0 ? -x : x; }   /* private helper */

int mathx_gcd(int a, int b) {
    mathx_calls++;
    a = abs_int(a); b = abs_int(b);
    while (b) { int t = a % b; a = b; b = t; }
    return a;
}

double mathx_mean(const double *v, size_t n) {
    mathx_calls++;
    double s = 0;
    for (size_t i = 0; i < n; i++) s += v[i];
    return n ? s / n : 0.0;
}
```

```c filename:C%20%E2%80%94%20main.c%20(run%20as%20one%20file)
/* ---------- main.c ---------- */
#include <stdio.h>
/* #include "mathx.h" */
#include <stddef.h>
extern int mathx_calls;
int mathx_gcd(int a, int b);
double mathx_mean(const double *v, size_t n);
static inline int mathx_sq(int x) { return x * x; }

int main(void) {
    double v[] = {2, 4, 9};
    printf("gcd=%d mean=%.1f sq=%d calls=%d\n",
           mathx_gcd(-48, 18), mathx_mean(v, 3), mathx_sq(7), mathx_calls);
    return 0;
}

/* (the definitions from mathx.c, pasted here so this sample runs as one file) */
int mathx_calls = 0;
int mathx_gcd(int a, int b) {
    mathx_calls++;
    a = a < 0 ? -a : a; b = b < 0 ? -b : b;
    while (b) { int t = a % b; a = b; b = t; }
    return a;
}
double mathx_mean(const double *v, size_t n) {
    mathx_calls++;
    double s = 0;
    for (size_t i = 0; i < n; i++) s += v[i];
    return n ? s / n : 0.0;
}
```

```text filename:Output
gcd=6 mean=5.0 sq=49 calls=2
```

```filename:Terminal
$ gcc -c mathx.c -o mathx.o                 # compile each module separately
$ gcc -c main.c  -o main.o
$ gcc main.o mathx.o -o app                 # link them
$ ./app
gcd=6 mean=5.0 sq=49 calls=2

# or in one step
$ gcc -Wall -Wextra main.c mathx.c -o app

# build a static library and link against it
$ ar rcs libmathx.a mathx.o
$ gcc main.c -L. -lmathx -o app
```

# What goes where

| In the header (`.h`) | In the source (`.c`) |
| --- | --- |
| Function prototypes | Function definitions |
| `extern` variable declarations | The one definition of each global |
| Type definitions (`struct`, `enum`, `typedef`) | `static` helper functions and file-private globals |
| Macros and `static inline` helpers | `#include` of its own header first |
| Include guard / `#pragma once` | — |

> [!WARNING] Watch out
>
> Never <em>define</em> a non-`static` variable or function in a header (`int count = 0;`). Every `.c` file that includes it gets its own definition, and the linker fails with “duplicate symbol” / “multiple definition”.

# A minimal Makefile

```filename:Makefile
CC      = gcc
CFLAGS  = -std=c17 -Wall -Wextra -O2
OBJS    = main.o mathx.o

app: $(OBJS)
	$(CC) $(CFLAGS) $(OBJS) -o $@

%.o: %.c mathx.h
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) app
```

> [!NOTE] Key point
>
> Make recompiles only the files whose sources (or headers) changed. Larger projects use CMake or Meson to generate the build.

```question
What is an include guard and why is it needed?

---

`#ifndef X_H / #define X_H / … / #endif` around a header’s content. If the header is included twice in one translation unit (directly or via other headers), the second copy expands to nothing, avoiding redefinition errors for types and macros. `#pragma once` does the same and is supported by all major compilers, though non-standard.
```

```question
Why separate declarations and definitions into .h and .c files?

---

It gives each module a public interface and a private implementation, allows separate compilation (only changed files are recompiled), lets many files share one set of declarations so the compiler checks every call, and keeps exactly one definition of each symbol for the linker.
```
