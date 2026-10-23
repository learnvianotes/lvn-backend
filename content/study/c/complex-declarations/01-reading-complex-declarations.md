---
id: 125c339c-f3bf-70ce-8650-4d70b0bd50c0
key: topic:c/complex-declarations
subject: c
topic: complex-declarations
title: Reading Complex Declarations
slug: reading-complex-declarations
order: 1
---

C declarations mirror usage: `int *a[3]` says “`*a[i]` is an int”. Decode any declaration with the <em>right-left rule</em> — start at the name, go right, then left, and jump out of parentheses.

1. <strong>Find the identifier</strong>

   Start at the name being declared.

2. <strong>Go right</strong>

   `[N]` → “array of N”, `(…)` → “function taking … returning”. Stop at a `)` or the end.

3. <strong>Go left</strong>

   `*` → “pointer to”, `const` → “const”. Stop at a `(`.

4. <strong>Jump out</strong>

   Leave the parentheses and repeat right-then-left until you reach the base type.

| Declaration | Meaning |
| --- | --- |
| `int *p[5]` | array of 5 pointers to int |
| `int (*p)[5]` | pointer to an array of 5 ints |
| `int *f(void)` | function returning pointer to int |
| `int (*f)(void)` | pointer to a function returning int |
| `int (*fs[4])(int)` | array of 4 pointers to functions taking int returning int |
| `char **argv` | pointer to pointer to char |
| `const char *const *p` | pointer to const pointer to const char |
| `void (*signal(int, void (*)(int)))(int)` | function taking (int, pointer to handler) returning pointer to a handler `void (*)(int)` |
| `int (*(*x)(void))[3]` | pointer to function returning pointer to array of 3 ints |

# typedef tames them

```c filename:C
#include <stdio.h>

typedef void (*handler_t)(int);         /* pointer to function (int) -> void */
typedef int row3_t[3];                  /* array of 3 ints */

void on_event(int code) { printf("event %d\n", code); }

/* without typedef: void (*install(handler_t h))(int) */
handler_t install(handler_t h) { return h; }

int main(void) {
    handler_t table[2] = {on_event, on_event};
    install(table[0])(7);

    row3_t grid[2] = {{1, 2, 3}, {4, 5, 6}};
    row3_t *r = &grid[1];                  /* int (*r)[3] */
    printf("%d\n", (*r)[2]);
    return 0;
}
```

```text filename:Output
event 7
6
```

> [!NOTE] Tool
>
> `cdecl` (command-line tool / cdecl.org) translates both ways: `explain int (*(*x)(void))[3]`.

```question
Explain void (\*signal(int sig, void (\*func)(int)))(int).

---

`signal` is a function taking an `int` and a pointer to a function `(int) → void`, and it returns a pointer to a function `(int) → void` (the previous handler). With `typedef void (*sighandler_t)(int);` it reads `sighandler_t signal(int sig, sighandler_t func);`.
```
