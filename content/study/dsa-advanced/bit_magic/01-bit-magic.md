---
id: 90ec2fe3-7f13-73e3-be3e-fa02849d359c
key: topic:dsa-advanced/bit_magic
subject: dsa-advanced
topic: bit_magic
title: Bit Magic
slug: bit-magic
order: 1
---

Bit manipulation treats an integer as a row of 0/1 switches. A handful of operators (`& | ^ ~ << >>`) and a dozen tricks turn O(n) counting problems into O(1) formulas, cancel paired elements with XOR, and enumerate every subset of a set with a counter.

> [!INFO]
>
> <strong>Bit magic</strong> — solving problems by operating directly on the binary representation of integers — testing, setting, clearing and counting bits, and using XOR's cancelling property — instead of on their decimal value.

# Binary representation and two's complement

An `n`-bit integer has `n` positions; bit 0 is the <strong>least significant bit</strong> (LSB, rightmost, worth `1`) and bit `n-1` the <strong>most significant bit</strong> (MSB, leftmost). Unsigned numbers use all bits for magnitude; signed numbers use <strong>two's complement</strong>, where the MSB acts as the sign and the representable range is `-2^(n-1)` … `2^(n-1) - 1`.

1. <strong>Write the positive number</strong>

   `3` in 4 bits is `0011`.

