---
id: fc3d74d1-4a76-753f-9b06-406c7a544c02
key: topic:dsa-basics/math
subject: dsa-basics
topic: math
title: Mathematics
slug: mathematics
order: 1
---

A dozen small number problems — digits, divisors, primes, GCD, powers — that every later topic quietly relies on. Each one has an obvious loop and a better idea; learning to see the better idea (`√n`, Euclid, the sieve, squaring) is the real lesson.

> [!INFO]
>
> <strong>Number-theory basics for DSA</strong> — the handful of facts about integers that recur in algorithm problems: digits come off with `% 10` and `// 10`; divisors come in pairs around `√n`; `gcd(a, b) = gcd(b, a mod b)`; the primes up to `n` can all be found in `O(n log log n)`; `xⁿ` needs only `O(log n)` multiplications.

| Problem | Naive | Better idea | Time |
| --- | --- | --- | --- |
| Sum of `1..n` | loop | `n(n+1)/2` | `O(1)` |
| Count digits | convert to string | repeat `n //= 10` | `O(d)`, `d` = digits |
| Palindrome number | string reverse | build the reversed number | `O(d)` |
| Factorial | — | loop or recursion | `O(n)` |
| Trailing zeros of `n!` | compute `n!` | count factors of 5 | `O(log₅ n)` |
| GCD | try every candidate | Euclid: `gcd(b, a mod b)` | `O(log min(a,b))` |
| LCM | try every multiple | `a / gcd · b` | `O(log min(a,b))` |
| Is prime? | divide by `2..n−1` | divide by `6k ± 1` up to `√n` | `O(√n)` |
| Prime factors | test every `i` for primality | divide out `2`, `3`, then `6k ± 1` up to `√n` | `O(√n)` |
| All divisors | test `1..n` | pairs `(i, n/i)` up to `√n` | `O(√n)` |
| All primes `≤ n` | test each number | Sieve of Eratosthenes | `O(n log log n)` |
| `xⁿ` | multiply `n` times | square-and-multiply | `O(log n)` |

# Sum of the first n natural numbers

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `15 (1 + 2 + 3 + 4 + 5)`<br><strong>Input:</strong> `n = 50`<br><strong>Output:</strong> `1275`

> [!NOTE] Idea
>
> Pair the first and last terms: `1 + n`, `2 + (n−1)`, … — every pair sums to `n + 1` and there are `n/2` pairs, so the total is `n(n + 1) / 2`. No loop needed.

The loop is the obvious `O(n)` solution; the formula is `O(1)`. One subtlety: `n(n + 1)` may overflow before the division, so divide the <strong>even</strong> factor first — one of `n` and `n + 1` is always even, which keeps every intermediate value within the final answer's size.

```python filename:Python
def sum_loop(n):                      # O(n): add the numbers one by one
    total = 0
    for x in range(1, n + 1):
        total += x
    return total

def sum_formula(n):                   # O(1): divide the even factor first (no overflow)
    if n % 2 == 0:
        return (n // 2) * (n + 1)
    return ((n + 1) // 2) * n         # n odd → n + 1 is even

for n in (5, 50, 51):
    print(f"sum({n}): loop = {sum_loop(n)}, formula = {sum_formula(n)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long sumLoop(int n) {            // O(n): add the numbers one by one
    long long total = 0;
    for (int x = 1; x <= n; x++) total += x;
    return total;
}

long long sumFormula(long long n) {   // O(1): divide the even factor first (no overflow)
    if (n % 2 == 0) return (n / 2) * (n + 1);
    return ((n + 1) / 2) * n;         // n odd → n + 1 is even
}

int main() {
    for (int n : {5, 50, 51})
        cout << "sum(" << n << "): loop = " << sumLoop(n) << ", formula = " << sumFormula(n) << "\n";
}
```

```java filename:Java
public class Main {
    static long sumLoop(int n) {          // O(n): add the numbers one by one
        long total = 0;
        for (int x = 1; x <= n; x++) total += x;
        return total;
    }

    static long sumFormula(long n) {      // O(1): divide the even factor first (no overflow)
        if (n % 2 == 0) return (n / 2) * (n + 1);
        return ((n + 1) / 2) * n;         // n odd → n + 1 is even
    }

    public static void main(String[] args) {
        for (int n : new int[]{5, 50, 51})
            System.out.println("sum(" + n + "): loop = " + sumLoop(n) + ", formula = " + sumFormula(n));
    }
}
```

```javascript filename:JavaScript
function sumLoop(n) {                 // O(n): add the numbers one by one
    let total = 0;
    for (let x = 1; x <= n; x++) total += x;
    return total;
}

function sumFormula(n) {              // O(1): divide the even factor first (no overflow)
    if (n % 2 === 0) return (n / 2) * (n + 1);
    return ((n + 1) / 2) * n;         // n odd → n + 1 is even
}

for (const n of [5, 50, 51])
    console.log(`sum(${n}): loop = ${sumLoop(n)}, formula = ${sumFormula(n)}`);
```

```text filename:Output
sum(5): loop = 15, formula = 15
sum(50): loop = 1275, formula = 1275
sum(51): loop = 1326, formula = 1326
```

Time O(1) with the formula, O(n) with the loop · Space O(1)

> [!WARNING] Pitfall
>
> The original notes used `/` in Python, which returns a <strong>float</strong> (`15.0`). Use integer division `//` — and in C++/Java use a 64-bit type, since `n(n+1)` overflows a 32-bit `int` for `n` around 46 000 even though the answer still fits.

# Count digits

> [!TIP] Example
>
> <strong>Input:</strong> `n = 256`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `n = 75`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `1`

> [!NOTE] Idea
>
> `n % 10` is the last digit and `n // 10` drops it. Count how many times you can drop a digit before reaching `0` — that is the number of digits. The loop runs once per digit, i.e. `⌊log₁₀ n⌋ + 1` times.

```python filename:Python
def count_digits(n):
    n = abs(n)
    if n == 0:
        return 1                 # 0 is one digit, but the loop below would say 0
    count = 0
    while n > 0:
        n //= 10                 # drop the last digit
        count += 1
    return count

for n in (256, 75, 5, 0, 9253):
    print(n, "→", count_digits(n))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <cstdlib>
using namespace std;

int countDigits(int n) {
    n = abs(n);
    if (n == 0) return 1;        // 0 is one digit, but the loop below would say 0
    int count = 0;
    while (n > 0) {
        n /= 10;                 // drop the last digit
        count++;
    }
    return count;
}

int main() {
    for (int n : {256, 75, 5, 0, 9253})
        cout << n << " → " << countDigits(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int countDigits(int n) {
        n = Math.abs(n);
        if (n == 0) return 1;        // 0 is one digit, but the loop below would say 0
        int count = 0;
        while (n > 0) {
            n /= 10;                 // drop the last digit
            count++;
        }
        return count;
    }

    public static void main(String[] args) {
        for (int n : new int[]{256, 75, 5, 0, 9253})
            System.out.println(n + " → " + countDigits(n));
    }
}
```

