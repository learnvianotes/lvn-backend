---
id: d1e547bc-5341-798c-9900-fffb0f17c659
key: topic:c/bitwise
subject: c
topic: bitwise
title: Bitwise Operators & Bit Tricks
slug: bitwise-operators-bit-tricks
order: 1
---

C lets you manipulate individual bits — the basis of flags, masks, hardware registers, compression, hashing and many interview puzzles.

| Operator | Name | Example (a = 12 = `1100`, b = 10 = `1010`) | Result |
| --- | --- | --- | --- |
| `a & b` | AND | `1100 & 1010` | `1000` = 8 |
| `a &#124; b` | OR | `1100 &#124; 1010` | `1110` = 14 |
| `a ^ b` | XOR | `1100 ^ 1010` | `0110` = 6 |
| `~a` | NOT (one’s complement) | `~12` | −13 (for `int`) |
| `a << n` | left shift | `12 << 1` | 24 (× 2ⁿ) |
| `a >> n` | right shift | `12 >> 2` | 3 (÷ 2ⁿ for non-negative) |

```c filename:C
#include <stdio.h>

void print_bits(unsigned x, int width) {
    for (int i = width - 1; i >= 0; i--)
        putchar((x >> i) & 1u ? '1' : '0');
    putchar('\n');
}

int main(void) {
    unsigned a = 12, b = 10;
    printf("%u %u %u %u %u\n", a & b, a | b, a ^ b, a << 1, a >> 2);
    print_bits(a, 8);
    print_bits(~a & 0xFFu, 8);
    return 0;
}
```

```text filename:Output
8 14 6 24 3
00001100
11110011
```

# Set, clear, toggle, test

```c filename:C
#include <stdio.h>

#define BIT(n) (1u << (n))

int main(void) {
    unsigned flags = 0;
    flags |= BIT(3);              /* set bit 3     */
    flags |= BIT(0);              /* set bit 0     */
    printf("%u\n", flags);        /* 1001 = 9      */
    flags &= ~BIT(0);             /* clear bit 0   */
    flags ^= BIT(1);              /* toggle bit 1  */
    printf("%u\n", flags);        /* 1010 = 10     */
    printf("bit 3 is %s\n", (flags & BIT(3)) ? "set" : "clear");
    return 0;
}
```

```text filename:Output
9
10
bit 3 is set
```

# Flags as a set of options

```c filename:C
#include <stdio.h>

enum Perm { READ = 1 << 0, WRITE = 1 << 1, EXEC = 1 << 2 };

int main(void) {
    unsigned perms = READ | WRITE;
    printf("can write? %s\n", (perms & WRITE) ? "yes" : "no");
    printf("can exec?  %s\n", (perms & EXEC) ? "yes" : "no");
    perms |= EXEC;
    printf("rwx = %u\n", perms);
    return 0;
}
```

```text filename:Output
can write? yes
can exec?  no
rwx = 7
```

# Classic bit tricks

```c filename:C
#include <stdio.h>

int is_power_of_two(unsigned x) { return x && !(x & (x - 1)); }

int popcount(unsigned x) {          /* Kernighan: clear lowest set bit each step */
    int n = 0;
    while (x) { x &= x - 1; n++; }
    return n;
}

int main(void) {
    printf("%d %d %d\n", is_power_of_two(64), is_power_of_two(96), is_power_of_two(0));
    printf("popcount(255) = %d, popcount(96) = %d\n", popcount(255), popcount(96));
    printf("lowest set bit of 96 = %u\n", 96u & -96u);
    printf("odd? %d %d\n", 7 & 1, 10 & 1);

    int x = 5, y = 9;
    x ^= y; y ^= x; x ^= y;         /* XOR swap (a curiosity; use a temp in real code) */
    printf("x=%d y=%d\n", x, y);

    int nums[] = {4, 1, 2, 1, 2};   /* every number twice except one */
    int single = 0;
    for (int i = 0; i < 5; i++) single ^= nums[i];
    printf("single = %d\n", single);
    printf("builtin popcount = %d\n", __builtin_popcount(255u));
    return 0;
}
```

```text filename:Output
1 0 0
popcount(255) = 8, popcount(96) = 2
lowest set bit of 96 = 32
odd? 1 0
x=9 y=5
single = 4
builtin popcount = 8
```

| Trick | Expression |
| --- | --- |
| Is power of two | `x && !(x & (x - 1))` |
| Clear lowest set bit | `x & (x - 1)` |
| Isolate lowest set bit | `x & -x` (unsigned) |
| Multiply / divide by 2ⁿ | `x << n`, `x >> n` (unsigned) |
| Check odd | `x & 1` |
| Swap without temp | `a ^= b; b ^= a; a ^= b;` (breaks if `a` and `b` alias!) |
| Round up to multiple of 8 | `(x + 7) & ~7u` |

# Shift pitfalls

- Shifting by ≥ the width of the type (`1u << 32` for a 32-bit `unsigned`) is <strong>undefined</strong>.
- Left-shifting a negative value, or shifting a `1` into the sign bit of a signed `int` (`1 << 31`), is <strong>undefined</strong> — use unsigned types for bit work.
- Right-shifting a negative signed value is implementation-defined (usually arithmetic, copying the sign bit).

```c filename:C%20%E2%80%94%20oversized%20shift%20(caught%20by%20UBSan)
#include <stdio.h>

int main(void) {
    int shift = 32;
    unsigned x = 1u << shift;     /* UB: shift >= width of unsigned int */
    printf("%u\n", x);
    return 0;
}
```

```text filename:UBSan
main.c:5:21: runtime error: shift exponent 32 is too large for 32-bit type 'unsigned int'
```

```question
How do you check whether the k-th bit of n is set?

---

`(n >> k) & 1` or `n & (1u << k)` (non-zero means set). Use unsigned operands so shifts into the top bit are well defined.
```

```question
How do you find the element that appears once when all others appear twice?

---

XOR all elements: `x ^ x == 0` and `x ^ 0 == x`, and XOR is commutative, so pairs cancel and only the single element remains. O(n) time, O(1) space.
```
