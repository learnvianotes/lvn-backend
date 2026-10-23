---
id: f8aa2ca5-eac0-7b2f-9b53-58c69ed38e01
key: topic:c/enums
subject: c
topic: enums
title: Enumerations
slug: enumerations
order: 1
---

An `enum` defines a set of named integer constants — readable names for states, options and error codes.

```c filename:C
#include <stdio.h>

enum Weekday { MON, TUE, WED, THU, FRI, SAT, SUN };        /* 0, 1, 2, ... */
enum Http { OK = 200, CREATED, NOT_FOUND = 404, TEAPOT = 418 };  /* CREATED = 201 */

static const char *names[] = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};

int main(void) {
    enum Weekday d = FRI;
    printf("%d %s\n", d, names[d]);
    printf("%d %d %d\n", OK, CREATED, NOT_FOUND);
    for (enum Weekday w = SAT; w <= SUN; w++) printf("%s ", names[w]);
    printf("\nsizeof(enum Weekday) = %zu\n", sizeof(enum Weekday));
    return 0;
}
```

```text filename:Output
4 Fri
200 201 404
Sat Sun
sizeof(enum Weekday) = 4
```

# Idioms

```c filename:C
#include <stdio.h>

/* a trailing COUNT enumerator gives the number of values for free */
typedef enum { RED, GREEN, BLUE, COLOR_COUNT } Color;

/* X-macro: one list generates both the enum and its names */
#define STATES(X) X(IDLE) X(RUNNING) X(DONE)
#define AS_ENUM(n) n,
#define AS_NAME(n) #n,
typedef enum { STATES(AS_ENUM) STATE_COUNT } State;
static const char *state_names[] = { STATES(AS_NAME) };

int main(void) {
    int hits[COLOR_COUNT] = {0};
    hits[GREEN]++;
    printf("colors: %d, green hits: %d\n", COLOR_COUNT, hits[GREEN]);
    for (int s = 0; s < STATE_COUNT; s++) printf("%d=%s ", s, state_names[s]);
    printf("\n");
    return 0;
}
```

```text filename:Output
colors: 3, green hits: 1
0=IDLE 1=RUNNING 2=DONE
```

| `enum` | `#define` |
| --- | --- |
| Scoped like variables | Global text substitution |
| Visible in the debugger by name | Gone after preprocessing |
| Auto-numbering | Every value by hand |
| `switch` can warn about missing cases | No checking |
| Only `int` values (C23 allows a fixed underlying type) | Any value/type (strings, doubles) |

> [!WARNING] Watch out
>
> C enums are <em>weakly</em> typed: an `enum` variable is just an integer, and any `int` can be assigned to it without a diagnostic. Enumerator names share one namespace — prefix them (`COLOR_RED`) to avoid clashes.

```question
What is the default value of the first enumerator, and of the ones after it?

---

The first is 0 unless given a value; each subsequent enumerator is the previous value + 1. Values can repeat and can be negative.
```

```question
What is the size of an enum?

---

Implementation-defined: an integer type able to represent all enumerators — `int` (4 bytes) on common compilers. C23 lets you fix it: `enum Small : unsigned char { A, B };`.
```