```javascript filename:JavaScript
function countDigits(n) {
    n = Math.abs(n);
    if (n === 0) return 1;       // 0 is one digit, but the loop below would say 0
    let count = 0;
    while (n > 0) {
        n = Math.floor(n / 10);  // drop the last digit (no integer division in JS)
        count++;
    }
    return count;
}

for (const n of [256, 75, 5, 0, 9253])
    console.log(n, "→", countDigits(n));
```

```text filename:Output
256 → 3
75 → 2
5 → 1
0 → 1
9253 → 4
```

Time O(d) = O(log₁₀ n) · Space O(1)

> [!NOTE] Key point
>
> Alternatives: `len(str(n))` (allocates a string) or `floor(log10(n)) + 1` (floating-point, breaks for `n = 0` and can be off by one for exact powers of ten). The loop is the one to remember — the same `% 10` / `// 10` pattern reverses numbers, sums digits and checks palindromes.

# Palindrome number

> [!TIP] Example
>
> <strong>Input:</strong> `n = 12321`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `n = 42322`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `n = 78987`<br><strong>Output:</strong> `Yes`

> [!NOTE] Idea
>
> A number reads the same backwards if it equals its own digit-reversal. Build the reversed number with `rev = rev * 10 + n % 10` while stripping digits off `n`, then compare with the original — no string conversion, `O(1)` extra space.

```text filename:Reversing%2012321%20digit%20by%20digit
n = 12321, rev = 0
step 1: digit 1 → rev = 1        n = 1232
step 2: digit 2 → rev = 12       n = 123
step 3: digit 3 → rev = 123      n = 12
step 4: digit 2 → rev = 1232     n = 1
step 5: digit 1 → rev = 12321    n = 0   → rev == original → palindrome
```

```python filename:Python
def is_palindrome(n):
    if n < 0:
        return False             # "-121" reversed is "121-"
    rev, x = 0, n
    while x > 0:
        rev = rev * 10 + x % 10  # append the last digit of x to rev
        x //= 10
    return rev == n

for n in (12321, 42322, 78987, 10):
    print(n, "→", "Yes" if is_palindrome(n) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

bool isPalindrome(long long n) {
    if (n < 0) return false;     // "-121" reversed is "121-"
    long long rev = 0, x = n;
    while (x > 0) {
        rev = rev * 10 + x % 10; // append the last digit of x to rev
        x /= 10;
    }
    return rev == n;
}

int main() {
    for (long long n : {12321, 42322, 78987, 10})
        cout << n << " → " << (isPalindrome(n) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isPalindrome(long n) {
        if (n < 0) return false;     // "-121" reversed is "121-"
        long rev = 0, x = n;
        while (x > 0) {
            rev = rev * 10 + x % 10; // append the last digit of x to rev
            x /= 10;
        }
        return rev == n;
    }

    public static void main(String[] args) {
        for (long n : new long[]{12321, 42322, 78987, 10})
            System.out.println(n + " → " + (isPalindrome(n) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPalindrome(n) {
    if (n < 0) return false;             // "-121" reversed is "121-"
    let rev = 0, x = n;
    while (x > 0) {
        rev = rev * 10 + (x % 10);       // append the last digit of x to rev
        x = Math.floor(x / 10);
    }
    return rev === n;
}

for (const n of [12321, 42322, 78987, 10])
    console.log(n, "→", isPalindrome(n) ? "Yes" : "No");
```

```text filename:Output
12321 → Yes
42322 → No
78987 → Yes
10 → No
```

Time O(d) · Space O(1)

> [!WARNING] Pitfall
>
> The reversed value of a large `int` can overflow even when the input fits (`1 000 000 003` reversed is `3 000 000 001 > 2³¹`). Use a 64-bit type for `rev`, or stop halfway: reverse only the second half and compare it with the first (the LeetCode variant).

# Factorial

> [!TIP] Example
>
> <strong>Input:</strong> `n = 3`<br><strong>Output:</strong> `6 (3 × 2 × 1)`<br><strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `120`<br><strong>Input:</strong> `n = 0`<br><strong>Output:</strong> `1`

> [!NOTE] Idea
>
> `n! = n × (n−1)!` with `0! = 1`. A loop multiplies `1..n` into an accumulator; the recursive version is the definition written as code. Both are `O(n)` time — the difference is the `O(n)` call stack the recursion needs.

```python filename:Python
def fact_iterative(n):           # O(n) time, O(1) auxiliary space
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def fact_recursive(n):           # O(n) time, O(n) stack frames
    if n == 0:                   # base case: 0! = 1 (not n == 1, or fact(0) never stops)
        return 1
    return n * fact_recursive(n - 1)

for n in (0, 3, 5, 10, 20):
    print(f"{n}! = {fact_iterative(n)} (iterative) {fact_recursive(n)} (recursive)")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long factIterative(int n) {     // O(n) time, O(1) auxiliary space
    long long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}

long long factRecursive(int n) {     // O(n) time, O(n) stack frames
    if (n == 0) return 1;            // base case: 0! = 1
    return n * factRecursive(n - 1);
}

int main() {
    for (int n : {0, 3, 5, 10, 20})
        cout << n << "! = " << factIterative(n) << " (iterative) " << factRecursive(n) << " (recursive)\n";
}
```

```java filename:Java
public class Main {
    static long factIterative(int n) {   // O(n) time, O(1) auxiliary space
        long result = 1;
        for (int i = 2; i <= n; i++) result *= i;
        return result;
    }

    static long factRecursive(int n) {   // O(n) time, O(n) stack frames
        if (n == 0) return 1;            // base case: 0! = 1
        return n * factRecursive(n - 1);
    }

    public static void main(String[] args) {
        for (int n : new int[]{0, 3, 5, 10, 20})
            System.out.println(n + "! = " + factIterative(n) + " (iterative) " + factRecursive(n) + " (recursive)");
    }
}
```

```javascript filename:JavaScript
function factIterative(n) {          // O(n) time, O(1) auxiliary space — BigInt: 20! > 2^53
    let result = 1n;
    for (let i = 2n; i <= BigInt(n); i++) result *= i;
    return result;
}

function factRecursive(n) {          // O(n) time, O(n) stack frames
    if (n === 0) return 1n;          // base case: 0! = 1
    return BigInt(n) * factRecursive(n - 1);
}

for (const n of [0, 3, 5, 10, 20])
    console.log(`${n}! = ${factIterative(n)} (iterative) ${factRecursive(n)} (recursive)`);
```

