---
id: b7f7e3d1-bfcd-7ecf-ab8d-eaf665753971
key: topic:c/function-pointers
subject: c
topic: function-pointers
title: Function Pointers & Callbacks
slug: function-pointers-callbacks
order: 1
---

A function’s name decays to its address. Storing that in a <em>function pointer</em> lets you pass behaviour as data — callbacks, dispatch tables, plug-in strategies, `qsort` comparators.

# Syntax

```c filename:C
#include <stdio.h>

int add(int a, int b) { return a + b; }
int mul(int a, int b) { return a * b; }

int main(void) {
    int (*op)(int, int) = add;        /* pointer to function taking (int,int) returning int */
    printf("%d\n", op(3, 4));
    op = &mul;                        /* & is optional */
    printf("%d\n", (*op)(3, 4));      /* explicit * is optional too */
    return 0;
}
```

```text filename:Output
7
12
```

> [!NOTE] Key point
>
> `int (*op)(int, int)` — the parentheses matter. `int *op(int, int)` would declare a <em>function</em> returning `int *`. A `typedef` makes it readable: `typedef int (*binop)(int, int);`.

# Callbacks: qsort

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int cmp_int_asc(const void *a, const void *b) {
    int x = *(const int *)a, y = *(const int *)b;
    return (x > y) - (x < y);         /* avoids overflow of x - y */
}

int cmp_str(const void *a, const void *b) {
    return strcmp(*(const char *const *)a, *(const char *const *)b);
}

int main(void) {
    int nums[] = {42, -7, 19, 0, 3};
    qsort(nums, 5, sizeof nums[0], cmp_int_asc);
    for (int i = 0; i < 5; i++) printf("%d ", nums[i]);
    printf("\n");

    const char *words[] = {"pear", "apple", "fig"};
    qsort(words, 3, sizeof words[0], cmp_str);
    printf("%s %s %s\n", words[0], words[1], words[2]);

    int key = 19;
    int *hit = bsearch(&key, nums, 5, sizeof nums[0], cmp_int_asc);
    printf("19 at index %td\n", hit - nums);
    return 0;
}
```

```text filename:Output
-7 0 3 19 42
apple fig pear
19 at index 3
```

> [!WARNING] Watch out
>
> `return x - y;` in a comparator overflows for large values of opposite sign (`INT_MIN - 1`). Use `(x > y) - (x < y)`.

# Your own higher-order function

```c filename:C
#include <stdio.h>

typedef int (*transform_fn)(int);

int square(int x) { return x * x; }
int negate(int x) { return -x; }

void map(int *a, int n, transform_fn f) {
    for (int i = 0; i < n; i++) a[i] = f(a[i]);
}

int main(void) {
    int v[] = {1, 2, 3};
    map(v, 3, square);
    map(v, 3, negate);
    printf("%d %d %d\n", v[0], v[1], v[2]);
    return 0;
}
```

```text filename:Output
-1 -4 -9
```

# Dispatch tables

```c filename:C
#include <stdio.h>

double add(double a, double b) { return a + b; }
double sub(double a, double b) { return a - b; }
double mul(double a, double b) { return a * b; }
double dvd(double a, double b) { return a / b; }

int main(void) {
    struct { char sym; double (*fn)(double, double); } ops[] = {
        {'+', add}, {'-', sub}, {'*', mul}, {'/', dvd},
    };
    for (int i = 0; i < 4; i++)
        printf("8 %c 2 = %g\n", ops[i].sym, ops[i].fn(8, 2));
    return 0;
}
```

```text filename:Output
8 + 2 = 10
8 - 2 = 6
8 * 2 = 16
8 / 2 = 4
```

# Callbacks with context

```c filename:C
#include <stdio.h>

/* C has no closures: pass state through a void * "user data" pointer */
void for_each(const int *a, int n, void (*visit)(int, void *), void *ctx) {
    for (int i = 0; i < n; i++) visit(a[i], ctx);
}

void accumulate(int x, void *ctx) { *(long *)ctx += x; }

int main(void) {
    int a[] = {5, 10, 20};
    long total = 0;
    for_each(a, 3, accumulate, &total);
    printf("total = %ld\n", total);
    return 0;
}
```

```text filename:Output
total = 35
```

```question
How do you declare a function that returns a function pointer?

---

Directly: `int (*get_op(char c))(int, int);` — `get_op` takes a `char` and returns a pointer to a function `(int, int) -> int`. With a typedef it is readable: `typedef int (*binop)(int, int); binop get_op(char c);`.
```

```question
What are function pointers used for in real systems?

---

Callbacks (`qsort`, `bsearch`, `atexit`, `signal`, event handlers), dispatch/jump tables for interpreters and state machines, plug-in interfaces (a struct of function pointers is C's version of a vtable — e.g. Linux `struct file_operations`), and dynamic loading with `dlsym`.
```
