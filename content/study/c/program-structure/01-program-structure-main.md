---
id: 8c7a0848-9966-728b-a621-afdbb0a86dc0
key: topic:c/program-structure
subject: c
topic: program-structure
title: Program Structure & main
slug: program-structure-main
order: 1
---

A C program is a set of declarations and function definitions; execution starts at `main`, and its return value becomes the process exit status.

# Anatomy of a program

```c filename:C
/* 1. Preprocessor directives */
#include <stdio.h>
#define GREETING "Hi"

/* 2. Global declarations */
static int counter = 0;

/* 3. Function prototype (declaration) */
int square(int x);

/* 4. main: the entry point */
int main(void) {
    counter++;
    printf("%s! square(7) = %d, counter = %d\n", GREETING, square(7), counter);
    return 0;                /* 0 = success */
}

/* 5. Function definitions */
int square(int x) {
    return x * x;
}
```

```text filename:Output
Hi! square(7) = 49, counter = 1
```

# Valid signatures of main

| Signature | Use |
| --- | --- |
| `int main(void)` | No command-line arguments. |
| `int main(int argc, char *argv[])` | With arguments (`char **argv` is identical). |
| `void main()` | <strong>Not standard C.</strong> Some compilers accept it; never write it. |

- `return 0;` or `return EXIT_SUCCESS;` means success; `EXIT_FAILURE` (from `<stdlib.h>`) means failure.
- Reaching the closing `}` of `main` without `return` is treated as `return 0;` (C99+) — but only for `main`.
- `int main()` with empty parentheses means <em>unspecified arguments</em> in C17; prefer `(void)`.

# Comments

```c filename:C
#include <stdio.h>

int main(void) {
    /* block comment — can span
       several lines, but cannot be nested */
    int x = 5;   // line comment (C99+)
    printf("%d\n", x);
    return 0;
}
```

```text filename:Output
5
```

# Declarations vs definitions

> [!NOTE] Declaration
>
> Introduces a name and its type: `int square(int x);`, `extern int count;`. Can appear many times.

> [!NOTE] Definition
>
> Declaration that also allocates storage or provides the body: `int count = 0;`, `int square(int x) { … }`. Exactly <strong>one</strong> per program (the <em>one-definition rule</em>).

> [!WARNING] Watch out
>
> Calling a function before any declaration of it is an error since C99 (“implicit declaration”). Put prototypes at the top or in a header.

```question
What happens before main runs?

---

The C runtime startup code (`crt0`/`_start`) sets up the stack, initialises `.data` and zeroes `.bss`, sets up `stdin`/`stdout`/`stderr`, builds `argc`/`argv`, then calls `main`. When `main` returns, `exit()` is called with its return value, which flushes buffers and runs `atexit` handlers.
```

```question
What does the return value of main mean?

---

It is the process exit status passed to the operating system (`$?` in a shell). By convention `0` means success and non-zero means an error; only the low 8 bits are visible on POSIX systems.
```
