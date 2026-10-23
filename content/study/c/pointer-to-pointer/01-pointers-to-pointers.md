---
id: 7e01ab47-7887-7073-a223-c535964ad5ed
key: topic:c/pointer-to-pointer
subject: c
topic: pointer-to-pointer
title: Pointers to Pointers
slug: pointers-to-pointers
order: 1
---

A `T **` points to a `T *`. You need one whenever a function must change <em>which</em> object a caller’s pointer refers to — and for arrays of strings like `argv`.

```c filename:C
#include <stdio.h>

int main(void) {
    int x = 5;
    int *p = &x;
    int **pp = &p;
    **pp = 50;                         /* x = 50 */
    printf("%d %d %d\n", x, *p, **pp);
    printf("%d %d\n", *pp == p, p == &x);
    return 0;
}
```

```text filename:Output
50 50 50
1 1
```

`pp` (`int **`) → `p` (`int *`) → `x` (`int`) = 50

# Changing the caller's pointer

```c filename:C
#include <stdio.h>
#include <stdlib.h>

/* allocate and hand back through an out-parameter */
int make_array(int **out, int n) {
    int *a = malloc(n * sizeof *a);
    if (!a) return -1;
    for (int i = 0; i < n; i++) a[i] = i * 10;
    *out = a;                        /* modifies the caller's pointer */
    return 0;
}

void free_and_null(int **p) {
    free(*p);
    *p = NULL;                       /* caller's pointer no longer dangles */
}

int main(void) {
    int *data = NULL;
    if (make_array(&data, 4) == 0) printf("%d %d\n", data[1], data[3]);
    free_and_null(&data);
    printf("data is %s\n", data == NULL ? "NULL" : "set");
    return 0;
}
```

```text filename:Output
10 30
data is NULL
```

# Dynamic 2-D arrays (jagged)

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int rows = 3;
    int **tri = malloc(rows * sizeof *tri);          /* array of row pointers */
    if (!tri) return 1;
    for (int r = 0; r < rows; r++) {
        tri[r] = malloc((r + 1) * sizeof **tri);      /* each row its own length */
        if (!tri[r]) return 1;
        for (int c = 0; c <= r; c++)
            tri[r][c] = (c == 0 || c == r) ? 1 : tri[r - 1][c - 1] + tri[r - 1][c];
    }
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c <= r; c++) printf("%d ", tri[r][c]);
        printf("\n");
        free(tri[r]);                                  /* free rows first... */
    }
    free(tri);                                         /* ...then the spine */
    return 0;
}
```

```text filename:Output
1
1 1
1 2 1
```

> [!NOTE] Key point
>
> A contiguous alternative is one `malloc(rows * cols * sizeof(int))` indexed as `a[r * cols + c]`, or a pointer to a VLA row type: `int (*m)[cols] = malloc(rows * sizeof *m);` — one allocation, one `free`, cache-friendly.

# Linked-list insertion with `**`

```c filename:C
#include <stdio.h>
#include <stdlib.h>

struct node { int val; struct node *next; };

/* inserting at the head changes the caller's head pointer */
void push(struct node **head, int v) {
    struct node *n = malloc(sizeof *n);
    if (!n) return;
    n->val = v;
    n->next = *head;
    *head = n;
}

int main(void) {
    struct node *head = NULL;
    push(&head, 3); push(&head, 2); push(&head, 1);
    for (struct node *n = head; n; n = n->next) printf("%d ", n->val);
    printf("\n");
    while (head) { struct node *next = head->next; free(head); head = next; }
    return 0;
}
```

```text filename:Output
1 2 3
```

```question
When do you need a double pointer?

---

When a function must modify a pointer owned by the caller (allocate into it, reset it to `NULL`, change a list head), and to represent arrays of pointers — `char **argv`, jagged 2-D arrays, arrays of strings.
```