```text filename:Output
0! = 1 (iterative) 1 (recursive)
3! = 6 (iterative) 6 (recursive)
5! = 120 (iterative) 120 (recursive)
10! = 3628800 (iterative) 3628800 (recursive)
20! = 2432902008176640000 (iterative) 2432902008176640000 (recursive)
```

Time O(n) · Space O(1) iterative, O(n) recursive (call stack)

> [!WARNING] Pitfall
>
> The original notes had the space costs backwards: it is the <strong>recursive</strong> version that uses `O(n)` auxiliary space (one frame per pending multiplication); the loop uses `O(1)`. Also: `13!` overflows a 32-bit `int`, `21!` overflows 64 bits, and JavaScript's `Number` loses exactness after `18!` — hence `BigInt` above. Python integers are unbounded.

# Trailing zeros in a factorial

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `1 (5! = 120)`<br><strong>Input:</strong> `n = 10`<br><strong>Output:</strong> `2 (10! = 3628800)`<br><strong>Input:</strong> `n = 100`<br><strong>Output:</strong> `24`

> [!NOTE] Idea
>
> A trailing zero is a factor of `10 = 2 × 5`. In `n!` there are always far more factors of 2 than of 5, so the zeros are counted by the <strong>factors of 5</strong>: every multiple of 5 contributes one, every multiple of 25 contributes a second, every multiple of 125 a third… Sum `n/5 + n/25 + n/125 + …` using integer division.

`zeros(n!) = ⌊n/5⌋ + ⌊n/25⌋ + ⌊n/125⌋ + … (until the term is 0)`

> [!TIP] Worked example
>
> `n = 100`: `100/5 = 20`, `100/25 = 4`, `100/125 = 0` → `24` trailing zeros. Computing `100!` (158 digits) is never needed.

```python filename:Python
def trailing_zeros(n):
    count = 0
    power = 5
    while n // power >= 1:       # 5, 25, 125, … each adds one more factor of 5
        count += n // power
        power *= 5
    return count

for n in (5, 10, 25, 50, 100):
    print(n, "→", trailing_zeros(n))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int trailingZeros(int n) {
    int count = 0;
    for (long long power = 5; n / power >= 1; power *= 5)   // 5, 25, 125, …
        count += n / power;
    return count;
}

int main() {
    for (int n : {5, 10, 25, 50, 100})
        cout << n << " → " << trailingZeros(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int trailingZeros(int n) {
        int count = 0;
        for (long power = 5; n / power >= 1; power *= 5)     // 5, 25, 125, …
            count += n / power;
        return count;
    }

    public static void main(String[] args) {
        for (int n : new int[]{5, 10, 25, 50, 100})
            System.out.println(n + " → " + trailingZeros(n));
    }
}
```

```javascript filename:JavaScript
function trailingZeros(n) {
    let count = 0;
    for (let power = 5; Math.floor(n / power) >= 1; power *= 5)   // 5, 25, 125, …
        count += Math.floor(n / power);
    return count;
}

for (const n of [5, 10, 25, 50, 100])
    console.log(n, "→", trailingZeros(n));
```

```text filename:Output
5 → 1
10 → 2
25 → 6
50 → 12
100 → 24
```

Time O(log₅ n) · Space O(1)

> [!WARNING] Pitfall
>
> Counting only `n / 5` misses the extra fives: `25 = 5 × 5` contributes <strong>two</strong> zeros, so `25!` has 6 trailing zeros, not 5. The original example (“Input 50, Output 1”) was wrong — `50!` ends in 12 zeros; it is `5!` that ends in one.

# GCD / HCF of two numbers

> [!TIP] Example
>
> <strong>Input:</strong> `a = 20, b = 28`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `a = 100, b = 75`<br><strong>Output:</strong> `25`<br><strong>Input:</strong> `a = 17, b = 5`<br><strong>Output:</strong> `1`

The <strong>greatest common divisor</strong> (also called highest common factor) is the largest number that divides both. Factors of 20: `1 2 4 5 10 20`; factors of 28: `1 2 4 7 14 28`; the largest shared one is `4`.

The naive method walks down from `min(a, b)` until it finds a common divisor — `O(min(a, b))`:

```python filename:Python
def gcd_naive(a, b):
    result = min(a, b)
    while result > 0:
        if a % result == 0 and b % result == 0:
            break                       # first common divisor from the top is the greatest
        result -= 1
    return result

print(gcd_naive(20, 28))    # 4
print(gcd_naive(100, 75))   # 25
```

> [!NOTE] Idea
>
> <strong>Euclid's algorithm</strong>: any divisor of both `a` and `b` also divides `a − b`, and hence `a mod b`. So `gcd(a, b) = gcd(b, a mod b)`, and when `b` becomes `0` the answer is `a`. The remainder at least halves every two steps, giving `O(log min(a, b))`.

```text filename:Euclid's%20algorithm%3A%20the%20remainder%20shrinks%20fast
gcd(1071, 462)
  1071 = 2 · 462 + 147   →  gcd(462, 147)
   462 = 3 · 147 +  21   →  gcd(147, 21)
   147 = 7 ·  21 +   0   →  gcd(21, 0) = 21
```

```python filename:Python
def gcd_recursive(a, b):
    if b == 0:
        return a
    return gcd_recursive(b, a % b)   # gcd(a, b) = gcd(b, a mod b)

def gcd(a, b):                       # same idea, iterative: O(1) space
    while b:
        a, b = b, a % b
    return a

for a, b in [(20, 28), (100, 75), (17, 5), (1071, 462), (0, 9)]:
    assert gcd(a, b) == gcd_recursive(a, b)
    print(f"gcd({a}, {b}) = {gcd(a, b)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int gcdRecursive(int a, int b) {
    if (b == 0) return a;
    return gcdRecursive(b, a % b);   // gcd(a, b) = gcd(b, a mod b)
}

int gcd(int a, int b) {              // same idea, iterative: O(1) space
    while (b != 0) {
        int r = a % b;
        a = b;
        b = r;
    }
    return a;
}

int main() {
    int pairs[5][2] = {{20, 28}, {100, 75}, {17, 5}, {1071, 462}, {0, 9}};
    for (auto& ab : pairs) {
        int g = gcd(ab[0], ab[1]);
        if (g != gcdRecursive(ab[0], ab[1])) return 1;
        cout << "gcd(" << ab[0] << ", " << ab[1] << ") = " << g << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int gcdRecursive(int a, int b) {
        if (b == 0) return a;
        return gcdRecursive(b, a % b);   // gcd(a, b) = gcd(b, a mod b)
    }

    static int gcd(int a, int b) {       // same idea, iterative: O(1) space
        while (b != 0) {
            int r = a % b;
            a = b;
            b = r;
        }
        return a;
    }

    public static void main(String[] args) {
        int[][] pairs = {{20, 28}, {100, 75}, {17, 5}, {1071, 462}, {0, 9}};
        for (int[] ab : pairs) {
            int g = gcd(ab[0], ab[1]);
            assert g == gcdRecursive(ab[0], ab[1]);
            System.out.println("gcd(" + ab[0] + ", " + ab[1] + ") = " + g);
        }
    }
}
```

