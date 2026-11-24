---
id: 7837225f-46ae-7366-87ac-25548b8cfed8
key: topic:c/type-qualifiers
subject: c
topic: type-qualifiers
title: "Type Qualifiers: const, volatile, restrict"
slug: type-qualifiers-const-volatile-restrict
order: 1
---

Qualifiers add promises about an object: `const` — I won’t write it; `volatile` — it may change behind the compiler’s back; `restrict` — this pointer is the only way to reach that memory.

| Qualifier | Promise / meaning | Typical use |
| --- | --- | --- |
| `const` | Not modified through this name | Read-only parameters, lookup tables |
| `volatile` | Every read and write must really happen, in order — no caching in registers | Memory-mapped hardware registers, variables changed by signal handlers |
| `restrict` (C99) | For the pointer’s lifetime, the object is accessed only through it | `memcpy`, numeric kernels — enables vectorisation |
| `_Atomic` (C11) | Accesses are atomic | Lock-free counters shared between threads |

# volatile

```c filename:C
#include <stdio.h>
#include <signal.h>

static volatile sig_atomic_t stop = 0;    /* changed by a signal handler */

void on_signal(int sig) { (void)sig; stop = 1; }

int main(void) {
    signal(SIGINT, on_signal);
    long spins = 0;
    while (!stop) {                        /* volatile: re-read every iteration */
        if (++spins == 1000000) raise(SIGINT);
    }
    printf("stopped after %ld spins\n", spins);
    return 0;
}
```

```text filename:Output
stopped after 1000000 spins
```

> [!WARNING] Watch out
>
> `volatile` does <strong>not</strong> make code thread-safe: it gives no atomicity and no memory ordering between CPUs. For threads use `_Atomic` / `<stdatomic.h>` or mutexes.

# restrict

```c filename:C
#include <stdio.h>

/* the caller promises dst and src do not overlap, so the compiler may vectorise */
void add_arrays(size_t n, float *restrict dst, const float *restrict src) {
    for (size_t i = 0; i < n; i++) dst[i] += src[i];
}

int main(void) {
    float a[4] = {1, 2, 3, 4}, b[4] = {10, 20, 30, 40};
    add_arrays(4, a, b);
    printf("%.0f %.0f %.0f %.0f\n", a[0], a[1], a[2], a[3]);
    return 0;
}
```

```text filename:Output
11 22 33 44
```

The standard library uses it: `void *memcpy(void *restrict dst, const void *restrict src, size_t n);` — which is precisely why overlapping `memcpy` is undefined and `memmove` (no `restrict`) exists.

```question
Can a variable be both const and volatile?

---

Yes — e.g. `const volatile uint32_t *status_reg`: the program must not write it (`const`) but hardware can change it at any time, so every read must go to memory (`volatile`). A read-only hardware status register is the classic example.
```

```question
What happens if you break a restrict promise?

---

Undefined behaviour. The compiler optimised assuming no aliasing (e.g. keeping values in registers or reordering loads), so overlapping pointers can produce wrong results silently.
```
