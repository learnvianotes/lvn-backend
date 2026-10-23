---
id: e02334c2-19a2-7867-8979-b8860926afb9
key: topic:c/switch
subject: c
topic: switch
title: The switch Statement
slug: the-switch-statement
order: 1
---

`switch` jumps to the `case` label matching an integer value. Execution <em>falls through</em> into the next case unless you `break`.

```c filename:C
#include <stdio.h>

const char *day_type(int day) {
    switch (day) {
        case 0:
        case 6:
            return "weekend";      /* several labels share one body */
        case 1: case 2: case 3: case 4: case 5:
            return "weekday";
        default:
            return "invalid";
    }
}

int main(void) {
    printf("%s %s %s\n", day_type(0), day_type(3), day_type(9));
    return 0;
}
```

```text filename:Output
weekend weekday invalid
```

# Fall-through

```c filename:C
#include <stdio.h>

int main(void) {
    int level = 2;
    switch (level) {
        case 3: printf("gold ");
                /* fall through */
        case 2: printf("silver ");
                /* fall through */
        case 1: printf("bronze ");
                break;
        default: printf("none");
    }
    printf("\n");
    return 0;
}
```

```text filename:Output
silver bronze
```

> [!NOTE] Key point
>
> Mark intentional fall-through with a comment (or C23 `[[fallthrough]];`). `-Wimplicit-fallthrough` flags the unmarked ones.

# Rules

- The controlling expression must have an <strong>integer</strong> type (`int`, `char`, `enum`…) — not a string or `double`.
- `case` labels must be <strong>integer constant expressions</strong> and unique. `const int` variables are not allowed in C; use `enum` or `#define`.
- `default` is optional and may appear anywhere; it runs when no case matches.
- Declaring a variable right after a `case` label needs a block: `case 1: { int t = 0; … break; }`.
- For strings, use `if`/`else if` with `strcmp`.

```c filename:C
#include <stdio.h>

enum Color { RED, GREEN, BLUE };

int main(void) {
    enum Color c = GREEN;
    switch (c) {
        case RED:   printf("stop\n");  break;
        case GREEN: printf("go\n");    break;
        case BLUE:  printf("calm\n");  break;
    }
    return 0;
}
```

```text filename:Output
go
```

> [!NOTE] Tip
>
> Switching on an `enum` without a `default` lets the compiler warn (`-Wswitch`) when you add a new enumerator and forget to handle it.

```question
switch vs if-else chain — which is faster?

---

For dense integer cases the compiler can turn a `switch` into a <em>jump table</em> (O(1) dispatch) or a binary search; an `if`-chain is tested top to bottom. Modern optimisers often transform both, so choose for readability: `switch` for many discrete values of one integer, `if` for ranges and complex conditions.
```