```javascript filename:JavaScript
function gcdRecursive(a, b) {
    if (b === 0) return a;
    return gcdRecursive(b, a % b);   // gcd(a, b) = gcd(b, a mod b)
}

function gcd(a, b) {                 // same idea, iterative: O(1) space
    while (b !== 0) [a, b] = [b, a % b];
    return a;
}

for (const [a, b] of [[20, 28], [100, 75], [17, 5], [1071, 462], [0, 9]]) {
    const g = gcd(a, b);
    if (g !== gcdRecursive(a, b)) throw new Error("mismatch");
    console.log(`gcd(${a}, ${b}) = ${g}`);
}
```

```text filename:Output
gcd(20, 28) = 4
gcd(100, 75) = 25
gcd(17, 5) = 1
gcd(1071, 462) = 21
gcd(0, 9) = 9
```

Time O(log min(a, b)) · Space O(1) iterative, O(log min(a, b)) recursive

The original notes also had a <strong>subtraction-only</strong> version, `while a != b: subtract the smaller from the larger`. It is correct, but it is <em>not</em> the optimised one: for `gcd(1, 10⁹)` it loops a billion times, whereas the modulo version finishes in one step. Keep it as a curiosity:

```python filename:Python
def gcd_subtract(a, b):
    while a != b:
        if a > b:
            a -= b
        else:
            b -= a                   # each step removes one multiple — O(max(a, b)) worst case
    return a

print(gcd_subtract(20, 28))    # 4
```

> [!NOTE] Key point
>
> Libraries: Python `math.gcd`, C++ `std::gcd` (`<numeric>`), Java `BigInteger.gcd` (no primitive version), JavaScript has none. In interviews write Euclid yourself — it is three lines.

# LCM of two numbers

> [!TIP] Example
>
> <strong>Input:</strong> `a = 15, b = 20`<br><strong>Output:</strong> `60`<br><strong>Input:</strong> `a = 4, b = 6`<br><strong>Output:</strong> `12`

The <strong>least common multiple</strong> is the smallest positive number divisible by both. The naive way starts at `max(a, b)` and counts up until a common multiple appears — up to `a · b` steps:

```python filename:Python
def lcm_naive(a, b):
    res = max(a, b)
    while True:
        if res % a == 0 and res % b == 0:
            return res
        res += 1

print(lcm_naive(15, 20))   # 60
```

> [!NOTE] Idea
>
> `a · b = gcd(a, b) · lcm(a, b)` — every prime factor appears in the product exactly once as a “shared” copy (the gcd) and once as a “max” copy (the lcm). So `lcm = a / gcd(a, b) · b`. Divide <strong>before</strong> multiplying to keep the intermediate value small.

```python filename:Python
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def lcm(a, b):
    return a // gcd(a, b) * b        # divide first: a/g is an integer, product stays small

for a, b in [(15, 20), (4, 6), (7, 13), (12, 18)]:
    print(f"lcm({a}, {b}) = {lcm(a, b)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long gcd(long long a, long long b) {
    while (b != 0) { long long r = a % b; a = b; b = r; }
    return a;
}

long long lcm(long long a, long long b) {
    return a / gcd(a, b) * b;        // divide first: a/g is an integer, product stays small
}

int main() {
    long long pairs[4][2] = {{15, 20}, {4, 6}, {7, 13}, {12, 18}};
    for (auto& ab : pairs)
        cout << "lcm(" << ab[0] << ", " << ab[1] << ") = " << lcm(ab[0], ab[1]) << "\n";
}
```

```java filename:Java
public class Main {
    static long gcd(long a, long b) {
        while (b != 0) { long r = a % b; a = b; b = r; }
        return a;
    }

    static long lcm(long a, long b) {
        return a / gcd(a, b) * b;        // divide first: a/g is an integer, product stays small
    }

    public static void main(String[] args) {
        long[][] pairs = {{15, 20}, {4, 6}, {7, 13}, {12, 18}};
        for (long[] ab : pairs)
            System.out.println("lcm(" + ab[0] + ", " + ab[1] + ") = " + lcm(ab[0], ab[1]));
    }
}
```

```javascript filename:JavaScript
function gcd(a, b) {
    while (b !== 0) [a, b] = [b, a % b];
    return a;
}

function lcm(a, b) {
    return (a / gcd(a, b)) * b;      // divide first: a/g is an integer, product stays small
}

for (const [a, b] of [[15, 20], [4, 6], [7, 13], [12, 18]])
    console.log(`lcm(${a}, ${b}) = ${lcm(a, b)}`);
```

```text filename:Output
lcm(15, 20) = 60
lcm(4, 6) = 12
lcm(7, 13) = 91
lcm(12, 18) = 36
```

Time O(log min(a, b)) · Space O(1)

> [!WARNING] Pitfall
>
> `a * b / gcd` computes the product first and overflows for large inputs; `a / gcd * b` never exceeds the answer. And once more: Python's `/` yields a float (`60.0`) — the original notes' `abs(a * b) / GCD(a, b)` printed `60.0`.

# Check for prime

> [!TIP] Example
>
> <strong>Input:</strong> `n = 11`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `n = 10`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `n = 1`<br><strong>Output:</strong> `No`

A prime has exactly two divisors, `1` and itself; `1` is <strong>not</strong> prime. The naive test tries every `i` from `2` to `n − 1` — `O(n)`:

```python filename:Python
def is_prime_naive(n):
    if n <= 1:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return True

print(is_prime_naive(11))   # True
print(is_prime_naive(10))   # False
```

> [!NOTE] Idea
>
> Divisors come in pairs `(i, n / i)`, and one of them is always `≤ √n` — so if nothing up to `√n` divides `n`, nothing does. Then skip multiples of 2 and 3: every prime above 3 has the form `6k ± 1`, so after checking `2` and `3` it is enough to test `5, 7, 11, 13, 17, 19…` — a third of the candidates.

1. <strong>Handle the small cases</strong>

   `n ≤ 1` → not prime; `n ≤ 3` → prime.

2. <strong>Remove multiples of 2 and 3</strong>

   If `n % 2 == 0` or `n % 3 == 0` → not prime.

