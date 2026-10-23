---
id: 5f62a83d-0e6c-7a10-9b3b-981394ed51fb
key: topic:c/pointer-arithmetic
subject: c
topic: pointer-arithmetic
title: Pointer Arithmetic
slug: pointer-arithmetic
order: 1
---

Adding `n` to a pointer moves it by `n` <em>elements</em>, not bytes: `p + 1` advances by `sizeof *p`. Arithmetic is only valid within one array (plus one-past-the-end).

```c filename:C
#include <stdio.h>

int main(void) {
    int a[] = {10, 20, 30, 40};
    int *p = a;                  /* &a[0] */
    char *c = (char *)a;

    printf("%d %d %d\n", *p, *(p + 1), *(p + 3));
    printf("int step  = %td bytes\n", (char *)(p + 1) - (char *)p);
    printf("char step = %td bytes\n", (c + 1) - c);

    int *end = a + 4;            /* one past the end: may be compared, never dereferenced */
    printf("elements between = %td\n", end - p);
    for (int *q = a; q < end; q++) printf("%d ", *q);
    printf("\n");
    return 0;
}
```

```text filename:Output
10 20 40
int step  = 4 bytes
char step = 1 bytes
elements between = 4
10 20 30 40
```

# What is allowed

| Operation | Allowed? | Result |
| --- | --- | --- |
| `p + n`, `p - n`, `p++`, `p--` | Yes, within the array / one past end | Pointer |
| `p - q` (same array) | Yes | `ptrdiff_t` element count (`%td`) |
| `p < q`, `p == q` | Yes (relational only within one array) | 0 / 1 |
| `p + q`, `p * 2`, `p / 2` | <strong>No</strong> — compile error | — |
| `p + n` beyond one-past-end | <strong>Undefined</strong> even without dereferencing | — |
| Arithmetic on `void *` | Not in standard C (GNU extension treats it as `char *`) | — |

# Idioms

```c filename:C
#include <stdio.h>

size_t length(const char *s) {
    const char *p = s;
    while (*p) p++;                 /* walk to the terminator */
    return (size_t)(p - s);         /* pointer difference = count */
}

void copy(char *dst, const char *src) {
    while ((*dst++ = *src++) != '\0') { }   /* classic K&R strcpy */
}

int sum(const int *begin, const int *end) {
    int s = 0;
    while (begin != end) s += *begin++;     /* *(begin++) */
    return s;
}

int main(void) {
    char buf[16];
    copy(buf, "pointer");
    int v[] = {1, 2, 3, 4, 5};
    printf("%s %zu %d\n", buf, length(buf), sum(v, v + 5));
    return 0;
}
```

```text filename:Output
pointer 7 15
```

# Precedence of `*` and `++`

```c filename:C
#include <stdio.h>

int main(void) {
    int a[] = {10, 20, 30};
    int *p = a;
    int x;
    x = *p++;    printf("*p++   -> %d, now *p = %d\n", x, *p);   /* read, then move */
    x = *++p;    printf("*++p   -> %d\n", x);                    /* move, then read */
    p = a;
    x = ++*p;    printf("++*p   -> %d, a[0] = %d\n", x, a[0]);   /* increment the value */
    x = (*p)++;  printf("(*p)++ -> %d, a[0] = %d\n", x, a[0]);   /* read, then increment value */
    return 0;
}
```

```text filename:Output
*p++   -> 10, now *p = 20
*++p   -> 30
++*p   -> 11, a[0] = 11
(*p)++ -> 11, a[0] = 12
```

# Walking off the end

```c filename:C%20%E2%80%94%20heap-buffer-overflow%20caught%20by%20AddressSanitizer
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *a = malloc(3 * sizeof *a);
    if (!a) return 1;
    for (int *p = a; p <= a + 3; p++)   /* <= : writes a[3] */
        *p = 0;
    printf("%d\n", a[0]);
    free(a);
    return 0;
}
```

```question
If int \*p = (int \*)1000, what is p + 1?

---

`1004` on a platform with 4-byte `int` — pointer arithmetic scales by the size of the pointed-to type. For `char *` it would be `1001`, for `double *` `1008`.
```

```question
Can you subtract two pointers? Add them?

---

You can subtract two pointers into the same array: the result is the number of elements between them (`ptrdiff_t`). Adding two pointers is meaningless and a compile error.
```