2. <strong>Invert every bit</strong>

   `0011` → `1100` (this is the one's complement).

3. <strong>Add 1</strong>

   `1100 + 1` → `1101`. That is `-3` in 4-bit two's complement.

`two's complement of x in n bits = 2^n − x (4 bits: 16 − 3 = 13 = 1101)`

```text filename:Every%204-bit%20pattern%20is%20used%20exactly%20once%3B%20there%20is%20only%20one%20zero
4-bit two's complement (range -8 … 7)

 bits   value         bits   value
 0000     0           1000    -8   ← MSB set ⇒ negative
 0001     1           1001    -7
 0010     2           1010    -6
 0011     3           1011    -5
 0100     4           1100    -4
 0101     5           1101    -3
 0110     6           1110    -2
 0111     7           1111    -1
```

Why two's complement rather than a separate sign bit? Three reasons that make hardware simpler:

- <strong>One zero.</strong> A sign-magnitude scheme has `+0` and `-0`; two's complement has a single `0000`.
- <strong>Addition just works.</strong> The same adder handles positive and negative operands: `3 + (-3)` = `0011 + 1101` = `1 0000`, and dropping the carry gives `0000`. Subtraction is addition of the complement, which is where the name `0 − x` comes from.
- <strong>The leading bit is the sign.</strong> MSB `1` ⇒ negative, so a sign test is a single bit check.

```python filename:Python
def bits(x, n):
    # the low n bits of x, most significant first ((x >> i) & 1 picks bit i)
    return "".join("1" if (x >> i) & 1 else "0" for i in range(n - 1, -1, -1))

for x in (3, 7, -1, -3, -8):
    print(x, "in 4 bits:", bits(x, 4))
print("2^4 - 3 =", (1 << 4) - 3, "->", bits((1 << 4) - 3, 4))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

string bits(int x, int n) {
    string s;
    for (int i = n - 1; i >= 0; i--)        // (x >> i) & 1 picks bit i
        s += ((x >> i) & 1) ? '1' : '0';
    return s;
}

int main() {
    for (int x : {3, 7, -1, -3, -8})
        cout << x << " in 4 bits: " << bits(x, 4) << "\n";
    cout << "2^4 - 3 = " << ((1 << 4) - 3) << " -> " << bits((1 << 4) - 3, 4) << "\n";
}
```

```java filename:Java
public class Main {
    static String bits(int x, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = n - 1; i >= 0; i--)    // (x >> i) & 1 picks bit i
            sb.append((x >> i) & 1);
        return sb.toString();
    }

    public static void main(String[] args) {
        for (int x : new int[]{3, 7, -1, -3, -8})
            System.out.println(x + " in 4 bits: " + bits(x, 4));
        System.out.println("2^4 - 3 = " + ((1 << 4) - 3) + " -> " + bits((1 << 4) - 3, 4));
    }
}
```

```javascript filename:JavaScript
function bits(x, n) {
    let s = "";
    for (let i = n - 1; i >= 0; i--)        // (x >> i) & 1 picks bit i
        s += (x >> i) & 1;
    return s;
}

for (const x of [3, 7, -1, -3, -8])
    console.log(x, "in 4 bits:", bits(x, 4));
console.log("2^4 - 3 =", (1 << 4) - 3, "->", bits((1 << 4) - 3, 4));
```

```text filename:Output
3 in 4 bits: 0011
7 in 4 bits: 0111
-1 in 4 bits: 1111
-3 in 4 bits: 1101
-8 in 4 bits: 1000
2^4 - 3 = 13 -> 1101
```

> [!NOTE] Key point
>
> Masking with `(x >> i) & 1` works for negative numbers too, because every language above shifts a negative `int` arithmetically (the sign bit is copied in). Python has no fixed width, so `-3` is conceptually `…11111101` with infinitely many leading ones — taking the low 4 bits still gives `1101`.

# Bitwise operators

| Operator | Name | Rule per bit | `12 (1100)` with `10 (1010)` |
| --- | --- | --- | --- |
| `a & b` | AND | 1 only if <strong>both</strong> bits are 1 | `1000` = 8 |
| `a &#124; b` | OR | 1 if <strong>either</strong> bit is 1 | `1110` = 14 |
| `a ^ b` | XOR | 1 if the bits <strong>differ</strong> | `0110` = 6 |
| `~a` | NOT | flips every bit; equals `-a - 1` in two's complement | `~12` = -13 |
| `a << k` | left shift | shift left, zeros enter on the right; multiplies by `2^k` | `12 << 2` = 48 |
| `a >> k` | right shift | shift right, drops the low bits; divides by `2^k` (floor) | `12 >> 2` = 3 |

```python filename:Python
def bits(x, n):
    return "".join("1" if (x >> i) & 1 else "0" for i in range(n - 1, -1, -1))

def show(label, v):
    print(f"{label} = {v} -> {bits(v, 8)}")

a, b = 12, 10
show("a", a)
show("b", b)
show("a & b", a & b)
show("a | b", a | b)
show("a ^ b", a ^ b)
show("~a", ~a)            # -13: Python prints the signed value, low 8 bits are 11110011
show("a << 2", a << 2)
show("a >> 2", a >> 2)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

string bits(int x, int n) {
    string s;
    for (int i = n - 1; i >= 0; i--) s += ((x >> i) & 1) ? '1' : '0';
    return s;
}

void show(const string& label, int v) {
    cout << label << " = " << v << " -> " << bits(v, 8) << "\n";
}

int main() {
    int a = 12, b = 10;
    show("a", a);
    show("b", b);
    show("a & b", a & b);
    show("a | b", a | b);
    show("a ^ b", a ^ b);
    show("~a", ~a);           // -13 in a 32-bit int: low 8 bits are 11110011
    show("a << 2", a << 2);
    show("a >> 2", a >> 2);
}
```

```java filename:Java
public class Main {
    static String bits(int x, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = n - 1; i >= 0; i--) sb.append((x >> i) & 1);
        return sb.toString();
    }

    static void show(String label, int v) {
        System.out.println(label + " = " + v + " -> " + bits(v, 8));
    }

    public static void main(String[] args) {
        int a = 12, b = 10;
        show("a", a);
        show("b", b);
        show("a & b", a & b);
        show("a | b", a | b);
        show("a ^ b", a ^ b);
        show("~a", ~a);       // -13 in a 32-bit int: low 8 bits are 11110011
        show("a << 2", a << 2);
        show("a >> 2", a >> 2);
    }
}
```

```javascript filename:JavaScript
function bits(x, n) {
    let s = "";
    for (let i = n - 1; i >= 0; i--) s += (x >> i) & 1;
    return s;
}

function show(label, v) {
    console.log(`${label} = ${v} -> ${bits(v, 8)}`);
}

const a = 12, b = 10;
show("a", a);
show("b", b);
show("a & b", a & b);
show("a | b", a | b);
show("a ^ b", a ^ b);
show("~a", ~a);               // JS converts to a 32-bit int first: -13
show("a << 2", a << 2);
show("a >> 2", a >> 2);
```

```text filename:Output
a = 12 -> 00001100
b = 10 -> 00001010
a & b = 8 -> 00001000
a | b = 14 -> 00001110
a ^ b = 6 -> 00000110
~a = -13 -> 11110011
a << 2 = 48 -> 00110000
a >> 2 = 3 -> 00000011
```

# Language differences you must know

|  | Python | C++ / Java | JavaScript |
| --- | --- | --- | --- |
| Width of an `int` | unbounded — `1 << 100` is fine, `~x` is always `-x-1` | 32-bit `int`, 64-bit `long`/`long long`; overflow wraps (Java) or is undefined for signed (C++) | numbers are doubles, but <strong>every bitwise operator converts to a 32-bit signed int first</strong> — `1 << 31` is `-2147483648` |
| `>>` on negatives | arithmetic (floor division by `2^k`) | arithmetic; C++ guarantees it since C++20 | arithmetic |
| Logical (zero-fill) shift | not needed — mask first: `(x & 0xFFFFFFFF) >> k` | Java: `x >>> k`. C++: cast to `unsigned` first | `x >>> k` |
| Shift by ≥ width | fine (just a bigger number) | <strong>undefined</strong> in C++, taken mod 32/64 in Java | taken mod 32 |
| Popcount built-in | `n.bit_count()` (3.10+) or `bin(n).count('1')` | `std::popcount` (`<bit>`, unsigned) / `__builtin_popcount`; `Integer.bitCount(n)` | none — `n.toString(2).split('1').length - 1` |

```python filename:Python
x = -16
print("-16 >> 2 =", x >> 2)                       # arithmetic: sign bit copied in
print("-16 >>> 2 =", (x & 0xFFFFFFFF) >> 2)       # emulate a 32-bit logical shift
print("1 << 10 =", 1 << 10)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int main() {
    int x = -16;
    cout << "-16 >> 2 = " << (x >> 2) << "\n";                        // arithmetic shift
    cout << "-16 >>> 2 = " << (static_cast<unsigned>(x) >> 2) << "\n"; // logical: shift as unsigned
    cout << "1 << 10 = " << (1 << 10) << "\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int x = -16;
        System.out.println("-16 >> 2 = " + (x >> 2));     // arithmetic shift
        System.out.println("-16 >>> 2 = " + (x >>> 2));   // logical shift fills with zeros
        System.out.println("1 << 10 = " + (1 << 10));
    }
}
```

```javascript filename:JavaScript
const x = -16;
console.log("-16 >> 2 =", x >> 2);        // arithmetic shift
console.log("-16 >>> 2 =", x >>> 2);      // logical shift; result is an unsigned 32-bit value
console.log("1 << 10 =", 1 << 10);
```

```text filename:Output
-16 >> 2 = -4
-16 >>> 2 = 1073741820
1 << 10 = 1024
```

> [!WARNING] Pitfall
>
> In JavaScript `2 ** 40 | 0` silently truncates to 32 bits, and in C++ `1 << 31` on an `int` and any shift by 32 or more are undefined behaviour. When you need 64 bits use `1n << 40n` (BigInt) in JS and `1LL << 40` / `1L << 40` in C++/Java.

# The classic tricks

| Expression | What it does | Why |
| --- | --- | --- |
| `n & 1` | `1` if `n` is odd | the LSB is the only odd place value |
| `n << 1`, `n >> 1` | `n * 2`, `n / 2` (floor) | shifting moves every bit to the next place value |
| `1 << k` | `2^k`, a mask with only bit `k` set | `1` moved `k` places left |
| `n & (1 << k)` | non-zero iff bit `k` is set | AND keeps only that bit |
| `n &#124; (1 << k)` | set bit `k` | OR with the mask forces a `1` |
| `n & ~(1 << k)` | clear bit `k` | AND with every bit except `k` set |
| `n ^ (1 << k)` | toggle bit `k` | XOR with `1` flips, with `0` keeps |
| `n & (n - 1)` | clear the <strong>rightmost set bit</strong> | subtracting 1 flips that bit and the zeros after it |
| `n & -n` (= `n & ~(n - 1)`) | isolate the rightmost set bit | `-n` agrees with `n` only at that bit |
| `n & (n - 1) == 0` | `n` is a power of two (for `n > 0`) | a power of two has exactly one set bit |
| `x ^ x = 0`, `x ^ 0 = x` | XOR cancels pairs | the basis of the odd-occurrence problems below |
| `a ^= b; b ^= a; a ^= b` | swap without a temporary | `a ^ b ^ b = a` |

# Decimal to binary and back

Repeated division by 2 produces the bits from the right: the remainder is the next bit, the quotient is what is left. Reading a binary string left to right is the reverse: `value = value * 2 + bit`. Both loops are `O(number of bits)` = `O(log n)`.

```python filename:Python
def to_binary(n):
    if n == 0:
        return "0"
    s = ""
    while n > 0:
        s = str(n % 2) + s      # remainder = next bit from the right
        n //= 2
    return s

def to_decimal(b):
    v = 0
    for ch in b:
        v = v * 2 + (1 if ch == '1' else 0)   # shift what we have, add the new bit
    return v

print(37, "->", to_binary(37))
print("100101", "->", to_decimal("100101"))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

string toBinary(int n) {
    if (n == 0) return "0";
    string s;
    while (n > 0) {
        s = char('0' + n % 2) + s;     // remainder = next bit from the right
        n /= 2;
    }
    return s;
}

int toDecimal(const string& b) {
    int v = 0;
    for (char ch : b) v = v * 2 + (ch == '1' ? 1 : 0);   // shift what we have, add the new bit
    return v;
}

int main() {
    cout << 37 << " -> " << toBinary(37) << "\n";
    cout << "100101" << " -> " << toDecimal("100101") << "\n";
}
```

```java filename:Java
public class Main {
    static String toBinary(int n) {
        if (n == 0) return "0";
        StringBuilder s = new StringBuilder();
        while (n > 0) {
            s.insert(0, n % 2);        // remainder = next bit from the right
            n /= 2;
        }
        return s.toString();
    }

    static int toDecimal(String b) {
        int v = 0;
        for (char ch : b.toCharArray()) v = v * 2 + (ch == '1' ? 1 : 0);   // shift, add the new bit
        return v;
    }

    public static void main(String[] args) {
        System.out.println(37 + " -> " + toBinary(37));
        System.out.println("100101" + " -> " + toDecimal("100101"));
    }
}
```

```javascript filename:JavaScript
function toBinary(n) {
    if (n === 0) return "0";
    let s = "";
    while (n > 0) {
        s = (n % 2) + s;              // remainder = next bit from the right
        n = Math.floor(n / 2);
    }
    return s;
}

function toDecimal(b) {
    let v = 0;
    for (const ch of b) v = v * 2 + (ch === '1' ? 1 : 0);   // shift what we have, add the new bit
    return v;
}

console.log(37, "->", toBinary(37));
console.log("100101", "->", toDecimal("100101"));
```

```text filename:Output
37 -> 100101
100101 -> 37
```

> [!NOTE] Key point
>
> The built-ins do the same: Python `bin(37)` / `int('100101', 2)`, C++ `bitset<8>(37)` / `stoi(s, nullptr, 2)`, Java `Integer.toBinaryString(37)` / `Integer.parseInt(s, 2)`, JavaScript `(37).toString(2)` / `parseInt(s, 2)`.

# Check whether the kth bit is set

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5, k = 1`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `n = 5, k = 2`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `n = 5, k = 3`<br><strong>Output:</strong> `Yes`

Bits are counted from the right, so the <strong>kth bit</strong> (1-based) is the mask `1 << (k - 1)`; `k` must not exceed the width of `n`. Two equivalent ways:

> [!NOTE] Idea
>
> <strong>Move the mask to the bit:</strong> `n & (1 << (k-1))` keeps only bit `k`; the result is non-zero exactly when that bit is `1`. <strong>Or move the bit to the mask:</strong> `(n >> (k-1)) & 1` drags bit `k` down to position 0 and reads it as `0` or `1`.

```text filename:Both%20methods%20look%20at%20the%20same%20bit
n = 5 = 0 1 0 1          k = 3 → mask 1 << 2 = 0 1 0 0
        k=4 3 2 1
n & mask = 0 1 0 0  ≠ 0  → bit 3 is set
n >> 2   = 0 0 0 1  & 1 = 1 → the same answer, read at position 0
```

```python filename:Python
def is_kth_set_mask(n, k):
    return (n & (1 << (k - 1))) != 0     # way 1: move the mask to the bit

def is_kth_set_shift(n, k):
    return ((n >> (k - 1)) & 1) == 1     # way 2: move the bit to position 0

n = 5
print("n =", n, "->", format(n, "04b"))
for k in range(1, 5):
    print(f"k = {k}:", "Yes" if is_kth_set_mask(n, k) else "No",
          "Yes" if is_kth_set_shift(n, k) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <bitset>
using namespace std;

bool isKthSetMask(int n, int k) {
    return (n & (1 << (k - 1))) != 0;    // way 1: move the mask to the bit
}

bool isKthSetShift(int n, int k) {
    return ((n >> (k - 1)) & 1) == 1;    // way 2: move the bit to position 0
}

int main() {
    int n = 5;
    cout << "n = " << n << " -> " << bitset<4>(n) << "\n";
    for (int k = 1; k <= 4; k++)
        cout << "k = " << k << ": " << (isKthSetMask(n, k) ? "Yes" : "No")
             << " " << (isKthSetShift(n, k) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isKthSetMask(int n, int k) {
        return (n & (1 << (k - 1))) != 0;    // way 1: move the mask to the bit
    }

    static boolean isKthSetShift(int n, int k) {
        return ((n >> (k - 1)) & 1) == 1;    // way 2: move the bit to position 0
    }

    public static void main(String[] args) {
        int n = 5;
        String b = String.format("%4s", Integer.toBinaryString(n)).replace(' ', '0');
        System.out.println("n = " + n + " -> " + b);
        for (int k = 1; k <= 4; k++)
            System.out.println("k = " + k + ": " + (isKthSetMask(n, k) ? "Yes" : "No")
                               + " " + (isKthSetShift(n, k) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isKthSetMask(n, k) {
    return (n & (1 << (k - 1))) !== 0;   // way 1: move the mask to the bit
}

function isKthSetShift(n, k) {
    return ((n >> (k - 1)) & 1) === 1;   // way 2: move the bit to position 0
}

const n = 5;
console.log("n =", n, "->", n.toString(2).padStart(4, "0"));
for (let k = 1; k <= 4; k++)
    console.log(`k = ${k}:`, isKthSetMask(n, k) ? "Yes" : "No", isKthSetShift(n, k) ? "Yes" : "No");
```

```text filename:Output
n = 5 -> 0101
k = 1: Yes Yes
k = 2: No No
k = 3: Yes Yes
k = 4: No No
```

Time O(1) · Space O(1)

> [!NOTE] Key point
>
> Way 2 is the one to use when you want the bit's <strong>value</strong> (`0`/`1`) rather than a yes/no — e.g. when reading a number bit by bit. Both are a single AND plus a shift.

> [!WARNING] Pitfall
>
> `if n & (1 << (k-1)) == 1` is wrong for `k > 1`: the AND leaves the bit <strong>in place</strong>, so the result is `4` for `k = 3`, not `1`. Compare with `!= 0` (or use the shift form). Also, in C++ `1 << 31` overflows a signed `int` — use `1u << k` or `1LL << k` for high bits.

# Count set bits

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `n = 13`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `n = 255`<br><strong>Output:</strong> `8`

The number of `1` bits is also called the <strong>population count</strong> or <strong>Hamming weight</strong>. There are four standard ways, from obvious to fastest.

<strong>Naive:</strong> walk the bits from LSB to MSB — `n % 2` (or `n & 1`) reads the lowest bit, `n // 2` (or `n >> 1`) drops it. Runs once per bit, set or not.

```python filename:Python
def count_bits(n):
    res = 0
    while n:
        res += n & 1          # 1 if the lowest bit is set
        n >>= 1               # drop it
    return res

for n in (9, 13, 255, 1023):
    print(n, "->", count_bits(n))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int countBits(int n) {
    int res = 0;
    while (n) {
        res += n & 1;         // 1 if the lowest bit is set
        n >>= 1;              // drop it
    }
    return res;
}

int main() {
    for (int n : {9, 13, 255, 1023}) cout << n << " -> " << countBits(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int countBits(int n) {
        int res = 0;
        while (n != 0) {
            res += n & 1;     // 1 if the lowest bit is set
            n >>>= 1;         // logical shift so a negative n also terminates
        }
        return res;
    }

    public static void main(String[] args) {
        for (int n : new int[]{9, 13, 255, 1023}) System.out.println(n + " -> " + countBits(n));
    }
}
```

```javascript filename:JavaScript
function countBits(n) {
    let res = 0;
    while (n !== 0) {
        res += n & 1;         // 1 if the lowest bit is set
        n >>>= 1;             // logical shift so a negative n also terminates
    }
    return res;
}

for (const n of [9, 13, 255, 1023]) console.log(n, "->", countBits(n));
```

```text filename:Output
9 -> 2
13 -> 3
255 -> 8
1023 -> 10
```

Time O(number of bits) = O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> With an <strong>arithmetic</strong> shift (`>>`) a negative `n` never reaches zero — `-1 >> 1` is still `-1` — so the loop runs forever. Use the logical shift (`>>>` in Java/JS, cast to `unsigned` in C++) or loop a fixed 32 times. Python's `n >>= 1` on a negative number has the same problem.

<strong>Brian Kernighan's algorithm:</strong> `n & (n - 1)` clears the rightmost set bit, so the loop runs once <strong>per set bit</strong> instead of once per bit position. For a sparse number it is much faster.

```text filename:Subtracting%201%20flips%20the%20rightmost%201%20and%20every%200%20after%20it%3B%20AND-ing%20keeps%20everything%20to%20its%20left
n = 13:   1101
1101 & 1100 = 1100   (12)   rightmost 1 cleared → count 1
1100 & 1011 = 1000   ( 8)                       → count 2
1000 & 0111 = 0000   ( 0)                       → count 3, stop
```

```python filename:Python
def count_bits(n):
    res = 0
    while n:
        n &= n - 1            # clears the rightmost set bit
        res += 1
    return res

for n in (9, 13, 255, 1023):
    print(n, "->", count_bits(n))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int countBits(int n) {
    int res = 0;
    while (n) {
        n &= n - 1;           // clears the rightmost set bit
        res++;
    }
    return res;
}

int main() {
    for (int n : {9, 13, 255, 1023}) cout << n << " -> " << countBits(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int countBits(int n) {
        int res = 0;
        while (n != 0) {
            n &= n - 1;       // clears the rightmost set bit
            res++;
        }
        return res;
    }

    public static void main(String[] args) {
        for (int n : new int[]{9, 13, 255, 1023}) System.out.println(n + " -> " + countBits(n));
    }
}
```

```javascript filename:JavaScript
function countBits(n) {
    let res = 0;
    while (n !== 0) {
        n &= n - 1;           // clears the rightmost set bit
        res++;
    }
    return res;
}

for (const n of [9, 13, 255, 1023]) console.log(n, "->", countBits(n));
```

```text filename:Output
9 -> 2
13 -> 3
255 -> 8
1023 -> 10
```

Time O(number of set bits) · Space O(1)

<strong>Lookup table:</strong> precompute the count for every byte value `0…255` once (`O(1)`, it is a constant 256 entries), then a 32-bit number is just <strong>four table reads</strong>. Each entry is built from a smaller one: `tbl[i] = (i & 1) + tbl[i >> 1]`.

```python filename:Python
tbl = [0] * 256
for i in range(1, 256):
    tbl[i] = (i & 1) + tbl[i >> 1]      # lowest bit + count of the rest

def count_bits(n):                      # 32-bit n: four bytes
    return (tbl[n & 0xff] + tbl[(n >> 8) & 0xff]
            + tbl[(n >> 16) & 0xff] + tbl[(n >> 24) & 0xff])

for n in (9, 13, 255, 1023):
    print(n, "->", count_bits(n))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int tbl[256];

void initialize() {
    for (int i = 1; i < 256; i++) tbl[i] = (i & 1) + tbl[i >> 1];   // lowest bit + count of the rest
}

int countBits(unsigned n) {             // unsigned: >> never drags a sign bit in
    return tbl[n & 0xff] + tbl[(n >> 8) & 0xff] + tbl[(n >> 16) & 0xff] + tbl[(n >> 24) & 0xff];
}

int main() {
    initialize();
    for (int n : {9, 13, 255, 1023}) cout << n << " -> " << countBits(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int[] tbl = new int[256];

    static void initialize() {
        for (int i = 1; i < 256; i++) tbl[i] = (i & 1) + tbl[i >> 1];   // lowest bit + count of the rest
    }

    static int countBits(int n) {       // >>> so a negative n gives the right 32-bit answer
        return tbl[n & 0xff] + tbl[(n >>> 8) & 0xff] + tbl[(n >>> 16) & 0xff] + tbl[(n >>> 24) & 0xff];
    }

    public static void main(String[] args) {
        initialize();
        for (int n : new int[]{9, 13, 255, 1023}) System.out.println(n + " -> " + countBits(n));
    }
}
```

```javascript filename:JavaScript
const tbl = new Array(256).fill(0);
for (let i = 1; i < 256; i++) tbl[i] = (i & 1) + tbl[i >> 1];   // lowest bit + count of the rest

function countBits(n) {                 // >>> so a negative n gives the right 32-bit answer
    return tbl[n & 0xff] + tbl[(n >>> 8) & 0xff] + tbl[(n >>> 16) & 0xff] + tbl[(n >>> 24) & 0xff];
}

for (const n of [9, 13, 255, 1023]) console.log(n, "->", countBits(n));
```

```text filename:Output
9 -> 2
13 -> 3
255 -> 8
1023 -> 10
```

Time O(1) — four lookups · Space O(1) — a fixed 256-entry table

<strong>Built-ins:</strong> in production code use the library — it compiles to a single `popcnt` instruction where the CPU has one.

```python filename:Python
for n in (9, 13, 255, 1023):
    print(n, "->", n.bit_count())        # Python 3.10+; older: bin(n).count("1")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <bit>
using namespace std;

int main() {
    for (int n : {9, 13, 255, 1023})
        cout << n << " -> " << popcount(static_cast<unsigned>(n)) << "\n";   // C++20; or __builtin_popcount(n)
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        for (int n : new int[]{9, 13, 255, 1023})
            System.out.println(n + " -> " + Integer.bitCount(n));          // Long.bitCount for long
    }
}
```

```javascript filename:JavaScript
for (const n of [9, 13, 255, 1023])
    console.log(n, "->", n.toString(2).split("1").length - 1);   // no popcount in JS: count '1's in the binary string
```

```text filename:Output
9 -> 2
13 -> 3
255 -> 8
1023 -> 10
```

# Is n a power of 2?

> [!TIP] Example
>
> <strong>Input:</strong> `n = 4`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `n = 6`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `n = 0`<br><strong>Output:</strong> `No`

<strong>Naive:</strong> keep halving while `n` is even; it is a power of two if you end at exactly `1`. `O(log n)`.

```python filename:Python
def is_power_of_two(n):
    if n == 0:
        return False
    while n != 1:
        if n % 2 != 0:          # an odd number above 1 cannot be a power of two
            return False
        n //= 2
    return True

for n in (4, 0, 1, 6, 1024):
    print(n, "->", "Yes" if is_power_of_two(n) else "No")
```

```text filename:Output
4 -> Yes
0 -> No
1 -> Yes
6 -> No
1024 -> Yes
```

> [!NOTE] Idea
>
> A power of two has <strong>exactly one</strong> set bit (`1, 10, 100, 1000…`). `n & (n - 1)` clears the rightmost set bit, so for a power of two it leaves `0`; any other positive number still has a bit left. `n = 0` has no set bit at all and must be rejected separately — `0 & (0 - 1)` is also `0`.

```python filename:Python
def is_power_of_two(n):
    return n != 0 and (n & (n - 1)) == 0     # exactly one set bit

for n in (4, 0, 1, 6, 1024):
    print(n, "->", "Yes" if is_power_of_two(n) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

bool isPowerOfTwo(int n) {
    return n != 0 && (n & (n - 1)) == 0;      // exactly one set bit
}

int main() {
    for (int n : {4, 0, 1, 6, 1024})
        cout << n << " -> " << (isPowerOfTwo(n) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isPowerOfTwo(int n) {
        return n != 0 && (n & (n - 1)) == 0;  // exactly one set bit
    }

    public static void main(String[] args) {
        for (int n : new int[]{4, 0, 1, 6, 1024})
            System.out.println(n + " -> " + (isPowerOfTwo(n) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPowerOfTwo(n) {
    return n !== 0 && (n & (n - 1)) === 0;    // exactly one set bit
}

for (const n of [4, 0, 1, 6, 1024])
    console.log(n, "->", isPowerOfTwo(n) ? "Yes" : "No");
```

```text filename:Output
4 -> Yes
0 -> No
1 -> Yes
6 -> No
1024 -> Yes
```

Time O(1) · Space O(1)

> [!WARNING] Pitfall
>
> Two edge cases: `n = 0` passes the `n & (n-1) == 0` test but is not a power of two, and a <strong>negative</strong> `n` such as `-2147483648` (`INT_MIN`, a single set bit in 32 bits) also passes. Write `n > 0 && (n & (n - 1)) == 0` when negatives are possible.

# Find the one odd-occurring element

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 30, 30, 10, 30, 30, 20]`<br><strong>Output:</strong> `20`<br><strong>Input:</strong> `arr = [4, 3, 4, 4, 4, 5, 5]`<br><strong>Output:</strong> `3`

Every element appears an even number of times except one. <strong>Naive:</strong> for each element count its occurrences with a second loop and return the first with an odd count — `O(n²)`.

```python filename:Python
def find_odd(arr):
    for x in arr:
        count = 0
        for y in arr:               # O(n) count for each of the n elements
            if x == y:
                count += 1
        if count % 2 == 1:
            return x
    return -1

print(find_odd([10, 30, 30, 10, 30, 30, 20]))
print(find_odd([4, 3, 4, 4, 4, 5, 5]))
```

```text filename:Output
20
3
```

> [!NOTE] Idea
>
> XOR is commutative and associative, `x ^ x = 0` and `x ^ 0 = x`. XOR-ing the whole array therefore lets every pair cancel itself regardless of order, and the only thing left standing is the element that had no partner.

```text filename:Pairs%20cancel%20to%200%3B%200%20is%20the%20XOR%20identity
  10 ^ 30 ^ 30 ^ 10 ^ 30 ^ 30 ^ 20
= (10 ^ 10) ^ (30 ^ 30) ^ (30 ^ 30) ^ 20      reorder: XOR is commutative
=    0      ^    0      ^    0      ^ 20
= 20
```

```python filename:Python
def find_odd(arr):
    res = 0
    for x in arr:
        res ^= x              # pairs cancel: x ^ x = 0
    return res

for arr in ([10, 30, 30, 10, 30, 30, 20], [4, 3, 4, 4, 4, 5, 5]):
    print(" ".join(map(str, arr)), "->", find_odd(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int findOdd(const vector<int>& arr) {
    int res = 0;
    for (int x : arr) res ^= x;      // pairs cancel: x ^ x = 0
    return res;
}

int main() {
    vector<vector<int>> tests = {{10, 30, 30, 10, 30, 30, 20}, {4, 3, 4, 4, 4, 5, 5}};
    for (const auto& arr : tests) {
        for (int x : arr) cout << x << " ";
        cout << "-> " << findOdd(arr) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int findOdd(int[] arr) {
        int res = 0;
        for (int x : arr) res ^= x;  // pairs cancel: x ^ x = 0
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{10, 30, 30, 10, 30, 30, 20}, {4, 3, 4, 4, 4, 5, 5}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int x : arr) sb.append(x).append(' ');
            System.out.println(sb + "-> " + findOdd(arr));
        }
    }
}
```

```javascript filename:JavaScript
function findOdd(arr) {
    let res = 0;
    for (const x of arr) res ^= x;   // pairs cancel: x ^ x = 0
    return res;
}

for (const arr of [[10, 30, 30, 10, 30, 30, 20], [4, 3, 4, 4, 4, 5, 5]])
    console.log(arr.join(" "), "->", findOdd(arr));
```

```text filename:Output
10 30 30 10 30 30 20 -> 20
4 3 4 4 4 5 5 -> 3
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> The same trick solves <strong>missing number</strong> (XOR `1…n` with the array — the missing value survives) and <strong>find the element that appears once while the rest appear twice</strong>. It fails when more than one element is odd-occurring — the result is the XOR of all of them — which is exactly the next problem.

# Find the two odd-occurring elements

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 4, 3, 4, 5, 4, 4, 6, 7, 7]`<br><strong>Output:</strong> `5 6`<br><strong>Input:</strong> `arr = [20, 15, 20, 16]`<br><strong>Output:</strong> `15 16`

Now exactly two elements, `x` and `y`, occur an odd number of times. XOR-ing everything gives `x ^ y`, which is not enough on its own — we need to separate them.

> [!NOTE] Idea
>
> `x ^ y` has a `1` exactly where `x` and `y` <strong>differ</strong>. Take its rightmost set bit, `sn = xors & -xors`. Partition the array into elements that have that bit set and elements that do not: `x` lands in one group and `y` in the other, and every paired element lands in the same group as its partner. XOR each group separately and the pairs cancel again, leaving `x` in one group and `y` in the other.

```text filename:The%20rightmost%20differing%20bit%20splits%20the%20two%20odd%20elements%20into%20different%20groups
arr = 3 4 3 4 5 4 4 6 7 7
XOR of all      = 5 ^ 6 = 101 ^ 110 = 011          (every pair cancels)
rightmost 1 bit = 011 & -011 = 001                 (5 and 6 differ in bit 0)

bit 0 set   : 3 3 5 7 7   → XOR = 5
bit 0 clear : 4 4 4 4 6   → XOR = 6
```

```python filename:Python
def two_odd(arr):
    xors = 0
    for x in arr:
        xors ^= x                 # = x ^ y
    sn = xors & -xors             # rightmost set bit (same as xors & ~(xors - 1))
    res1 = res2 = 0
    for x in arr:
        if x & sn:
            res1 ^= x             # group with the bit set
        else:
            res2 ^= x             # group with the bit clear
    return min(res1, res2), max(res1, res2)

for arr in ([3, 4, 3, 4, 5, 4, 4, 6, 7, 7], [20, 15, 20, 16]):
    a, b = two_odd(arr)
    print(" ".join(map(str, arr)), "->", a, b)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

pair<int, int> twoOdd(const vector<int>& arr) {
    int xors = 0;
    for (int x : arr) xors ^= x;        // = x ^ y
    int sn = xors & -xors;              // rightmost set bit (same as xors & ~(xors - 1))
    int res1 = 0, res2 = 0;
    for (int x : arr) {
        if (x & sn) res1 ^= x;          // group with the bit set
        else        res2 ^= x;          // group with the bit clear
    }
    return {min(res1, res2), max(res1, res2)};
}

int main() {
    vector<vector<int>> tests = {{3, 4, 3, 4, 5, 4, 4, 6, 7, 7}, {20, 15, 20, 16}};
    for (const auto& arr : tests) {
        for (int x : arr) cout << x << " ";
        auto [a, b] = twoOdd(arr);
        cout << "-> " << a << " " << b << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int[] twoOdd(int[] arr) {
        int xors = 0;
        for (int x : arr) xors ^= x;    // = x ^ y
        int sn = xors & -xors;          // rightmost set bit (same as xors & ~(xors - 1))
        int res1 = 0, res2 = 0;
        for (int x : arr) {
            if ((x & sn) != 0) res1 ^= x;   // group with the bit set
            else               res2 ^= x;   // group with the bit clear
        }
        return new int[]{Math.min(res1, res2), Math.max(res1, res2)};
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 4, 3, 4, 5, 4, 4, 6, 7, 7}, {20, 15, 20, 16}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int x : arr) sb.append(x).append(' ');
            int[] r = twoOdd(arr);
            System.out.println(sb + "-> " + r[0] + " " + r[1]);
        }
    }
}
```

```javascript filename:JavaScript
function twoOdd(arr) {
    let xors = 0;
    for (const x of arr) xors ^= x;     // = x ^ y
    const sn = xors & -xors;            // rightmost set bit (same as xors & ~(xors - 1))
    let res1 = 0, res2 = 0;
    for (const x of arr) {
        if (x & sn) res1 ^= x;          // group with the bit set
        else        res2 ^= x;          // group with the bit clear
    }
    return [Math.min(res1, res2), Math.max(res1, res2)];
}

for (const arr of [[3, 4, 3, 4, 5, 4, 4, 6, 7, 7], [20, 15, 20, 16]]) {
    const [a, b] = twoOdd(arr);
    console.log(arr.join(" "), "->", a, b);
}
```

```text filename:Output
3 4 3 4 5 4 4 6 7 7 -> 5 6
20 15 20 16 -> 15 16
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> The two results come out in <strong>group order</strong>, not sorted — which group holds the smaller value depends on the bit chosen. Sort the pair (as above) or the output will look random. `xors & -xors` relies on two's complement: `-xors` is `~xors + 1`, which agrees with `xors` only at the rightmost set bit.

# Power set using bitmasks

> [!TIP] Example
>
> <strong>Input:</strong> `s = "abc"`<br><strong>Output:</strong> `{} {a} {b} {a,b} {c} {a,c} {b,c} {a,b,c}`

> [!NOTE] Idea
>
> A set of `n` elements has `2^n` subsets, and there are exactly `2^n` integers from `0` to `2^n - 1`. Read each counter as a mask: bit `j` set means <strong>include </strong><strong>`s[j]`</strong>. Looping the counter enumerates every subset exactly once, with no recursion.

```text filename:The%20counter's%20bits%20choose%20the%20elements
s = "abc", n = 3, masks 0 … 7       (bit 0 ↔ a, bit 1 ↔ b, bit 2 ↔ c)

i    c b a    subset
0    0 0 0    {}
1    0 0 1    {a}
2    0 1 0    {b}
3    0 1 1    {a,b}
4    1 0 0    {c}
5    1 0 1    {a,c}
6    1 1 0    {b,c}
7    1 1 1    {a,b,c}
```

```python filename:Python
def power_set(s):
    n = len(s)
    for i in range(1 << n):                      # 2^n masks
        chosen = [s[j] for j in range(n) if i & (1 << j)]   # bit j set → take s[j]
        print(format(i, f"0{n}b"), "-> {" + ",".join(chosen) + "}")

power_set("abc")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

void powerSet(const string& s) {
    int n = s.size();
    for (int i = 0; i < (1 << n); i++) {        // 2^n masks
        string mask, chosen;
        for (int j = n - 1; j >= 0; j--) mask += ((i >> j) & 1) ? '1' : '0';
        for (int j = 0; j < n; j++)
            if (i & (1 << j)) {                  // bit j set → take s[j]
                if (!chosen.empty()) chosen += ',';
                chosen += s[j];
            }
        cout << mask << " -> {" << chosen << "}\n";
    }
}

int main() { powerSet("abc"); }
```

```java filename:Java
public class Main {
    static void powerSet(String s) {
        int n = s.length();
        for (int i = 0; i < (1 << n); i++) {    // 2^n masks
            StringBuilder mask = new StringBuilder(), chosen = new StringBuilder();
            for (int j = n - 1; j >= 0; j--) mask.append((i >> j) & 1);
            for (int j = 0; j < n; j++)
                if ((i & (1 << j)) != 0) {       // bit j set → take s[j]
                    if (chosen.length() > 0) chosen.append(',');
                    chosen.append(s.charAt(j));
                }
            System.out.println(mask + " -> {" + chosen + "}");
        }
    }

    public static void main(String[] args) { powerSet("abc"); }
}
```

```javascript filename:JavaScript
function powerSet(s) {
    const n = s.length;
    for (let i = 0; i < (1 << n); i++) {        // 2^n masks
        const chosen = [];
        for (let j = 0; j < n; j++)
            if (i & (1 << j)) chosen.push(s[j]); // bit j set → take s[j]
        console.log(i.toString(2).padStart(n, "0"), "-> {" + chosen.join(",") + "}");
    }
}

powerSet("abc");
```

```text filename:Output
000 -> {}
001 -> {a}
010 -> {b}
011 -> {a,b}
100 -> {c}
101 -> {a,c}
110 -> {b,c}
111 -> {a,b,c}
```

Time O(2^n · n) · Space O(n) for the current subset

> [!NOTE] Key point
>
> Bitmasks are the standard way to iterate over subsets in <strong>bitmask DP</strong> (travelling salesman, assignment problems): the mask <em>is</em> the state, `mask | (1 << j)` adds an element, `mask & ~(1 << j)` removes one, and `__builtin_popcount(mask)` tells how many are chosen. The recursive include/exclude version of this problem is in the Recursion topic.

# Interview Q&amp;A

```question
Why does n &amp; (n - 1) clear the rightmost set bit?

---

Subtracting 1 borrows from the rightmost `1`: that bit becomes `0` and every `0` to its right becomes `1`; the bits to its left are untouched. AND-ing with `n` keeps the untouched left part and zeroes everything from that bit rightwards. Example: `12 = 1100`, `11 = 1011`, `12 & 11 = 1000`.
```

```question
How do you check if two integers have opposite signs without comparing them?

---

`(x ^ y) < 0`. The sign bit of the XOR is `1` exactly when the sign bits differ. Related: `x` and `y` have the same parity iff `((x ^ y) & 1) == 0`.
```

```question
What is the difference between &gt;&gt; and &gt;&gt;&gt;?

---

`>>` is an arithmetic shift: the sign bit is copied into the vacated positions, so `-16 >> 2 = -4` (floor division). `>>>` (Java, JavaScript) is a logical shift that fills with zeros, so `-16 >>> 2` is `1073741820` — the number reinterpreted as unsigned. C++ gets the logical behaviour by casting to `unsigned`; Python has unbounded ints, so mask to a width first.
```

```question
Every element appears three times except one. Does XOR still work?

---

Plain XOR does not, because `x ^ x ^ x = x` — triples do not cancel. Count the set bits per position: each of the 32 positions has a count that is a multiple of 3 plus the lone element's bit, so `count % 3` rebuilds the answer in `O(32·n)`. Alternatively use two accumulators (`ones`, `twos`) that act as a mod-3 counter per bit.
```

```question
How would you find the missing number in 1…n with one slot missing, without extra space?

---

XOR all numbers `1…n` and XOR all array elements; everything present cancels and the missing number remains. The sum formula `n(n+1)/2 − sum(arr)` also works but can overflow a 32-bit `int` for large `n`, which XOR never does.
```

```question
When is the lookup-table popcount actually better than Kernighan's loop?

---

When numbers are dense (many set bits) and you count millions of them: the table is a constant four array reads with no data-dependent branch, whereas Kernighan does one iteration per set bit (up to 32). For a few calls, or sparse numbers, the loop is simpler and just as fast. In real code use the built-in — it maps to the hardware `popcnt` instruction.
```
