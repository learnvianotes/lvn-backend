---
id: 219495e0-7fad-7d90-b8f0-26acbd4f4588
key: topic:c/structs
subject: c
topic: structs
title: Structures
slug: structures
order: 1
---

A `struct` groups related values of different types into one object — C’s building block for records, and for every data structure.

# Define, initialise, access

```c filename:C
#include <stdio.h>
#include <string.h>

struct Student {
    int id;
    char name[20];
    double gpa;
};

int main(void) {
    struct Student a = {1, "Asha", 8.9};                        /* positional */
    struct Student b = {.name = "Ravi", .gpa = 7.5, .id = 2};   /* designated (C99) */
    struct Student c = {0};                                     /* all zero */

    c.id = 3;
    strcpy(c.name, "Meera");
    c.gpa = 9.2;

    struct Student *p = &c;
    p->gpa += 0.1;                     /* p->gpa is (*p).gpa */

    printf("%d %s %.1f\n", a.id, a.name, a.gpa);
    printf("%d %s %.1f\n", b.id, b.name, b.gpa);
    printf("%d %s %.1f\n", p->id, (*p).name, p->gpa);
    return 0;
}
```

```text filename:Output
1 Asha 8.9
2 Ravi 7.5
3 Meera 9.3
```

| Operator | Use with | Example |
| --- | --- | --- |
| `.` | a struct object | `s.gpa` |
| `->` | a pointer to a struct | `p->gpa` ≡ `(*p).gpa` |

# Copying, passing and returning

```c filename:C
#include <stdio.h>

typedef struct { double x, y; } Point;

Point midpoint(Point a, Point b) {          /* by value: copies in, copy out */
    return (Point){(a.x + b.x) / 2, (a.y + b.y) / 2};    /* compound literal */
}

void translate(Point *p, double dx, double dy) {         /* by pointer: modifies caller */
    p->x += dx;
    p->y += dy;
}

int main(void) {
    Point a = {0, 0}, b = {4, 2};
    Point m = midpoint(a, b);
    Point copy = m;                 /* struct assignment copies every member */
    translate(&m, 1, 1);
    printf("m=(%.1f,%.1f) copy=(%.1f,%.1f)\n", m.x, m.y, copy.x, copy.y);
    return 0;
}
```

```text filename:Output
m=(3.0,2.0) copy=(2.0,1.0)
```

> [!NOTE] Key point
>
> Structs <em>can</em> be assigned, passed and returned by value (arrays can’t). They <strong>cannot</strong> be compared with `==` — compare member by member. Pass large structs as `const T *` to avoid copying.

# Nested structs and arrays of structs

```c filename:C
#include <stdio.h>

struct Date { int d, m, y; };
struct Employee {
    char name[16];
    struct Date joined;           /* nested */
    double salary;
};

int main(void) {
    struct Employee staff[] = {
        {"Anil", {1, 4, 2020}, 50000},
        {"Bina", {15, 9, 2018}, 72000},
        {"Chen", {3, 1, 2022}, 61000},
    };
    int n = sizeof staff / sizeof staff[0];
    double total = 0;
    for (int i = 0; i < n; i++) {
        total += staff[i].salary;
        printf("%-5s joined %02d/%02d/%d\n", staff[i].name,
               staff[i].joined.d, staff[i].joined.m, staff[i].joined.y);
    }
    printf("average salary %.0f\n", total / n);
    return 0;
}
```

```text filename:Output
Anil  joined 01/04/2020
Bina  joined 15/09/2018
Chen  joined 03/01/2022
average salary 61000
```

# Self-referential structs

```c filename:C
#include <stdio.h>

struct Node {
    int value;
    struct Node *next;        /* a pointer to its own type is fine; a Node member is not */
};

int main(void) {
    struct Node c = {3, NULL}, b = {2, &c}, a = {1, &b};
    for (struct Node *n = &a; n != NULL; n = n->next) printf("%d -> ", n->value);
    printf("NULL\n");
    return 0;
}
```

```text filename:Output
1 -> 2 -> 3 -> NULL
```

# Flexible array member (C99)

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    size_t len;
    char data[];               /* flexible array member: must be last */
} Buffer;

int main(void) {
    const char *text = "variable length";
    size_t n = strlen(text) + 1;
    Buffer *b = malloc(sizeof *b + n);   /* header + payload in ONE allocation */
    if (!b) return 1;
    b->len = n - 1;
    memcpy(b->data, text, n);
    printf("%zu: %s (sizeof Buffer = %zu)\n", b->len, b->data, sizeof(Buffer));
    free(b);
    return 0;
}
```

```text filename:Output
15: variable length (sizeof Buffer = 8)
```

# Opaque types: encapsulation in C

Declaring `struct Stack;` in a header without its body (an <em>incomplete type</em>) lets users hold `struct Stack *` but not touch the fields — only functions in `stack.c` can. This is how `FILE` works.

```c filename:C%20%E2%80%94%20header%20of%20an%20opaque%20type%20(compile-checked)
/* stack.h */
typedef struct Stack Stack;           /* opaque: fields hidden */
Stack *stack_new(void);
void   stack_push(Stack *s, int v);
int    stack_pop(Stack *s);
void   stack_free(Stack *s);
```

```question
What is the difference between . and -&gt; ?

---

`.` accesses a member of a struct <em>object</em>; `->` accesses a member through a <em>pointer</em> to a struct. `p->m` is shorthand for `(*p).m`.
```

```question
Can you compare two structs with ==?

---

No — C does not define `==` for structs. Compare members individually. `memcmp` is unreliable because padding bytes have unspecified values (and floating-point `-0.0`/`NaN` compare differently from their bytes).
```

```question
Why can't a struct contain a member of its own type?

---

It would have infinite size. It can contain a <em>pointer</em> to its own type, because a pointer has a fixed size — that is how linked lists and trees are built.
```
