---
id: d1dad8b3-06c5-71ea-841b-7626a7a968dd
key: topic:c/conditionals
subject: c
topic: conditionals
title: "Conditionals: if, else & ?:"
slug: conditionals-if-else
order: 1
---

C has no boolean type in conditions — any scalar value is tested against zero: `0` (or `NULL`) is false, everything else is true.

# if / else if / else

```c filename:C
#include <stdio.h>

const char *grade(int score) {
    if (score >= 90) {
        return "A";
    } else if (score >= 75) {
        return "B";
    } else if (score >= 50) {
        return "C";
    } else {
        return "F";
    }
}

int main(void) {
    int scores[] = {95, 80, 50, 12};
    for (int i = 0; i < 4; i++)
        printf("%d -> %s\n", scores[i], grade(scores[i]));
    return 0;
}
```

```text filename:Output
95 -> A
80 -> B
50 -> C
12 -> F
```

# Truth in C

```c filename:C
#include <stdio.h>
#include <stdbool.h>

int main(void) {
    int n = -3;
    char *p = NULL;
    if (n) printf("-3 is true\n");
    if (!p) printf("NULL is false\n");
    if (0.0) printf("never\n"); else printf("0.0 is false\n");

    bool done = 5;                  /* any non-zero converts to true (1) */
    printf("done = %d\n", done);
    return 0;
}
```

```text filename:Output
-3 is true
NULL is false
0.0 is false
done = 1
```

# The conditional (ternary) operator

```c filename:C
#include <stdio.h>

int main(void) {
    int a = 7, b = 12;
    int max = a > b ? a : b;
    printf("max = %d, %s\n", max, a % 2 ? "a is odd" : "a is even");
    return 0;
}
```

```text filename:Output
max = 12, a is odd
```

# Pitfalls

| Bug | What happens | Prevention |
| --- | --- | --- |
| `if (x = 5)` | Assigns 5, always true | `-Wall` warns (`-Wparentheses`); some write `if (5 == x)` |
| `if (x > 0);` `{ … }` | Empty statement — block always runs | Brace style, `-Wempty-body` |
| Dangling `else` | `else` binds to the <strong>nearest</strong> `if` | Always use braces |
| `if (0.1 + 0.2 == 0.3)` | False — floating rounding | Compare with a tolerance |
| `if (a < b < c)` | Parsed as `(a < b) < c` → compares 0/1 with `c` | `a < b && b < c` |

```c filename:C%20%E2%80%94%20rejected%3A%20-Wparentheses%20under%20-Werror
#include <stdio.h>

int main(void) {
    int x = 0;
    if (x = 5)                 /* assignment used as condition */
        printf("always\n");
    return 0;
}
```

```question
What is the dangling else problem?

---

In `if (a) if (b) s1; else s2;` the `else` belongs to the inner `if (b)`, regardless of indentation. C resolves the ambiguity by binding `else` to the nearest unmatched `if`. Braces make the intent explicit.
```