3. <strong>Test </strong><strong>`6k ± 1`</strong><strong> up to </strong><strong>`√n`</strong>

   `i = 5, 11, 17…` (step 6), checking both `i` and `i + 2`. Use `i * i <= n` instead of `sqrt` to avoid floating point.

```python filename:Python
def is_prime(n):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:                # only up to √n
        if n % i == 0 or n % (i + 2) == 0:   # 6k - 1 and 6k + 1
            return False
        i += 6
    return True

for n in (1, 2, 10, 11, 97, 1000003, 1000001):
    print(n, "→", "Yes" if is_prime(n) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

bool isPrime(long long n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (long long i = 5; i * i <= n; i += 6)          // only up to √n
        if (n % i == 0 || n % (i + 2) == 0) return false;   // 6k - 1 and 6k + 1
    return true;
}

int main() {
    for (long long n : {1, 2, 10, 11, 97, 1000003, 1000001})
        cout << n << " → " << (isPrime(n) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isPrime(long n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 == 0 || n % 3 == 0) return false;
        for (long i = 5; i * i <= n; i += 6)              // only up to √n
            if (n % i == 0 || n % (i + 2) == 0) return false;   // 6k - 1 and 6k + 1
        return true;
    }

    public static void main(String[] args) {
        for (long n : new long[]{1, 2, 10, 11, 97, 1000003, 1000001})
            System.out.println(n + " → " + (isPrime(n) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPrime(n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6)                  // only up to √n
        if (n % i === 0 || n % (i + 2) === 0) return false;   // 6k - 1 and 6k + 1
    return true;
}

for (const n of [1, 2, 10, 11, 97, 1000003, 1000001])
    console.log(n, "→", isPrime(n) ? "Yes" : "No");
```

```text filename:Output
1 → No
2 → Yes
10 → No
11 → Yes
97 → Yes
1000003 → Yes
1000001 → No
```

Time O(√n) · Space O(1)

> [!WARNING] Pitfall
>
> Forgetting `n = 1` (not prime) and `n = 2` (the only even prime) are the classic slips. Using `i <= sqrt(n)` with floating point can misjudge perfect squares of large primes; `i * i <= n` is exact (use a 64-bit `i` so the square cannot overflow).

# Prime factorization

> [!TIP] Example
>
> <strong>Input:</strong> `n = 100`<br><strong>Output:</strong> `2 2 5 5 (100 = 2² × 5²)`<br><strong>Input:</strong> `n = 315`<br><strong>Output:</strong> `3 3 5 7`

The original notes tested every `i` from `2` to `n` for primality and then divided it out — `O(n √n)`. That primality test is unnecessary: if you divide out each factor <strong>completely</strong> as soon as you meet it, every later `i` that divides `n` is automatically prime (all its smaller factors are already gone).

> [!NOTE] Idea
>
> Divide out all 2s, then all 3s, then try `i = 5, 7, 11, 13…` (`6k ± 1`) while `i * i ≤ n`, dividing out each as many times as it goes. Whatever is left above `1` at the end is a single prime factor larger than `√n` — there can be at most one.

```python filename:Python
def prime_factors(n):
    factors = []
    while n % 2 == 0:                 # all the 2s
        factors.append(2)
        n //= 2
    while n % 3 == 0:                 # all the 3s
        factors.append(3)
        n //= 3
    i = 5
    while i * i <= n:                 # 6k ± 1 candidates up to √n
        for d in (i, i + 2):
            while n % d == 0:
                factors.append(d)
                n //= d
        i += 6
    if n > 1:                         # one prime factor > √n may remain
        factors.append(n)
    return factors

for n in (100, 315, 97, 1001, 1):
    print(n, "→", *prime_factors(n))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> primeFactors(int n) {
    vector<int> factors;
    while (n % 2 == 0) { factors.push_back(2); n /= 2; }   // all the 2s
    while (n % 3 == 0) { factors.push_back(3); n /= 3; }   // all the 3s
    for (int i = 5; i * i <= n; i += 6)                    // 6k ± 1 candidates up to √n
        for (int d : {i, i + 2})
            while (n % d == 0) { factors.push_back(d); n /= d; }
    if (n > 1) factors.push_back(n);                       // one prime factor > √n may remain
    return factors;
}

int main() {
    for (int n : {100, 315, 97, 1001, 1}) {
        cout << n << " →";
        for (int f : primeFactors(n)) cout << " " << f;
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> primeFactors(int n) {
        List<Integer> factors = new ArrayList<>();
        while (n % 2 == 0) { factors.add(2); n /= 2; }        // all the 2s
        while (n % 3 == 0) { factors.add(3); n /= 3; }        // all the 3s
        for (int i = 5; i * i <= n; i += 6)                   // 6k ± 1 candidates up to √n
            for (int d : new int[]{i, i + 2})
                while (n % d == 0) { factors.add(d); n /= d; }
        if (n > 1) factors.add(n);                            // one prime factor > √n may remain
        return factors;
    }

    public static void main(String[] args) {
        for (int n : new int[]{100, 315, 97, 1001, 1}) {
            StringBuilder sb = new StringBuilder(n + " →");
            for (int f : primeFactors(n)) sb.append(' ').append(f);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function primeFactors(n) {
    const factors = [];
    while (n % 2 === 0) { factors.push(2); n /= 2; }         // all the 2s
    while (n % 3 === 0) { factors.push(3); n /= 3; }         // all the 3s
    for (let i = 5; i * i <= n; i += 6)                      // 6k ± 1 candidates up to √n
        for (const d of [i, i + 2])
            while (n % d === 0) { factors.push(d); n /= d; }
    if (n > 1) factors.push(n);                              // one prime factor > √n may remain
    return factors;
}

for (const n of [100, 315, 97, 1001, 1])
    console.log(`${n} →${primeFactors(n).map(f => " " + f).join("")}`);
```

```text filename:Output
100 → 2 2 5 5
315 → 3 3 5 7
97 → 97
1001 → 7 11 13
1 →
```

Time O(√n) · Space O(log n) for the list of factors

> [!WARNING] Pitfall
>
> Stopping at `√n` without the final `if n > 1` check loses the largest factor: `1001 = 7 × 11 × 13` leaves `n = 13` after `7` and `11` are divided out, and `13 > √13`. Also `1` has no prime factors — the loop must print nothing, not `1`.

# All divisors of a number

> [!TIP] Example
>
> <strong>Input:</strong> `n = 10`<br><strong>Output:</strong> `1 2 5 10`<br><strong>Input:</strong> `n = 100`<br><strong>Output:</strong> `1 2 4 5 10 20 25 50 100`

Naively, test every `i` in `1..n` — `O(n)`:

```python filename:Python
def divisors_naive(n):
    return [i for i in range(1, n + 1) if n % i == 0]

print(divisors_naive(10))   # [1, 2, 5, 10]
```

