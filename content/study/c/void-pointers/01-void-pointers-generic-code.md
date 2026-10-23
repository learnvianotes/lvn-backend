---
id: d9192868-2b82-7ca1-9520-24dff1292c39
key: topic:c/void-pointers
subject: c
topic: void-pointers
title: void Pointers & Generic Code
slug: void-pointers-generic-code
order: 1
---

`void *` is a pointer to <em>something</em> of unknown type. Any object pointer converts to and from it implicitly — it is how C writes generic code (`malloc`, `memcpy`, `qsort`).

```c filename:C
#include <stdio.h>

void print_value(const void *p, char type) {
    switch (type) {
        case 'i': printf("int %d\n", *(const int *)p); break;
        case 'd': printf("double %.2f\n", *(const double *)p); break;
        case 's': printf("string %s\n", (const char *)p); break;
    }
}

int main(void) {
    int i = 7;
    double d = 2.5;
    print_value(&i, 'i');
    print_value(&d, 'd');
    print_value("text", 's');
    return 0;
}
```

```text filename:Output
int 7
double 2.50
string text
```

# Rules

- You <strong>cannot dereference</strong> a `void *` — cast it to a concrete type first.
- No pointer arithmetic on `void *` in standard C (GCC allows it as an extension, treating the size as 1).
- `T *` → `void *` → `T *` round-trips safely. Converting to the <em>wrong</em> type and dereferencing is undefined behaviour.
- In C, `malloc`’s `void *` result needs no cast: `int *p = malloc(n * sizeof *p);`. (C++ requires one.)
- Function pointers are <strong>not</strong> guaranteed to convert to `void *` (POSIX allows it for `dlsym`).

# A generic swap

```c filename:C
#include <stdio.h>
#include <string.h>

void swap_any(void *a, void *b, size_t size) {
    unsigned char tmp[64];            /* enough for this demo */
    if (size > sizeof tmp) return;
    memcpy(tmp, a, size);
    memcpy(a, b, size);
    memcpy(b, tmp, size);
}

int main(void) {
    int x = 1, y = 2;
    double p = 1.5, q = 9.75;
    swap_any(&x, &y, sizeof x);
    swap_any(&p, &q, sizeof p);
    printf("%d %d %.2f %.2f\n", x, y, p, q);
    return 0;
}
```

```text filename:Output
2 1 9.75 1.50
```

# A generic linear search

```c filename:C
#include <stdio.h>
#include <string.h>

/* returns the index of the first element equal to key, or -1 */
long find(const void *base, size_t n, size_t size, const void *key,
          int (*eq)(const void *, const void *)) {
    const unsigned char *p = base;             /* byte pointer for arithmetic */
    for (size_t i = 0; i < n; i++)
        if (eq(p + i * size, key)) return (long)i;
    return -1;
}

int eq_int(const void *a, const void *b) { return *(const int *)a == *(const int *)b; }
int eq_str(const void *a, const void *b) {
    return strcmp(*(const char *const *)a, *(const char *const *)b) == 0;
}

int main(void) {
    int nums[] = {3, 1, 4, 1, 5};
    int k = 4;
    const char *names[] = {"ann", "bob", "cy"};
    const char *who = "cy";
    printf("%ld %ld\n", find(nums, 5, sizeof nums[0], &k, eq_int),
           find(names, 3, sizeof names[0], &who, eq_str));
    return 0;
}
```

```text filename:Output
2 2
```

> [!WARNING] Watch out
>
> `void *` throws away type checking — the compiler can no longer catch a wrong cast. Keep the `void *` boundary thin and convert back to real types immediately.

```question
Why can't a void pointer be dereferenced?

---

Dereferencing needs to know the size and interpretation of the object. `void` is an incomplete type with no size, so the compiler cannot generate a load or store — you must first cast to a complete type.
```

```question
Why does qsort's comparator take const void \*?

---

`qsort` is written once for every element type, so it only knows the base address, the element count and the element size. It hands the comparator pointers to two elements as `const void *`; the comparator, which knows the real type, casts them back.
```
