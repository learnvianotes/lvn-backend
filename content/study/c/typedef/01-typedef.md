---
id: c442c223-5305-7f90-b335-6a9a433ab2e5
key: topic:c/typedef
subject: c
topic: typedef
title: typedef
slug: typedef
order: 1
---

`typedef` creates an <em>alias</em> for an existing type — shorter names, clearer intent and a single place to change a type. It never creates a new, distinct type.

```c filename:C
#include <stdio.h>
#include <stdint.h>

typedef unsigned long ulong;                 /* shorter name */
typedef int32_t Meters;                      /* documents intent (still an int32_t) */
typedef struct { double re, im; } Complex;   /* anonymous struct, used without 'struct' */
typedef int (*Compare)(int, int);            /* function pointer type */
typedef char Name[32];                       /* array type */

int ascending(int a, int b) { return a - b; }

int main(void) {
    ulong big = 123456789UL;
    Meters height = 8849;
    Complex z = {1.5, -2.0};
    Compare cmp = ascending;
    Name who = "Tenzing";
    printf("%lu %d %.1f%+.1fi %d %s %zu\n", big, height, z.re, z.im, cmp(3, 1), who, sizeof(Name));
    return 0;
}
```

```text filename:Output
123456789 8849 1.5-2.0i 2 Tenzing 32
```

# typedef struct patterns

```c filename:C
#include <stdio.h>
#include <stdlib.h>

/* tag + typedef: the tag is needed for the self-reference inside the body */
typedef struct Node {
    int value;
    struct Node *next;
} Node;

int main(void) {
    Node second = {2, NULL};
    Node first = {1, &second};
    struct Node *same = &first;          /* both names work */
    printf("%d %d\n", same->value, first.next->value);
    return 0;
}
```

```text filename:Output
1 2
```

# typedef vs #define

```c filename:C
#include <stdio.h>

#define PTR_D int *
typedef int *PtrT;

int main(void) {
    int x = 1, y = 2;
    PTR_D a, b;       /* expands to: int *a, b;  -> b is an int! */
    PtrT  c, d;       /* both are int *                         */
    a = &x; b = y;
    c = &x; d = &y;
    printf("%zu %zu %zu %zu\n", sizeof a, sizeof b, sizeof c, sizeof d);
    return 0;
}
```

```text filename:Output
8 4 8 8
```

> [!TIP] Do
>
> Use `typedef` for function-pointer types, opaque handles and platform-dependent types (`size_t`, `uint32_t` are typedefs).

> [!DANGER] Avoid
>
> Hide pointers behind typedefs for ordinary data (`typedef struct node *NodePtr;`) — readers lose track of what is a pointer. The Linux kernel style bans most struct typedefs for this reason.

> [!NOTE] Key point
>
> Names ending in `_t` are reserved by POSIX for future system types; in portable code prefer `Name` or `name_type`.

```question
Does typedef create a new type?

---

No. It creates an alias: `typedef int Meters;` makes `Meters` and `int` fully interchangeable, with no extra type checking. To get a distinct type in C, wrap the value in a single-member `struct`.
```