> [!NOTE] Idea
>
> Divisors come in <strong>pairs</strong> `(i, n / i)` with `i ≤ √n ≤ n / i`. Loop `i` from `1` while `i * i ≤ n` and emit both members of each pair — that finds every divisor in `O(√n)`. When `i * i == n` the pair is the same number: print it once.

Emitting both members as you go gives the divisors <em>unsorted</em> (`1 100 2 50 4 25 5 20 10`). To get them <strong>sorted</strong> with no extra memory, print the small members on the way up and the large partners on the way back down:

```python filename:Python
import math

def divisors_unsorted(n):            # O(√n), pairs printed together
    out = []
    i = 1
    while i * i <= n:
        if n % i == 0:
            out.append(i)
            if n // i != i:          # perfect square: don't print √n twice
                out.append(n // i)
        i += 1
    return out

print(divisors_unsorted(100))        # [1, 100, 2, 50, 4, 25, 5, 20, 10]
```

```python filename:Python
def divisors_sorted(n):
    out = []
    i = 1
    while i * i < n:                   # ascending: small members of each pair
        if n % i == 0:
            out.append(i)
        i += 1
    if i * i == n:                     # perfect square: √n once
        out.append(i)
    i -= 1 if i * i == n else 0
    while i >= 1:                      # descending i → ascending partners n / i
        if n % i == 0 and i * i != n:
            out.append(n // i)
        i -= 1
    return out

for n in (10, 100, 36, 97):
    print(n, "→", *divisors_sorted(n))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> divisorsSorted(int n) {
    vector<int> out;
    int i = 1;
    for (; i * i < n; i++)                      // ascending: small members of each pair
        if (n % i == 0) out.push_back(i);
    if (i * i == n) out.push_back(i);           // perfect square: √n once
    for (i = i * i == n ? i - 1 : i; i >= 1; i--)   // descending i → ascending partners n / i
        if (n % i == 0 && i * i != n) out.push_back(n / i);
    return out;
}

int main() {
    for (int n : {10, 100, 36, 97}) {
        cout << n << " →";
        for (int d : divisorsSorted(n)) cout << " " << d;
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> divisorsSorted(int n) {
        List<Integer> out = new ArrayList<>();
        int i = 1;
        for (; i * i < n; i++)                      // ascending: small members of each pair
            if (n % i == 0) out.add(i);
        if (i * i == n) out.add(i);                 // perfect square: √n once
        for (i = i * i == n ? i - 1 : i; i >= 1; i--)   // descending i → ascending partners n / i
            if (n % i == 0 && i * i != n) out.add(n / i);
        return out;
    }

    public static void main(String[] args) {
        for (int n : new int[]{10, 100, 36, 97}) {
            StringBuilder sb = new StringBuilder(n + " →");
            for (int d : divisorsSorted(n)) sb.append(' ').append(d);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function divisorsSorted(n) {
    const out = [];
    let i = 1;
    for (; i * i < n; i++)                          // ascending: small members of each pair
        if (n % i === 0) out.push(i);
    if (i * i === n) out.push(i);                   // perfect square: √n once
    for (i = i * i === n ? i - 1 : i; i >= 1; i--)  // descending i → ascending partners n / i
        if (n % i === 0 && i * i !== n) out.push(n / i);
    return out;
}

for (const n of [10, 100, 36, 97])
    console.log(`${n} →${divisorsSorted(n).map(d => " " + d).join("")}`);
```

```text filename:Output
10 → 1 2 5 10
100 → 1 2 4 5 10 20 25 50 100
36 → 1 2 3 4 6 9 12 18 36
97 → 1 97
```

Time O(√n) · Space O(1) besides the output

> [!WARNING] Pitfall
>
> `36 = 6 × 6`: the pair `(6, 6)` must be printed <strong>once</strong>. Checking `n / i != i` (unsorted version) or handling `i * i == n` separately (sorted version) is the detail interviewers look for.

# Sieve of Eratosthenes

> [!TIP] Example
>
> <strong>Input:</strong> `n = 10`<br><strong>Output:</strong> `2 3 5 7`<br><strong>Input:</strong> `n = 50`<br><strong>Output:</strong> `2 3 5 7 11 13 17 19 23 29 31 37 41 43 47`

To list <strong>all</strong> primes up to `n`, testing each number separately costs `O(n √n)`. The sieve does far better by working the other way round: instead of asking “is `x` prime?”, it <em>crosses out</em> every multiple of each prime found.

> [!NOTE] Idea
>
> Keep a boolean array `is_prime[0..n]`, all `true`. For each `i` from `2` while `i * i ≤ n`: if `i` is still marked prime, cross out `i², i² + i, i² + 2i, …`. Smaller multiples like `2i, 3i` were already crossed out by smaller primes, which is why starting at `i²` is enough and why `i` only needs to run up to `√n`.

```text filename:Crossing%20out%20multiples%3A%20everything%20still%20standing%20is%20prime
n = 30, after sieving with 2, 3 and 5 (5² = 25 ≤ 30, 7² = 49 > 30 → stop)

 2  3  x  5  x  7  x  x  x 11  x 13  x  x  x 17  x 19  x  x  x 23  x  x  x  x  x 29  x
 ^  ^     ^     ^           ^     ^           ^     ^           ^                 ^
primes: 2 3 5 7 11 13 17 19 23 29
```

```python filename:Python
def sieve(n):
    if n < 2:
        return []
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    i = 2
    while i * i <= n:                          # only up to √n
        if is_prime[i]:
            for j in range(i * i, n + 1, i):   # start at i²: smaller multiples are done
                is_prime[j] = False
        i += 1
    return [x for x in range(2, n + 1) if is_prime[x]]

print("primes ≤ 10:", *sieve(10))
print("primes ≤ 50:", *sieve(50))
print("count ≤ 1000:", len(sieve(1000)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> sieve(int n) {
    vector<int> primes;
    if (n < 2) return primes;
    vector<bool> isPrime(n + 1, true);
    isPrime[0] = isPrime[1] = false;
    for (int i = 2; i * i <= n; i++)                     // only up to √n
        if (isPrime[i])
            for (int j = i * i; j <= n; j += i)          // start at i²: smaller multiples are done
                isPrime[j] = false;
    for (int x = 2; x <= n; x++)
        if (isPrime[x]) primes.push_back(x);
    return primes;
}

int main() {
    for (int n : {10, 50}) {
        cout << "primes ≤ " << n << ":";
        for (int p : sieve(n)) cout << " " << p;
        cout << "\n";
    }
    cout << "count ≤ 1000: " << sieve(1000).size() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> sieve(int n) {
        List<Integer> primes = new ArrayList<>();
        if (n < 2) return primes;
        boolean[] composite = new boolean[n + 1];        // false = still prime
        for (int i = 2; (long) i * i <= n; i++)          // only up to √n
            if (!composite[i])
                for (int j = i * i; j <= n; j += i)      // start at i²: smaller multiples are done
                    composite[j] = true;
        for (int x = 2; x <= n; x++)
            if (!composite[x]) primes.add(x);
        return primes;
    }

    public static void main(String[] args) {
        for (int n : new int[]{10, 50}) {
            StringBuilder sb = new StringBuilder("primes ≤ " + n + ":");
            for (int p : sieve(n)) sb.append(' ').append(p);
            System.out.println(sb);
        }
        System.out.println("count ≤ 1000: " + sieve(1000).size());
    }
}
```

