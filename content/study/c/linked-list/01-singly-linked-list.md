---
id: 9612bea0-9536-7669-9c1f-2db836eb351c
key: topic:c/linked-list
subject: c
topic: linked-list
title: Singly Linked List
slug: singly-linked-list
order: 1
---

A chain of heap-allocated nodes, each pointing to the next. O(1) insertion at the head, O(n) search — and the most common C interview data structure.

`head` → \[1 | •\] → \[2 | •\] → \[3 | •\] → `NULL`

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node *new_node(int v) {
    Node *n = malloc(sizeof *n);
    if (!n) { perror("malloc"); exit(EXIT_FAILURE); }
    n->data = v;
    n->next = NULL;
    return n;
}

void push_front(Node **head, int v) {        /* O(1) */
    Node *n = new_node(v);
    n->next = *head;
    *head = n;
}

void push_back(Node **head, int v) {         /* O(n): walk to the tail */
    Node **pp = head;
    while (*pp) pp = &(*pp)->next;
    *pp = new_node(v);
}

int remove_value(Node **head, int v) {       /* pointer-to-pointer: no special case for head */
    for (Node **pp = head; *pp; pp = &(*pp)->next) {
        if ((*pp)->data == v) {
            Node *dead = *pp;
            *pp = dead->next;
            free(dead);
            return 1;
        }
    }
    return 0;
}

void reverse(Node **head) {                  /* O(n), O(1) space */
    Node *prev = NULL, *cur = *head;
    while (cur) {
        Node *next = cur->next;
        cur->next = prev;
        prev = cur;
        cur = next;
    }
    *head = prev;
}

void print(const Node *n) {
    for (; n; n = n->next) printf("%d -> ", n->data);
    printf("NULL\n");
}

void free_list(Node *n) {
    while (n) { Node *next = n->next; free(n); n = next; }
}

int main(void) {
    Node *head = NULL;
    push_back(&head, 2);
    push_back(&head, 3);
    push_front(&head, 1);
    push_back(&head, 4);
    print(head);
    remove_value(&head, 1);
    remove_value(&head, 3);
    print(head);
    reverse(&head);
    print(head);
    free_list(head);
    return 0;
}
```

```text filename:Output
1 -> 2 -> 3 -> 4 -> NULL
2 -> 4 -> NULL
4 -> 2 -> NULL
```

# Classic interview operations

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct Node { int data; struct Node *next; } Node;

Node *build(const int *a, int n) {
    Node *head = NULL, **tail = &head;
    for (int i = 0; i < n; i++) {
        *tail = malloc(sizeof **tail);
        if (!*tail) exit(1);
        (*tail)->data = a[i];
        (*tail)->next = NULL;
        tail = &(*tail)->next;
    }
    return head;
}

Node *middle(Node *head) {                   /* slow/fast pointers */
    Node *slow = head, *fast = head;
    while (fast && fast->next) { slow = slow->next; fast = fast->next->next; }
    return slow;
}

int has_cycle(const Node *head) {            /* Floyd's tortoise and hare */
    const Node *slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return 1;
    }
    return 0;
}

Node *merge_sorted(Node *a, Node *b) {       /* splice two sorted lists */
    Node dummy = {0, NULL}, *t = &dummy;
    while (a && b) {
        if (a->data <= b->data) { t->next = a; a = a->next; }
        else                    { t->next = b; b = b->next; }
        t = t->next;
    }
    t->next = a ? a : b;
    return dummy.next;
}

int main(void) {
    int x[] = {1, 4, 7, 9, 12};
    int y[] = {2, 3, 10};
    Node *a = build(x, 5), *b = build(y, 3);
    printf("middle of a: %d\n", middle(a)->data);
    printf("cycle? %d\n", has_cycle(a));

    Node *m = merge_sorted(a, b);
    for (Node *n = m; n; n = n->next) printf("%d ", n->data);
    printf("\n");

    Node *last = m;                          /* make a cycle to test detection */
    while (last->next) last = last->next;
    last->next = m->next->next;
    printf("cycle? %d\n", has_cycle(m));
    last->next = NULL;                       /* break it again before freeing */

    while (m) { Node *next = m->next; free(m); m = next; }
    return 0;
}
```

```text filename:Output
middle of a: 7
cycle? 0
1 2 3 4 7 9 10 12
cycle? 1
```

| Operation | Singly linked list | Array |
| --- | --- | --- |
| Access k-th | O(n) | O(1) |
| Insert/delete at head | O(1) | O(n) |
| Insert/delete after a known node | O(1) | O(n) |
| Search | O(n) | O(n) (O(log n) if sorted) |
| Memory | Extra pointer per node; scattered (cache-unfriendly) | Contiguous |

```question
How do you reverse a singly linked list?

---

Iteratively with three pointers: `prev = NULL`, `cur = head`; for each node save `next`, point `cur->next` to `prev`, then advance `prev = cur`, `cur = next`. At the end `prev` is the new head. O(n) time, O(1) space.
```

```question
How do you detect a cycle in a linked list?

---

Floyd’s algorithm: move a slow pointer one step and a fast pointer two steps; if they ever meet there is a cycle, if the fast pointer reaches `NULL` there isn’t. To find the cycle start, reset one pointer to the head and move both one step at a time — they meet at the entry.
```
