---
id: 3c41c26c-29e1-7682-8268-4ea9f421d7a0
key: topic:c/modern-c
subject: c
topic: modern-c
title: C99, C11, C17 & C23 Features
slug: c99-c11-c17-c23-features
order: 1
---

Modern C is much nicer than the C89 many tutorials still teach. Use `-std=c17` (or `-std=c23`) and these features freely.

# C99

```c filename:C
#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>

struct Point { int x, y; };

static inline int sq(int v) { return v * v; }        /* inline functions */

int main(void) {
    // line comments
    for (int i = 0; i < 1; i++) { }                   /* declarations in for */
    bool ready = true;                                 /* <stdbool.h> */
    int64_t big = 1LL << 40;                           /* <stdint.h>, long long */
    struct Point p = {.y = 2, .x = 1};                 /* designated initializers */
    int arr[5] = {[4] = 9};
    int n = 3;
    int vla[n];                                        /* variable-length array */
    vla[0] = sq(n);
    struct Point *q = &(struct Point){5, 6};           /* compound literal */
    printf("%d %lld %d %d %d %d %d\n", ready, (long long)big, p.x, arr[4], vla[0], q->y, __func__[0]);
    return 0;
}
```

```text filename:Output
1 1099511627776 1 9 9 6 109
```

# C11

```c filename:C
#include <stdio.h>
#include <stdalign.h>
#include <stdnoreturn.h>
#include <stdlib.h>

/* _Generic: compile-time dispatch on the type of an expression */
#define type_name(x) _Generic((x), \
    int: "int", double: "double", char *: "char *", default: "other")

#define print_any(x) _Generic((x), int: print_int, double: print_double)(x)
void print_int(int v) { printf("int %d\n", v); }
void print_double(double v) { printf("double %.2f\n", v); }

_Static_assert(sizeof(int) >= 4, "need 32-bit int");   /* compile-time check */

struct Packet {
    int kind;
    union { int code; float value; };                    /* anonymous union */
};

noreturn void die(const char *msg) { fprintf(stderr, "%s\n", msg); exit(1); }

int main(void) {
    char *s = "hi";
    printf("%s %s %s %s\n", type_name(42), type_name(3.0), type_name(s), type_name(1L));
    print_any(7);
    print_any(2.5);
    struct Packet pk = {.kind = 1, .code = 404};
    printf("%d %zu\n", pk.code, alignof(double));
    if (pk.code != 404) die("unexpected");
    return 0;
}
```

```text filename:Output
int double char * other
int 7
double 2.50
404 8
```

| C11 feature | Purpose |
| --- | --- |
| `_Generic` | Type-generic macros (how `<tgmath.h>` works) |
| `_Static_assert` / `static_assert` | Compile-time assertions |
| `_Alignas` / `_Alignof` | Control / query alignment |
| `_Noreturn` | Function never returns (`exit`, `abort`) |
| Anonymous structs/unions | Access nested members directly |
| `_Atomic`, `<stdatomic.h>`, memory model | Portable concurrency |
| `<threads.h>` (optional) | Threads, mutexes, condition variables |
| `_Thread_local` | Thread-local storage |
| Bounds-checked `_s` functions (Annex K) | Optional; rarely implemented |
| `gets` removed | Finally |
| `aligned_alloc`, `quick_exit`, `timespec_get` | Library additions |

# C17

C17 (also called C18) is a <em>bug-fix</em> release: no new features, only clarifications and defect fixes to C11. `__STDC_VERSION__` is `201710L`. It is the default of GCC 8+ and recent Clang.

# C23

```c filename:C%20%E2%80%94%20compiled%20with%20-std%3Dc23
#include <stdio.h>
#include <stdckdint.h>

[[nodiscard]] int twice(int x) { return 2 * x; }     /* standard attributes */

enum Small : unsigned char { A, B, C };                  /* fixed underlying type */

int main(void) {
    constexpr int size = 4;                              /* true compile-time constant */
    int arr[size] = {};                                  /* empty initializer = zero */
    bool ok = true;                                      /* bool/true/false are keywords */
    int *p = nullptr;                                    /* typed null pointer constant */
    typeof(size) mask = 0b1111'0000;                     /* typeof, binary literal, digit separator */
    auto ratio = 2.5;                                    /* type inference */
    int sum;
    bool overflow = ckd_add(&sum, 2147483647, 1);        /* checked arithmetic */
    static_assert(sizeof(enum Small) == 1);              /* message optional */
    printf("%d %d %d %d %.1f %d %d\n", arr[3], ok, p == nullptr, mask, ratio, twice(size), overflow);
    return 0;
}
```

```text filename:Output
0 1 1 240 2.5 8 1
```

| C23 feature | Replaces |
| --- | --- |
| `bool`, `true`, `false`, `static_assert`, `alignas`… as keywords | `<stdbool.h>` etc. |
| `nullptr` / `nullptr_t` | `NULL` (which may be `0`) |
| `constexpr` objects | `#define` / `enum` constants |
| `typeof`, `typeof_unqual` | GNU `__typeof__` |
| `auto` type inference | Spelling out types |
| `[[nodiscard]]`, `[[maybe_unused]]`, `[[deprecated]]`, `[[fallthrough]]` | `__attribute__` |
| `0b` literals, `'` digit separators | Hex masks |
| `<stdckdint.h>`: `ckd_add`, `ckd_sub`, `ckd_mul` | Hand-written overflow checks |
| `#embed`, `#elifdef`, `__has_include` | External tools, nested `#ifdef` |
| `f(void)` ≡ `f()`; K&amp;R definitions removed | Unprototyped functions |
| Two’s complement mandatory | Implementation-defined representations |

```question
What is \_Generic used for?

---

Selecting an expression at compile time based on the type of a controlling expression — the foundation of type-generic macros like `<tgmath.h>`’s `sqrt` that call `sqrtf`, `sqrt` or `sqrtl` depending on the argument type. It gives C a limited form of overloading.
```

```question
What are designated initializers?

---

C99 syntax to initialise specific members or indexes by name: `struct Point p = {.y = 2, .x = 1};`, `int a[10] = {[9] = 1};`. Unmentioned members are zero-initialised, the order doesn’t matter, and the code survives reordering of struct fields.
```
