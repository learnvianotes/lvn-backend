---
id: 9a3bbf7a-5659-7241-b622-dd66ca5628b5
key: topic:c/operators
subject: c
topic: operators
title: Operators & Precedence
slug: operators-precedence
order: 1
---

C’s operators are compact and powerful. Most bugs come from precedence surprises, integer division, and unsequenced side effects — use parentheses generously.

# Arithmetic

```c filename:C
#include <stdio.h>

int main(void) {
    printf("%d %d %d %d\n", 17 / 5, 17 % 5, -17 / 5, -17 % 5);   /* truncates toward 0 */
    printf("%.2f\n", 17 / 5.0);                                   /* one double → real division */
    int i = 5;
    int a = i++;      /* a = 5, then i = 6 */
    int b = ++i;      /* i = 7, then b = 7 */
    printf("a=%d b=%d i=%d\n", a, b, i);
    return 0;
}
```

```text filename:Output
3 2 -3 -2
3.40
a=5 b=7 i=7
```

> [!NOTE] Key point
>
> Integer `/` truncates toward zero (since C99) and `%` takes the sign of the left operand, so `(a / b) * b + a % b == a` always holds.

# Relational, logical and short-circuit

```c filename:C
#include <stdio.h>

int calls = 0;
int check(int v) { calls++; return v; }

int main(void) {
    printf("%d %d %d\n", 3 > 2, 3 == 2, !5);      /* results are int 1 or 0 */
    if (check(0) && check(1)) { }                 /* right side skipped */
    if (check(1) || check(1)) { }                 /* right side skipped */
    printf("calls = %d\n", calls);
    return 0;
}
```

```text filename:Output
1 0 0
calls = 2
```

# Assignment, comma, ternary, sizeof

```c filename:C
#include <stdio.h>

int main(void) {
    int x = 10;
    x += 5; x *= 2; x -= 6; x /= 4; x %= 4;
    printf("x = %d\n", x);

    int a, b;
    a = b = 7;                          /* assignment is an expression, right-assoc */
    int max = (a > 3) ? a : 3;          /* conditional operator */
    int last = (a++, b++, a + b);       /* comma: evaluate left, yield right */
    printf("%d %d %d %d\n", a, b, max, last);
    return 0;
}
```

```text filename:Output
x = 2
8 8 7 16
```

# Precedence table (high → low)

| Level | Operators | Associativity |
| --- | --- | --- |
| 1 | `()` `[]` `->` `.` postfix `++` `--` | left → right |
| 2 | prefix `++` `--`, unary `+` `-` `!` `~`, cast `(type)`, `*` (deref), `&` (address), `sizeof` | right → left |
| 3 | `*` `/` `%` | left → right |
| 4 | `+` `-` | left → right |
| 5 | `<<` `>>` | left → right |
| 6 | `<` `<=` `>` `>=` | left → right |
| 7 | `==` `!=` | left → right |
| 8 | `&` | left → right |
| 9 | `^` | left → right |
| 10 | `&#124;` | left → right |
| 11 | `&&` | left → right |
| 12 | `&#124;&#124;` | left → right |
| 13 | `?:` | right → left |
| 14 | `=` `+=` `-=` `*=` `/=` `%=` `<<=` `>>=` `&=` `^=` `&#124;=` | right → left |
| 15 | `,` | left → right |

# Classic precedence traps

```c filename:C%20%E2%80%94%20compiled%20with%20-Wno-parentheses%20to%20let%20the%20traps%20through
#include <stdio.h>

int main(void) {
    int flags = 6;
    /* == binds tighter than &:  flags & (4 == 4)  →  6 & 1  →  0 */
    printf("%d\n", flags & 4 == 4 ? 1 : 0);
    printf("%d\n", (flags & 4) == 4 ? 1 : 0);

    /* + binds tighter than << :  1 << (2 + 1) */
    printf("%d\n", 1 << 2 + 1);

    int arr[] = {10, 20, 30};
    int *p = arr;
    int v = *p++;      /* *(p++): read 10, then advance p */
    printf("%d %d\n", v, *p);
    return 0;
}
```

```text filename:Output
0
1
8
10 20
```

> [!WARNING] Watch out
>
> `i = i++ + ++i;` or `printf("%d %d", i, i++)` modify and read the same variable without a <em>sequence point</em> — that is <strong>undefined behaviour</strong>, not “compiler-dependent output”. Clang rejects it under `-Werror` (`-Wunsequenced`).

```c filename:C%20%E2%80%94%20unsequenced%20modification%20(rejected)
#include <stdio.h>

int main(void) {
    int i = 1;
    i = i++ + ++i;
    printf("%d\n", i);
    return 0;
}
```

```question
What is the difference between i++ and ++i?

---

Both add 1 to `i`. The <em>value of the expression</em> differs: `i++` yields the old value, `++i` yields the new value. As a standalone statement (`i++;`) they are identical and compile to the same code.
```

```question
What does short-circuit evaluation mean?

---

`&&` stops as soon as the left side is false, `||` stops as soon as the left side is true, and there is a sequence point after the left operand. That makes guards like `if (p != NULL && p->count > 0)` safe.
```