```javascript filename:JavaScript
function sieve(n) {
    if (n < 2) return [];
    const isPrime = new Array(n + 1).fill(true);
    isPrime[0] = isPrime[1] = false;
    for (let i = 2; i * i <= n; i++)                     // only up to √n
        if (isPrime[i])
            for (let j = i * i; j <= n; j += i)          // start at i²: smaller multiples are done
                isPrime[j] = false;
    const primes = [];
    for (let x = 2; x <= n; x++) if (isPrime[x]) primes.push(x);
    return primes;
}

for (const n of [10, 50]) console.log(`primes ≤ ${n}: ${sieve(n).join(" ")}`);
console.log("count ≤ 1000:", sieve(1000).length);
```

```text filename:Output
primes ≤ 10: 2 3 5 7
primes ≤ 50: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47
count ≤ 1000: 168
```

Time O(n log log n) · Space O(n)

> [!NOTE] Key point
>
> Why `n log log n`? Prime `p` crosses out `n/p` numbers, and `Σ 1/p` over primes up to `n` is about `log log n`. In practice it is <em>nearly linear</em>: sieving up to `10⁷` takes well under a second. Starting the inner loop at `i²` instead of `2i` is the small detail that makes the `√n` outer bound valid.

> [!WARNING] Pitfall
>
> `i * i` overflows a 32-bit `int` when `n` is near `2³¹` — cast to a 64-bit type in the loop condition (the Java version does). And a sieve answers “all primes up to `n`”; for a <strong>single</strong> large number use the `√n` test, not a sieve of size `n`.

# Computing power xⁿ

> [!TIP] Example
>
> <strong>Input:</strong> `x = 2, n = 3`<br><strong>Output:</strong> `8`<br><strong>Input:</strong> `x = 3, n = 5`<br><strong>Output:</strong> `243`

Multiplying `x` by itself `n` times is `O(n)`:

```python filename:Python
def power_naive(x, n):
    result = 1
    for _ in range(n):
        result *= x
    return result

print(power_naive(2, 3))    # 8
print(power_naive(3, 5))    # 243
```

> [!NOTE] Idea
>
> <strong>Square and halve</strong>: `xⁿ = (x^(n/2))²` when `n` is even, and `x · (x^(n/2))²` when `n` is odd. Each recursive call halves `n`, so only `O(log n)` multiplications are needed — compute `x^(n/2)` <strong>once</strong> and square it; calling the function twice brings the cost back to `O(n)`.

```text filename:Recursive%20power%3A%20n%20halves%20at%20every%20level
3^13 = 3 · (3^6)²            13 is odd
3^6  =     (3^3)²             6 is even
3^3  = 3 · (3^1)²             3 is odd
3^1  = 3 · (3^0)²
3^0  = 1                      base case  →  4 levels for n = 13
```

```python filename:Python
def power(x, n):
    if n == 0:
        return 1
    half = power(x, n // 2)        # compute x^(n/2) once …
    if n % 2 == 0:
        return half * half         # … and square it
    return x * half * half

for x, n in [(2, 3), (3, 5), (3, 13), (2, 30), (5, 0)]:
    print(f"{x}^{n} = {power(x, n)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long power(long long x, int n) {
    if (n == 0) return 1;
    long long half = power(x, n / 2);   // compute x^(n/2) once …
    if (n % 2 == 0) return half * half; // … and square it
    return x * half * half;
}

int main() {
    int cases[5][2] = {{2, 3}, {3, 5}, {3, 13}, {2, 30}, {5, 0}};
    for (auto& c : cases)
        cout << c[0] << "^" << c[1] << " = " << power(c[0], c[1]) << "\n";
}
```

```java filename:Java
public class Main {
    static long power(long x, int n) {
        if (n == 0) return 1;
        long half = power(x, n / 2);        // compute x^(n/2) once …
        if (n % 2 == 0) return half * half; // … and square it
        return x * half * half;
    }

    public static void main(String[] args) {
        int[][] cases = {{2, 3}, {3, 5}, {3, 13}, {2, 30}, {5, 0}};
        for (int[] c : cases)
            System.out.println(c[0] + "^" + c[1] + " = " + power(c[0], c[1]));
    }
}
```

```javascript filename:JavaScript
function power(x, n) {
    if (n === 0) return 1;
    const half = power(x, Math.floor(n / 2));   // compute x^(n/2) once …
    if (n % 2 === 0) return half * half;        // … and square it
    return x * half * half;
}

for (const [x, n] of [[2, 3], [3, 5], [3, 13], [2, 30], [5, 0]])
    console.log(`${x}^${n} = ${power(x, n)}`);
```

```text filename:Output
2^3 = 8
3^5 = 243
3^13 = 1594323
2^30 = 1073741824
5^0 = 1
```

Time O(log n) · Space O(log n) call stack

> [!WARNING] Pitfall
>
> `return power(x, n/2) * power(x, n/2)` is the famous mistake — two calls per level gives `T(n) = 2T(n/2) + 1 = O(n)`, no better than the loop. Store the half-result in a variable. (The original notes also handled negative exponents by dividing; that returns a float and is rarely wanted — restrict `n ≥ 0` or handle it separately.)

# Iterative power: binary exponentiation

> [!TIP] Example
>
> <strong>Input:</strong> `x = 3, n = 5`<br><strong>Output:</strong> `243 (5 = 101₂ → 3⁴ · 3¹)`<br><strong>Input:</strong> `x = 2, n = 100, mod = 10⁹ + 7`<br><strong>Output:</strong> `976371285`

> [!NOTE] Idea
>
> Every exponent is a sum of powers of two: `5 = 4 + 1`, so `3⁵ = 3⁴ · 3¹`. Walk through the <strong>bits</strong> of `n` from least significant: keep squaring `x` (`x, x², x⁴, x⁸…`) and multiply the current square into the result whenever the bit is `1`. `O(log n)` steps, no recursion.

