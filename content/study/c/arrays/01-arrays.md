---
id: 3eb92f33-c653-7d2c-8a85-8ca28766d4a7
key: topic:c/arrays
subject: c
topic: arrays
title: Arrays
slug: arrays
order: 1
---

An array is a fixed-size block of <em>contiguous</em> elements of one type, indexed from 0. C never checks the index — staying in bounds is your job.

# Declaring and initialising

```c filename:C
#include <stdio.h>

int main(void) {
    int a[5] = {10, 20, 30, 40, 50};
    int b[5] = {1, 2};              /* rest are zero: 1 2 0 0 0 */
    int c[] = {7, 8, 9};            /* size deduced: 3 */
    int d[5] = {0};                 /* all zeros */
    int e[6] = {[2] = 5, [4] = 9};  /* designated initializers (C99) */

    size_t n = sizeof a / sizeof a[0];     /* element count */
    printf("n=%zu sizeof(c)=%zu\n", n, sizeof c);
    for (int i = 0; i < 5; i++) printf("%d ", b[i]);
    printf("| %d | ", d[3]);
    for (int i = 0; i < 6; i++) printf("%d ", e[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
n=5 sizeof(c)=12
1 2 0 0 0 | 0 | 0 0 5 0 9 0
```

> [!NOTE] Key point
>
> `sizeof arr / sizeof arr[0]` gives the element count — but <strong>only</strong> where `arr` is a real array. Inside a function that received it as a parameter, `arr` is a pointer and the trick silently returns 2 (8 / 4).

# Memory layout

| Index | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| Value | 10 | 20 | 30 | 40 | 50 |
| Offset (bytes) | 0 | 4 | 8 | 12 | 16 |

`a[i]` is defined as `*(a + i)`: start address plus `i × sizeof(int)`. That is why indexing is O(1) — and why an index past the end silently reads whatever lies next in memory.

# Passing arrays to functions

```c filename:C
#include <stdio.h>

/* the array decays to a pointer: the size must travel separately */
int max_of(const int arr[], size_t n) {
    int best = arr[0];
    for (size_t i = 1; i < n; i++)
        if (arr[i] > best) best = arr[i];
    return best;
}

void double_all(int *arr, size_t n) {     /* same as int arr[] */
    for (size_t i = 0; i < n; i++) arr[i] *= 2;
}

int main(void) {
    int v[] = {3, 9, 2, 7};
    size_t n = sizeof v / sizeof v[0];
    double_all(v, n);                      /* modifies the caller's array */
    printf("max = %d, v[0] = %d\n", max_of(v, n), v[0]);
    return 0;
}
```

```text filename:Output
max = 18, v[0] = 6
```

# Common array algorithms

```c filename:C
#include <stdio.h>

int main(void) {
    int a[] = {4, -1, 7, 3, 7, 0};
    int n = sizeof a / sizeof a[0];

    int sum = 0, maxi = 0;
    for (int i = 0; i < n; i++) {
        sum += a[i];
        if (a[i] > a[maxi]) maxi = i;
    }
    printf("sum=%d max=%d at %d\n", sum, a[maxi], maxi);

    /* linear search */
    int key = 3, pos = -1;
    for (int i = 0; i < n; i++) if (a[i] == key) { pos = i; break; }
    printf("3 found at %d\n", pos);

    /* rotate left by one */
    int first = a[0];
    for (int i = 0; i < n - 1; i++) a[i] = a[i + 1];
    a[n - 1] = first;
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
sum=20 max=7 at 2
3 found at 3
-1 7 3 7 0 4
```

# Variable-length arrays (C99)

```c filename:C
#include <stdio.h>

int main(void) {
    int n = 4;
    int squares[n];                   /* size known only at run time: VLA on the stack */
    for (int i = 0; i < n; i++) squares[i] = i * i;
    printf("%d %zu\n", squares[3], sizeof squares);
    return 0;
}
```

```text filename:Output
9 16
```

> [!WARNING] Watch out
>
> VLAs live on the stack: a large or attacker-controlled size overflows the stack with no error reported. They became <em>optional</em> in C11, and the Linux kernel bans them. Prefer `malloc` for run-time sizes.

# Out of bounds is undefined behaviour

```c filename:C%20%E2%80%94%20caught%20by%20the%20sanitizer
#include <stdio.h>

int main(void) {
    int a[5] = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int i = 0; i <= 5; i++)    /* off by one: touches a[5] */
        sum += a[i];
    printf("%d\n", sum);
    return 0;
}
```

```text filename:UBSan
main.c:7:16: runtime error: index 5 out of bounds for type 'int[5]'
```

> [!TIP] Do
>
> Keep the length next to the pointer (`const int *a, size_t n`), and loop with `i < n`.

> [!DANGER] Avoid
>
> Rely on a sentinel you never wrote, or on `sizeof` of a parameter.

```question
Why can't you assign one array to another with =?

---

An array is not a modifiable lvalue: in most expressions its name decays to a pointer to its first element, so `a = b` would mean assigning to an address. Copy element by element or with `memcpy(a, b, sizeof a)`. (Wrapping an array in a `struct` makes it copyable by assignment.)
```

```question
What is array decay?

---

In almost every expression, an array of `T` is converted to a pointer to its first element (`T *`). The exceptions are `sizeof arr`, `&arr` and a string literal used to initialise a `char` array. Decay is why functions cannot know an array's length.
```
