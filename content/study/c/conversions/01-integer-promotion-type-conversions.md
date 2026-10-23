---
id: b96050dd-ecda-7cd6-870a-3527af3acbf9
key: topic:c/conversions
subject: c
topic: conversions
title: Integer Promotion & Type Conversions
slug: integer-promotion-type-conversions
order: 1
---

Before most arithmetic, C silently converts operands: small integers are <em>promoted</em> to `int`, and mixed types are brought to a <em>common type</em>. Signed/unsigned mixing is the classic source of bugs.

# Integer promotion

Any `char`, `short` or bit-field (signed or unsigned) used in an expression is first converted to `int` (or `unsigned int` if `int` can’t hold all its values).

```c filename:C
#include <stdio.h>

int main(void) {
    unsigned char a = 200, b = 100;
    int sum = a + b;                 /* promoted to int: 300, no wrap */
    unsigned char stored = a + b;    /* converted back: 300 mod 256 */
    printf("%d %d\n", sum, stored);

    char c = 'x';
    printf("%zu %zu\n", sizeof c, sizeof(c + 0));   /* char vs int */

    unsigned char ones = 0xFF;
    printf("%d\n", ~ones);           /* ~ applied to int 255 → -256, not 0 */
    return 0;
}
```

```text filename:Output
300 44
1 4
-256
```

# The usual arithmetic conversions

1. <strong>Any floating operand?</strong>

   Convert the other to the widest floating type involved (`long double` &gt; `double` &gt; `float`).

2. <strong>Otherwise promote</strong>

   Apply integer promotion to both operands.

3. <strong>Same signedness</strong>

   Convert to the higher-rank type (`int` &lt; `long` &lt; `long long`).

4. <strong>Mixed signedness</strong>

   If the unsigned type has rank ≥ the signed one, the <strong>signed operand becomes unsigned</strong>. Otherwise, if the signed type can represent every unsigned value, convert to the signed type; else to its unsigned counterpart.

```c filename:C
#include <stdio.h>

int main(void) {
    int neg = -1;
    unsigned int one = 1;
    /* -1 is converted to unsigned: 4294967295 > 1 */
    if ((unsigned)neg > one) printf("-1 > 1u as unsigned!\n");
    printf("%u\n", (unsigned)neg);

    long long big = -1;
    printf("%d\n", big < one);     /* long long can hold every unsigned int: stays signed */
    return 0;
}
```

```text filename:Output
-1 > 1u as unsigned!
4294967295
1
```

Clang warns about the implicit version of this comparison (`-Wsign-compare`, part of `-Wextra`) — one more reason to keep warnings on:

```c filename:C%20%E2%80%94%20signed%2Funsigned%20comparison%20(rejected%20by%20-Wextra%20-Werror)
#include <stdio.h>
#include <string.h>

int main(void) {
    int i = -1;
    if (i < strlen("abc"))       /* int vs size_t: i becomes huge */
        printf("smaller\n");
    return 0;
}
```

# Explicit casts and narrowing

```c filename:C
#include <stdio.h>

int main(void) {
    double d = 3.99;
    int truncated = (int)d;          /* toward zero, not rounded */
    int negative = (int)-3.99;
    printf("%d %d\n", truncated, negative);

    int total = 7, count = 2;
    printf("%d %.1f\n", total / count, (double)total / count);

    int big = 300;
    unsigned char small = (unsigned char)big;   /* modulo 256 */
    signed char sc = (signed char)200;          /* implementation-defined */
    printf("%d %d\n", small, sc);
    return 0;
}
```

```text filename:Output
3 -3
3 3.5
44 -56
```

| Conversion | Result |
| --- | --- |
| Any integer → unsigned type | Well defined: value modulo 2ᴺ |
| Out-of-range integer → signed type | Implementation-defined (wraps on all real compilers; C23 mandates two’s complement) |
| Floating → integer | Truncates toward zero; <strong>UB</strong> if the value doesn’t fit |
| Integer → floating | May lose precision for large values |
| `double` → `float` | Rounded; UB/inf if out of range |

```question
Why does (unsigned char)255 + 1 give 256 and not 0?

---

Because of integer promotion: the `unsigned char` operand is promoted to `int` before the addition, so the arithmetic is done in `int`. The result only wraps to 0 if it is stored back into an `unsigned char`.
```

```question
What is the result of -1 &lt; 0u?

---

`0` (false). `-1` is converted to `unsigned int` (becoming `UINT_MAX`) because both operands have the same rank and one is unsigned. This is why comparing an `int` with `strlen()` or `sizeof` can go wrong.
```
