---
id: f5f6f1d0-7080-76ac-8e7b-5730381b321f
key: topic:c/multi-dimensional-arrays
subject: c
topic: multi-dimensional-arrays
title: Multi-dimensional Arrays
slug: multi-dimensional-arrays
order: 1
---

A 2-D array in C is an <em>array of arrays</em>, stored <strong>row by row</strong> (row-major) in one contiguous block.

```c filename:C
#include <stdio.h>

int main(void) {
    int m[2][3] = {
        {1, 2, 3},
        {4, 5, 6},
    };
    for (int r = 0; r < 2; r++) {
        for (int c = 0; c < 3; c++) printf("%d ", m[r][c]);
        printf("\n");
    }
    printf("sizeof m = %zu, sizeof m[0] = %zu\n", sizeof m, sizeof m[0]);

    int *flat = &m[0][0];               /* row-major: rows are laid end to end */
    for (int i = 0; i < 6; i++) printf("%d ", flat[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
1 2 3
4 5 6
sizeof m = 24, sizeof m[0] = 12
1 2 3 4 5 6
```

`address of m[r][c] = base + (r × COLS + c) × sizeof(element)`

# Passing a 2-D array to a function

All dimensions except the first must be known to the function, because the compiler needs the row length to compute `m[r][c]`.

```c filename:C
#include <stdio.h>

#define COLS 3

int trace_like_sum(int m[][COLS], int rows) {        /* fixed column count */
    int s = 0;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < COLS; c++) s += m[r][c];
    return s;
}

void print_matrix(int rows, int cols, int m[rows][cols]) {   /* C99 VLA parameter */
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) printf("%3d", m[r][c]);
        printf("\n");
    }
}

int main(void) {
    int a[2][COLS] = {{1, 2, 3}, {4, 5, 6}};
    printf("sum = %d\n", trace_like_sum(a, 2));
    print_matrix(2, COLS, a);
    return 0;
}
```

```text filename:Output
sum = 21
  1  2  3
  4  5  6
```

# Matrix multiplication

```c filename:C
#include <stdio.h>

int main(void) {
    int A[2][3] = {{1, 2, 3}, {4, 5, 6}};
    int B[3][2] = {{7, 8}, {9, 10}, {11, 12}};
    int C[2][2] = {{0}};
    for (int i = 0; i < 2; i++)
        for (int j = 0; j < 2; j++)
            for (int k = 0; k < 3; k++)
                C[i][j] += A[i][k] * B[k][j];
    printf("%d %d\n%d %d\n", C[0][0], C[0][1], C[1][0], C[1][1]);
    return 0;
}
```

```text filename:Output
58 64
139 154
```

# Arrays of strings

```c filename:C
#include <stdio.h>

int main(void) {
    char names[3][8] = {"Ann", "Bob", "Charlie"};    /* 2-D char array: 24 bytes */
    const char *langs[] = {"C", "Go", "Rust"};       /* array of pointers */
    for (int i = 0; i < 3; i++) printf("%s/%s ", names[i], langs[i]);
    printf("\n%zu %zu\n", sizeof names, sizeof langs);
    return 0;
}
```

```text filename:Output
Ann/C Bob/Go Charlie/Rust
24 24
```

| `char names[3][8]` | `const char *langs[3]` |
| --- | --- |
| 3 × 8 bytes, each row a writable copy | 3 pointers to string literals (read-only) |
| Rows have a fixed maximum length | Each string can have any length |
| Wastes space for short strings | Only pointer overhead |

> [!NOTE] Performance
>
> Iterate row by row (`for r … for c …`) — row-major order visits memory sequentially and is cache-friendly. Swapping the loops on a big matrix can be several times slower.

```question
How is int a\[3\]\[4\] laid out in memory?

---

As 12 consecutive `int`s: row 0 (4 ints), then row 1, then row 2. `a[i]` is an `int[4]` array, `a` decays to `int (*)[4]` (pointer to a row), and `a[i][j]` is `*(*(a + i) + j)`.
```

```question
Why must a function parameter for a 2-D array specify the column count?

---

To compute the address of `m[r][c]` the compiler needs the length of each row (`r × COLS + c`). The first dimension is not needed because the parameter is really a pointer to a row.
```
