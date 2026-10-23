---
id: a6e12855-b76c-7c4b-9c4b-7db014506eae
key: topic:c/doubly-linked-list
subject: c
topic: doubly-linked-list
title: Doubly & Circular Linked Lists
slug: doubly-circular-linked-lists
order: 1
---

A doubly linked list stores `prev` and `next` pointers, so a node can be removed in O(1) given only a pointer to it and the list can be walked both ways.

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct DNode {
    int data;
    struct DNode *prev, *next;
} DNode;

/* circular list with a sentinel: no NULL checks at the ends */
typedef struct { DNode head; size_t size; } List;

void list_init(List *l) { l->head.prev = l->head.next = &l->head; l->size = 0; }

void insert_after(List *l, DNode *pos, int v) {
    DNode *n = malloc(sizeof *n);
    if (!n) exit(1);
    n->data = v;
    n->prev = pos;
    n->next = pos->next;
    pos->next->prev = n;
    pos->next = n;
    l->size++;
}

void push_front(List *l, int v) { insert_after(l, &l->head, v); }
void push_back(List *l, int v)  { insert_after(l, l->head.prev, v); }

void unlink_node(List *l, DNode *n) {        /* O(1): no search for the predecessor */
    n->prev->next = n->next;
    n->next->prev = n->prev;
    free(n);
    l->size--;
}

void print(const List *l) {
    for (const DNode *n = l->head.next; n != &l->head; n = n->next) printf("%d ", n->data);
    printf("| backwards: ");
    for (const DNode *n = l->head.prev; n != &l->head; n = n->prev) printf("%d ", n->data);
    printf("(size %zu)\n", l->size);
}

int main(void) {
    List l;
    list_init(&l);
    push_back(&l, 2); push_back(&l, 3); push_front(&l, 1); push_back(&l, 4);
    print(&l);
    unlink_node(&l, l.head.next->next);       /* remove the 2 */
    print(&l);
    while (l.size) unlink_node(&l, l.head.next);
    print(&l);
    return 0;
}
```

```text filename:Output
1 2 3 4 | backwards: 4 3 2 1 (size 4)
1 3 4 | backwards: 4 3 1 (size 3)
| backwards: (size 0)
```

> [!NOTE] Key point
>
> A <strong>sentinel</strong> (dummy head) node makes the list circular and never empty, which removes every special case for the first and last element. The Linux kernel’s `list_head` uses this design.

| Variant | Pros | Cons |
| --- | --- | --- |
| Singly linked | Smallest nodes, simplest | Can’t go back; deleting needs the predecessor |
| Doubly linked | O(1) delete of any node, both directions | Two pointers per node |
| Circular | Round-robin traversal; no NULL end | Must stop by comparing with the start |

```question
Why is deletion O(1) in a doubly linked list but O(n) in a singly linked one?

---

To unlink a node you must update its predecessor’s `next`. A doubly linked node knows its predecessor (`prev`); in a singly linked list you have to walk from the head to find it (unless you already hold it).
```
