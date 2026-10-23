---
id: a05196d5-1f58-723a-8a8f-bd53051ffa44
key: topic:c/loops
subject: c
topic: loops
title: "Loops: for, while, do-while"
slug: loops-for-while-do-while
order: 1
---

Three loop forms, plus `break`, `continue` and (rarely) `goto`. Pick `for` when you count, `while` when you wait for a condition, `do-while` when the body must run at least once.

# The three loops

```c filename:C
#include <stdio.h>

int main(void) {
    for (int i = 0; i < 5; i++)          /* init; condition; step */
        printf("%d ", i);
    printf("\n");

    int n = 1234, digits = 0;
    while (n != 0) {                     /* test before each iteration */
        n /= 10;
        digits++;
    }
    printf("digits = %d\n", digits);

    int k = 100;
    do {                                 /* body runs at least once */
        printf("k = %d\n", k);
    } while (k < 10);
    return 0;
}
```

```text filename:Output
0 1 2 3 4
digits = 4
k = 100
```

# break and continue

```c filename:C
#include <stdio.h>

int main(void) {
    for (int i = 1; i <= 10; i++) {
        if (i % 2 == 0) continue;   /* skip even numbers */
        if (i > 7) break;           /* leave the loop entirely */
        printf("%d ", i);
    }
    printf("\n");
    return 0;
}
```

```text filename:Output
1 3 5 7
```

# Nested loops and patterns

```c filename:C
#include <stdio.h>

int main(void) {
    int n = 4;
    for (int row = 1; row <= n; row++) {
        for (int s = 0; s < n - row; s++) putchar('.');
        for (int star = 0; star < 2 * row - 1; star++) putchar('*');
        putchar('\n');
    }
    return 0;
}
```

```text filename:Output
...*
..***
.*****
*******
```

# Breaking out of nested loops: goto

```c filename:C
#include <stdio.h>

int main(void) {
    int grid[3][3] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
    int target = 5;
    for (int r = 0; r < 3; r++)
        for (int c = 0; c < 3; c++)
            if (grid[r][c] == target) {
                printf("found at (%d,%d)\n", r, c);
                goto done;              /* one of the few acceptable uses */
            }
    printf("not found\n");
done:
    return 0;
}
```

```text filename:Output
found at (1,1)
```

> [!NOTE] goto
>
> `goto` is legitimate in C for two idioms: leaving deeply nested loops and the <em>single cleanup exit</em> pattern (`goto cleanup;` to free resources in reverse order — used throughout the Linux kernel). Never jump backwards to build loops.

# Loop idioms

| Idiom | Code |
| --- | --- |
| Infinite loop | `for (;;) { … }` or `while (1) { … }` |
| Iterate an array | `for (size_t i = 0; i < n; i++)` |
| Count down with `size_t` | `for (size_t i = n; i-- > 0; )` (avoids the unsigned wrap trap) |
| Read until EOF | `while ((c = getchar()) != EOF)` |
| Two indexes | `for (int i = 0, j = n - 1; i < j; i++, j--)` |

```c filename:C
#include <stdio.h>

int main(void) {
    int a[] = {1, 2, 3, 4, 5};
    size_t n = sizeof a / sizeof a[0];
    for (size_t i = n; i-- > 0; )           /* safe reverse loop with unsigned index */
        printf("%d ", a[i]);
    printf("\n");
    for (int i = 0, j = (int)n - 1; i < j; i++, j--) {   /* reverse in place */
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }
    for (size_t i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
5 4 3 2 1
5 4 3 2 1
```

> [!WARNING] Watch out
>
> Off-by-one: `for (i = 0; i <= n; i++)` over an array of `n` elements touches `a[n]` — one past the end. That is a buffer overflow (see Memory Bugs).

```question
What is the difference between while and do-while?

---

`while` checks the condition <em>before</em> each iteration, so the body may run zero times. `do-while` checks <em>after</em>, so the body always runs at least once — useful for menus and input validation loops.
```

```question
Why is for (unsigned i = n - 1; i &gt;= 0; i--) an infinite loop?

---

An unsigned value is always `>= 0`; when `i` is 0, `i--` wraps to `UINT_MAX`. Use a signed index or the `for (size_t i = n; i-- > 0; )` idiom.
```
