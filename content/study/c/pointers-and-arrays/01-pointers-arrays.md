---
id: fe7a8add-8fd9-7d3a-af99-634845df2caf
key: topic:c/pointers-and-arrays
subject: c
topic: pointers-and-arrays
title: Pointers & Arrays
slug: pointers-arrays
order: 1
---

Arrays and pointers are closely related but <strong>not</strong> the same thing: an array <em>is</em> storage; a pointer <em>refers to</em> storage. The link is decay — an array name converts to a pointer to its first element.

`a[i] ≡ *(a + i) ≡ *(i + a) ≡ i[a]`

```c filename:C
#include <stdio.h>

int main(void) {
    int a[4] = {1, 2, 3, 4};
    int *p = a;                      /* decay: p = &a[0] */

    printf("%d %d %d %d\n", a[2], *(a + 2), p[2], 2[a]);   /* all the same */
    printf("sizeof a = %zu, sizeof p = %zu\n", sizeof a, sizeof p);

    p++;                             /* a pointer can move... */
    printf("*p = %d\n", *p);
    /* a++;  ...an array cannot: error, array type is not assignable */
    return 0;
}
```

```text filename:Output
3 3 3 3
sizeof a = 16, sizeof p = 8
*p = 2
```

|  | Array `int a[4]` | Pointer `int *p` |
| --- | --- | --- |
| What it is | 4 ints of storage | 8 bytes holding an address |
| `sizeof` | 16 | 8 |
| Assignable (`a = …`) | No | Yes |
| `&x` | `int (*)[4]` — pointer to the whole array | `int **` |
| Where the data is | Inside the array itself | Somewhere else |

# &amp;a vs a: same address, different types

```c filename:C
#include <stdio.h>

int main(void) {
    int a[4] = {0};
    int *first = a;              /* int *      */
    int (*whole)[4] = &a;        /* int (*)[4] */
    printf("same address: %d\n", (void *)first == (void *)whole);
    printf("first + 1 moves %td bytes\n", (char *)(first + 1) - (char *)first);
    printf("whole + 1 moves %td bytes\n", (char *)(whole + 1) - (char *)whole);
    return 0;
}
```

```text filename:Output
same address: 1
first + 1 moves 4 bytes
whole + 1 moves 16 bytes
```

# Arrays of pointers vs pointer to array

```c filename:C
#include <stdio.h>

int main(void) {
    int x = 1, y = 2, z = 3;
    int *arr_of_ptrs[3] = {&x, &y, &z};    /* 3 pointers */
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
    int (*row)[3] = grid;                  /* pointer to an array of 3 ints */

    printf("%d %d\n", *arr_of_ptrs[1], *arr_of_ptrs[2]);
    row++;                                 /* moves one whole row */
    printf("%d %d\n", (*row)[0], row[0][2]);
    return 0;
}
```

```text filename:Output
2 3
4 6
```

# sizeof inside a function

```c filename:C%20%E2%80%94%20clang%20flags%20the%20misleading%20sizeof%20(-Wsizeof-array-argument)
#include <stdio.h>

void f(int arr[10]) {                    /* the 10 is ignored: arr is int * */
    printf("in f: %zu\n", sizeof arr);
}

int main(void) {
    int data[10];
    printf("in main: %zu\n", sizeof data);
    f(data);
    return 0;
}
```

```question
Are arrays and pointers the same in C?

---

No. An array is a contiguous block of objects; a pointer is a single variable holding an address. They behave alike because an array expression decays to a pointer to its first element and `a[i]` is defined via pointer arithmetic. They differ in `sizeof`, in assignability and in what `&` produces.
```

```question
What does int (\*p)\[5\] declare, versus int \*p\[5\]?

---

`int (*p)[5]` is <em>one</em> pointer to an array of 5 ints (used to walk 2-D arrays row by row). `int *p[5]` is an <em>array of 5 pointers</em> to int — `[]` binds tighter than `*`.
```
