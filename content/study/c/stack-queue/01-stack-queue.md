---
id: e5dad070-c2a5-7598-8985-1eaa4c2a40f5
key: topic:c/stack-queue
subject: c
topic: stack-queue
title: Stack & Queue
slug: stack-queue
order: 1
---

A <strong>stack</strong> is last-in-first-out (push/pop at one end); a <strong>queue</strong> is first-in-first-out (enqueue at the back, dequeue at the front). In C you build them on an array or a linked list.

# Array-based stack

```c filename:C
#include <stdio.h>
#include <stdbool.h>
#include <string.h>

#define CAP 64

typedef struct { char items[CAP]; int top; } Stack;   /* top = count */

bool push(Stack *s, char c) { if (s->top == CAP) return false; s->items[s->top++] = c; return true; }
bool pop(Stack *s, char *out) { if (s->top == 0) return false; *out = s->items[--s->top]; return true; }

bool balanced(const char *expr) {
    Stack s = {.top = 0};
    for (; *expr; expr++) {
        char c = *expr, open;
        if (strchr("([{", c)) {
            if (!push(&s, c)) return false;
        } else if (strchr(")]}", c)) {
            if (!pop(&s, &open)) return false;
            if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{'))
                return false;
        }
    }
    return s.top == 0;
}

int main(void) {
    const char *tests[] = {"{a[b(c)d]e}", "(]", "((())", "f(x[0])"};
    for (int i = 0; i < 4; i++) printf("%-12s %s\n", tests[i], balanced(tests[i]) ? "balanced" : "NOT balanced");
    return 0;
}
```

```text filename:Output
{a[b(c)d]e}  balanced
(]           NOT balanced
((())        NOT balanced
f(x[0])      balanced
```

# Circular-buffer queue

```c filename:C
#include <stdio.h>
#include <stdbool.h>

#define QCAP 4

typedef struct { int buf[QCAP]; int head, count; } Queue;

bool enqueue(Queue *q, int v) {
    if (q->count == QCAP) return false;               /* full */
    q->buf[(q->head + q->count) % QCAP] = v;          /* wrap around */
    q->count++;
    return true;
}

bool dequeue(Queue *q, int *out) {
    if (q->count == 0) return false;                  /* empty */
    *out = q->buf[q->head];
    q->head = (q->head + 1) % QCAP;
    q->count--;
    return true;
}

int main(void) {
    Queue q = {.head = 0, .count = 0};
    for (int i = 1; i <= 5; i++)
        if (!enqueue(&q, i * 10)) printf("queue full, dropped %d\n", i * 10);
    int v;
    dequeue(&q, &v); printf("got %d\n", v);
    dequeue(&q, &v); printf("got %d\n", v);
    enqueue(&q, 60); enqueue(&q, 70);                  /* reuses freed slots */
    while (dequeue(&q, &v)) printf("%d ", v);
    printf("\n");
    return 0;
}
```

```text filename:Output
queue full, dropped 50
got 10
got 20
30 40 60 70
```

# Linked-list stack (unbounded)

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct SNode { int val; struct SNode *below; } SNode;

void push(SNode **top, int v) {
    SNode *n = malloc(sizeof *n);
    if (!n) exit(1);
    n->val = v; n->below = *top; *top = n;
}

int pop(SNode **top) {                     /* caller checks for empty */
    SNode *n = *top;
    int v = n->val;
    *top = n->below;
    free(n);
    return v;
}

/* evaluate a postfix (RPN) expression of single digits */
int eval_rpn(const char *s) {
    SNode *st = NULL;
    for (; *s; s++) {
        if (*s >= '0' && *s <= '9') { push(&st, *s - '0'); continue; }
        if (*s == ' ') continue;
        int b = pop(&st), a = pop(&st);
        push(&st, *s == '+' ? a + b : *s == '-' ? a - b : *s == '*' ? a * b : a / b);
    }
    return pop(&st);
}

int main(void) {
    printf("%d\n", eval_rpn("3 4 + 2 *"));      /* (3 + 4) * 2 */
    printf("%d\n", eval_rpn("5 1 2 + 4 * + 3 -"));
    return 0;
}
```

```text filename:Output
14
14
```

|  | Array | Linked list |
| --- | --- | --- |
| Push/pop, enqueue/dequeue | O(1) | O(1) |
| Capacity | Fixed (or amortised O(1) with `realloc`) | Unbounded |
| Memory | Compact, cache-friendly | One `malloc` + pointer per element |

```question
How do you implement a queue using two stacks?

---

Push onto an <em>in</em> stack. To dequeue, if the <em>out</em> stack is empty, pop everything from <em>in</em> and push it onto <em>out</em> (reversing the order), then pop from <em>out</em>. Each element moves at most twice, so operations are amortised O(1).
```

```question
How do you tell a full circular buffer from an empty one?

---

`head == tail` is ambiguous, so either keep a separate `count` (as above), or always leave one slot unused (`(tail + 1) % CAP == head` means full).
```