```text filename:The%20square-and-multiply%20loop%20on%203%5E5
3^5, n = 5 = 101₂          res = 1,  x = 3
bit 0 = 1 → res = 1 · 3 = 3        x = 3² = 9        n = 2 (10₂)
bit 1 = 0 → res unchanged          x = 9² = 81       n = 1 (1₂)
bit 2 = 1 → res = 3 · 81 = 243     x = 81² = 6561    n = 0 → stop
```

The real-world form adds a modulus: `x^n mod m` for huge `n` (RSA, hashing, combinatorics mod `10⁹ + 7`). Reduce after every multiplication so the numbers never exceed `m²`.

```python filename:Python
def power(x, n):
    res = 1
    while n > 0:
        if n & 1:                 # current bit is 1: multiply this power of x in
            res *= x
        x *= x                    # x, x², x⁴, x⁸ …
        n >>= 1                   # next bit
    return res

def power_mod(x, n, m):
    res, x = 1, x % m
    while n > 0:
        if n & 1:
            res = res * x % m     # reduce after every multiplication
        x = x * x % m
        n >>= 1
    return res

for x, n in [(3, 5), (2, 30), (7, 0)]:
    print(f"{x}^{n} = {power(x, n)}")
M = 1_000_000_007
print(f"2^100 mod {M} = {power_mod(2, 100, M)}")
print(f"3^200 mod {M} = {power_mod(3, 200, M)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long power(long long x, int n) {
    long long res = 1;
    while (n > 0) {
        if (n & 1) res *= x;      // current bit is 1: multiply this power of x in
        x *= x;                   // x, x², x⁴, x⁸ …
        n >>= 1;                  // next bit
    }
    return res;
}

long long powerMod(long long x, long long n, long long m) {
    long long res = 1;
    x %= m;
    while (n > 0) {
        if (n & 1) res = res * x % m;   // reduce after every multiplication
        x = x * x % m;
        n >>= 1;
    }
    return res;
}

int main() {
    int cases[3][2] = {{3, 5}, {2, 30}, {7, 0}};
    for (auto& c : cases) cout << c[0] << "^" << c[1] << " = " << power(c[0], c[1]) << "\n";
    const long long M = 1000000007LL;
    cout << "2^100 mod " << M << " = " << powerMod(2, 100, M) << "\n";
    cout << "3^200 mod " << M << " = " << powerMod(3, 200, M) << "\n";
}
```

```java filename:Java
public class Main {
    static long power(long x, int n) {
        long res = 1;
        while (n > 0) {
            if ((n & 1) == 1) res *= x;   // current bit is 1: multiply this power of x in
            x *= x;                       // x, x², x⁴, x⁸ …
            n >>= 1;                      // next bit
        }
        return res;
    }

    static long powerMod(long x, long n, long m) {
        long res = 1;
        x %= m;
        while (n > 0) {
            if ((n & 1) == 1) res = res * x % m;   // reduce after every multiplication
            x = x * x % m;
            n >>= 1;
        }
        return res;
    }

    public static void main(String[] args) {
        int[][] cases = {{3, 5}, {2, 30}, {7, 0}};
        for (int[] c : cases) System.out.println(c[0] + "^" + c[1] + " = " + power(c[0], c[1]));
        final long M = 1_000_000_007L;
        System.out.println("2^100 mod " + M + " = " + powerMod(2, 100, M));
        System.out.println("3^200 mod " + M + " = " + powerMod(3, 200, M));
    }
}
```

```javascript filename:JavaScript
function power(x, n) {
    let res = 1;
    while (n > 0) {
        if (n & 1) res *= x;      // current bit is 1: multiply this power of x in
        x *= x;                   // x, x², x⁴, x⁸ …
        n >>= 1;                  // next bit
    }
    return res;
}

function powerMod(x, n, m) {      // BigInt: res * x can exceed 2^53
    let res = 1n;
    x = BigInt(x) % m;
    while (n > 0) {
        if (n & 1) res = res * x % m;   // reduce after every multiplication
        x = x * x % m;
        n >>= 1;
    }
    return res;
}

for (const [x, n] of [[3, 5], [2, 30], [7, 0]]) console.log(`${x}^${n} = ${power(x, n)}`);
const M = 1000000007n;
console.log(`2^100 mod ${M} = ${powerMod(2, 100, M)}`);
console.log(`3^200 mod ${M} = ${powerMod(3, 200, M)}`);
```

```text filename:Output
3^5 = 243
2^30 = 1073741824
7^0 = 1
2^100 mod 1000000007 = 976371285
3^200 mod 1000000007 = 136318165
```

Time O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> `res * x` with both below `10⁹ + 7` is up to `10¹⁸` — fits a 64-bit integer but <strong>not</strong> JavaScript's `Number` (exact only to `2⁵³`), hence `BigInt` there. Python's built-in `pow(x, n, m)` does exactly this loop in C.

# Interview Q&amp;A

```question
Why does checking divisors up to √n suffice for a primality test?

---

If `n = a × b` with `a ≤ b`, then `a × a ≤ a × b = n`, so `a ≤ √n`. Every composite number therefore has a divisor no larger than `√n`; if none is found there, `n` is prime. The same pairing argument gives the `O(√n)` divisor listing.
```

```question
Explain Euclid's algorithm and its complexity.

---

`gcd(a, b) = gcd(b, a mod b)`, because any common divisor of `a` and `b` also divides `a − qb`. Iterate until `b = 0`; the other value is the gcd. After any two steps the larger number at least halves, so it runs in `O(log min(a, b))` — about 45 steps for 64-bit inputs, versus up to `10⁹` for subtraction or trial division.
```

```question
How do you compute the LCM without overflow?

---

`lcm(a, b) = a / gcd(a, b) × b`. Dividing first keeps the intermediate value equal to the final answer; `a × b / gcd` can overflow even when the lcm fits.
```

```question
How many trailing zeros does 100! have, and why not count factors of 2?

---

24: `100/5 + 100/25 = 20 + 4`. A trailing zero needs a `2` and a `5`; in `n!` factors of 2 are far more common than factors of 5 (every second number vs every fifth), so the fives are the bottleneck and counting them alone is exact.
```

```question
Why does the sieve start crossing out at i² and stop at √n?

---

Any multiple `k·i` with `k < i` was already removed when the prime `k` (or one of its factors) was processed, so `i²` is the first new composite. Once `i > √n`, `i² > n` — there is nothing left to cross out, so all survivors are prime.
```

```question
How does fast exponentiation reach O(log n), and where is it used?

---

Write `n` in binary; `xⁿ` is the product of `x^(2^k)` over the set bits, and successive squaring produces those powers one per bit. That is `O(log n)` multiplications instead of `n`. Used for modular exponentiation (RSA, Diffie–Hellman, modular inverses by Fermat), matrix powers (Fibonacci in `O(log n)`) and any repeated application of an associative operation.
```
