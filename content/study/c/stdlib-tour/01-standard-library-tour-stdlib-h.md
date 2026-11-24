---
id: 7ddae080-cd77-768f-8174-880f19c1a0cf
key: topic:c/stdlib-tour
subject: c
topic: stdlib-tour
title: "Standard Library Tour: stdlib.h"
slug: standard-library-tour-stdlib-h
order: 1
---

The C standard library is small — about 30 headers. `<stdlib.h>` is the grab-bag: memory, conversions, random numbers, sorting, searching, integer arithmetic and process control.

# The headers you will use

| Header | Provides |
| --- | --- |
| `<stdio.h>` | Streams, `printf`/`scanf` families, files |
| `<stdlib.h>` | `malloc`/`free`, `strtol`/`strtod`, `rand`, `qsort`/`bsearch`, `abs`/`div`, `exit`, `getenv`, `system` |
| `<string.h>` | `str…` and `mem…` functions |
| `<ctype.h>` | Character classification and case conversion |
| `<math.h>` | `sqrt`, `pow`, trigonometry, rounding (link with `-lm` on Linux) |
| `<time.h>` | `time`, `clock`, `struct tm`, `strftime`, `mktime` |
| `<stdint.h>` / `<inttypes.h>` | Fixed-width integers and their printf macros |
| `<stdbool.h>` / `<stddef.h>` | `bool`; `size_t`, `NULL`, `offsetof`, `ptrdiff_t` |
| `<limits.h>` / `<float.h>` | Ranges of the numeric types |
| `<errno.h>` / `<assert.h>` | Error numbers; debug assertions |
| `<stdarg.h>` | Variadic functions |
| `<signal.h>` / `<setjmp.h>` | Signals; non-local jumps |
| `<stdatomic.h>` / `<threads.h>` (C11) | Atomics; threads (optional — often POSIX `pthread.h` instead) |

# Integer helpers

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("%d %ld %lld\n", abs(-7), labs(-70000L), llabs(-9000000000LL));
    div_t d = div(17, 5);                 /* quotient and remainder together */
    printf("17 / 5 = %d r %d\n", d.quot, d.rem);
    printf("%ld %lu %.3f\n", strtol("-0x1F", NULL, 16), strtoul("777", NULL, 8), strtod("6.02e23", NULL) / 1e23);
    return 0;
}
```

```text filename:Output
7 70000 9000000000
17 / 5 = 3 r 2
-31 511 6.020
```

# Random numbers

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int roll(void) { return rand() % 6 + 1; }              /* slight modulo bias; fine for games */

int main(void) {
    srand(42);                                          /* same seed -> same sequence */
    int first[5], ok = 1;
    for (int i = 0; i < 5; i++) { first[i] = roll(); if (first[i] < 1 || first[i] > 6) ok = 0; }
    srand(42);
    for (int i = 0; i < 5; i++) if (roll() != first[i]) ok = 0;
    printf("rolls in 1..6 and reproducible: %s\n", ok ? "yes" : "no");
    printf("RAND_MAX >= 32767: %s\n", RAND_MAX >= 32767 ? "yes" : "no");

    double u = rand() / (RAND_MAX + 1.0);               /* uniform in [0, 1) */
    printf("u in [0,1): %s\n", u >= 0 && u < 1 ? "yes" : "no");
    return 0;
}
```

```text filename:Output
rolls in 1..6 and reproducible: yes
RAND_MAX >= 32767: yes
u in [0,1): yes
```

> [!NOTE] Key point
>
> Seed once with `srand((unsigned)time(NULL))` for different runs. `rand()` is low quality and <strong>never</strong> suitable for security — use the OS (`getrandom`, `arc4random`, `/dev/urandom`).

# Process and environment

```c filename:C
#include <stdio.h>
#include <stdlib.h>

void goodbye(void) { printf("atexit handler ran\n"); }

int main(void) {
    atexit(goodbye);                     /* runs when main returns or exit() is called */
    const char *path = getenv("PATH");
    printf("PATH is %s\n", path ? "set" : "unset");
    printf("NO_SUCH_VAR -> %s\n", getenv("NO_SUCH_VAR_123") ? "set" : "NULL");
    return EXIT_SUCCESS;
}
```

```text filename:Output
PATH is set
NO_SUCH_VAR -> NULL
atexit handler ran
```

```question
What does exit() do that return from a function does not?

---

`exit` terminates the whole process from anywhere: it calls functions registered with `atexit` in reverse order, flushes and closes all open streams, removes `tmpfile` files, and returns the status to the OS. Returning from `main` does the same; returning from any other function just goes back to its caller.
```
