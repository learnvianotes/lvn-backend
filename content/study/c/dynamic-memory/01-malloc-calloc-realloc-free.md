---
id: 4be4a998-77d8-7be0-8372-fca8b838d29d
key: topic:c/dynamic-memory
subject: c
topic: dynamic-memory
title: malloc, calloc, realloc & free
slug: malloc-calloc-realloc-free
order: 1
---

When the size or lifetime of data isn’t known at compile time, request memory from the <strong>heap</strong> at run time. Every successful allocation must be released with exactly one `free`.

| Function (`<stdlib.h>`) | Does | Contents | On failure |
| --- | --- | --- | --- |
| `malloc(size)` | Allocate `size` bytes | Uninitialised (garbage) | `NULL` |
| `calloc(n, size)` | Allocate `n × size` bytes (overflow-checked) | All bits zero | `NULL` |
| `realloc(p, size)` | Grow/shrink a block; may move it | Old contents kept, new part uninitialised | `NULL`, <strong>old block still valid</strong> |
| `free(p)` | Release a block | — | `free(NULL)` is a no-op |
| `aligned_alloc(al, size)` (C11) | Allocate with a given alignment | Uninitialised | `NULL` |

# malloc and free

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n = 5;
    int *a = malloc(n * sizeof *a);     /* sizeof *a: stays right if the type changes */
    if (a == NULL) {                    /* always check */
        fprintf(stderr, "out of memory\n");
        return 1;
    }
    for (int i = 0; i < n; i++) a[i] = i * i;
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n");
    free(a);
    a = NULL;                           /* defensive: no dangling pointer */
    return 0;
}
```

```text filename:Output
0 1 4 9 16
```

# calloc: zeroed memory

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    size_t n = 4;
    double *v = calloc(n, sizeof *v);    /* all zeros, and n * size cannot overflow silently */
    if (!v) return 1;
    v[2] = 3.5;
    for (size_t i = 0; i < n; i++) printf("%.1f ", v[i]);
    printf("\n");
    free(v);
    return 0;
}
```

```text filename:Output
0.0 0.0 3.5 0.0
```

# realloc: a growable array

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    size_t len, cap;
} Vec;

int vec_push(Vec *v, int x) {
    if (v->len == v->cap) {
        size_t new_cap = v->cap ? v->cap * 2 : 1;          /* geometric growth: amortised O(1) */
        int *tmp = realloc(v->data, new_cap * sizeof *tmp);
        if (!tmp) return -1;                              /* v->data is still valid */
        v->data = tmp;
        v->cap = new_cap;
        printf("grew to %zu\n", new_cap);
    }
    v->data[v->len++] = x;
    return 0;
}

int main(void) {
    Vec v = {NULL, 0, 0};                 /* realloc(NULL, n) acts like malloc(n) */
    for (int i = 1; i <= 5; i++) vec_push(&v, i * 10);
    printf("len=%zu cap=%zu last=%d\n", v.len, v.cap, v.data[v.len - 1]);
    free(v.data);
    return 0;
}
```

```text filename:Output
grew to 1
grew to 2
grew to 4
grew to 8
len=5 cap=8 last=50
```

> [!WARNING] Watch out
>
> Never write `p = realloc(p, n);` — if `realloc` fails it returns `NULL`, you overwrite your only pointer to the old block, and it leaks. Assign to a temporary first.

# Allocating strings and structs

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { char *name; int age; } Person;

char *dup_string(const char *s) {           /* like POSIX / C23 strdup */
    size_t n = strlen(s) + 1;               /* +1 for the terminator! */
    char *copy = malloc(n);
    if (copy) memcpy(copy, s, n);
    return copy;
}

Person *person_new(const char *name, int age) {
    Person *p = malloc(sizeof *p);
    if (!p) return NULL;
    p->name = dup_string(name);
    if (!p->name) { free(p); return NULL; }
    p->age = age;
    return p;
}

void person_free(Person *p) {
    if (!p) return;
    free(p->name);                          /* inner allocations first */
    free(p);
}

int main(void) {
    Person *p = person_new("Ada", 36);
    if (!p) return 1;
    printf("%s is %d\n", p->name, p->age);
    person_free(p);
    return 0;
}
```

```text filename:Output
Ada is 36
```

# Rules of ownership

- Every `malloc`/`calloc`/`realloc` success is matched by <strong>exactly one</strong> `free` of the same pointer.
- Only pass `free` a pointer that came from an allocation function (not a stack array, not `p + 1`).
- Decide and document <em>who owns</em> each allocation — the function that creates it, or the caller.
- Free nested allocations before the struct that points to them.
- Check sizes for overflow: `n * size` can wrap; `calloc` checks for you.
- Leak checkers: Valgrind (`valgrind --leak-check=full ./app`), LeakSanitizer (`-fsanitize=address` on Linux).

```question
What is the difference between malloc and calloc?

---

`malloc(bytes)` returns uninitialised memory. `calloc(count, size)` returns zero-filled memory for `count` elements and checks the multiplication for overflow. `calloc` can be as fast as `malloc` for large blocks because the OS hands out pre-zeroed pages.
```

```question
What happens if you call free twice on the same pointer?

---

Undefined behaviour — a <em>double free</em>. It typically corrupts the allocator’s internal lists, can crash later in an unrelated `malloc`, and is exploitable. Setting the pointer to `NULL` after freeing makes a second `free(NULL)` harmless.
```

```question
Does free return memory to the operating system?

---

Not necessarily. `free` returns the block to the allocator’s free lists so later `malloc`s can reuse it. Large blocks (served by `mmap`) are usually returned immediately; small ones typically stay with the process.
```

```question
Should you cast the result of malloc in C?

---

No. `void *` converts implicitly to any object pointer type in C, and a cast can hide a missing `#include <stdlib.h>` in old compilers. The cast is required only in C++.
```
