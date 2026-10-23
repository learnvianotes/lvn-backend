---
id: 5e9d4b7e-89c3-71eb-b557-30c0ecbe68d3
key: topic:cpp/types-variables
subject: cpp
topic: types-variables
title: Fundamental Types & Variables
slug: fundamental-types-variables
order: 1
---

Every variable has a fixed type chosen at compile time. The type decides its size, its range and which operations are legal.

# Built-in types

| Type | Typical size (64-bit) | Notes |
| --- | --- | --- |
| `bool` | 1 byte | `true` / `false` |
| `char` | 1 byte | A character <em>and</em> a small integer; signedness is platform-defined |
| `short` | 2 bytes | At least 16 bits |
| `int` | 4 bytes | At least 16 bits — in practice 32 |
| `long` | 8 bytes (Linux/macOS), 4 (Windows) | At least 32 bits |
| `long long` | 8 bytes | At least 64 bits — use for big sums |
| `float` | 4 bytes | \~7 significant digits |
| `double` | 8 bytes | \~15–16 significant digits — the default for decimals |
| `long double` | 8–16 bytes | Extended precision where supported |
| `std::size_t` | 8 bytes | Unsigned; the type of `sizeof` and container sizes |

```cpp filename:C%2B%2B
#include <climits>
#include <cstdint>
#include <iostream>
#include <limits>

int main() {
    std::cout << sizeof(int) << ' ' << sizeof(long long) << ' ' << sizeof(double) << '\n';
    std::cout << INT_MAX << ' ' << std::numeric_limits<int>::min() << '\n';
    std::cout << std::numeric_limits<long long>::max() << '\n';
    std::int32_t a = 1;          // exact-width types from <cstdint>
    std::uint64_t b = 1;
    std::cout << sizeof(a) << ' ' << sizeof(b) << '\n';
}
```

```text filename:Output
4 8 8
2147483647 -2147483648
9223372036854775807
4 8
```

> [!NOTE] Key point
>
> Sizes of `int`, `long` and friends are only <em>minimums</em> in the standard. When the exact width matters (file formats, hashing, bit tricks), use `std::int32_t`, `std::uint64_t`, … from `<cstdint>`.

# Ways to initialise

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    int a = 5;        // copy initialisation
    int b(5);         // direct initialisation
    int c{5};         // brace (uniform) initialisation — C++11
    int d{};          // value-initialised → 0
    int e = {5};      // copy-list initialisation
    std::cout << a << b << c << d << e << '\n';
}
```

```text filename:Output
55505
```

Brace initialisation <strong>refuses narrowing conversions</strong> — a lossy conversion becomes a compile error instead of a silent bug:

```cpp filename:C%2B%2B
int main() {
    double price = 9.99;
    int cents{price};     // error: narrowing conversion from double to int
    return cents;
}
```

```text filename:Compiler%20error
error: type 'double' cannot be narrowed to 'int' in initializer list [-Wc++11-narrowing]
```

> [!WARNING] Watch out
>
> A local variable of built-in type that is not initialised holds an <em>indeterminate</em> value — reading it is undefined behaviour. Always initialise: `int count = 0;` or `int count{};`.

# Integer overflow &amp; unsigned wrap-around

```cpp filename:C%2B%2B
#include <climits>
#include <iostream>
int main() {
    unsigned int u = 0;
    u = u - 1;                        // unsigned arithmetic wraps modulo 2^32
    std::cout << u << '\n';
    long long big = 1LL * INT_MAX * 2; // widen *before* multiplying
    std::cout << big << '\n';
    int s = -1;
    unsigned int one = 1;
    std::cout << (s < static_cast<int>(one)) << '\n';   // compare as signed
}
```

```text filename:Output
4294967295
4294967294
1
```

```cpp filename:C%2B%2B%20%E2%80%94%20signed%20overflow%20(UBSan%20aborts)
#include <climits>
#include <iostream>
int main() {
    int x = INT_MAX;
    x = x + 1;                // signed overflow: undefined behaviour
    std::cout << x << '\n';
}
```

```text filename:UBSan
runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
```

> [!WARNING] Watch out
>
> <em>Unsigned</em> overflow is well-defined (wraps). <em>Signed</em> overflow is <strong>undefined behaviour</strong> — the optimiser may assume it never happens. Compute `a * b` in `long long` when it can exceed \~2·10⁹.

# Literals

| Literal | Type / meaning |
| --- | --- |
| `42`, `42u`, `42L`, `42LL`, `42ULL` | `int`, `unsigned`, `long`, `long long`, `unsigned long long` |
| `0x2A`, `052`, `0b101010` | Hex, octal, binary (C++14) — all 42 |
| `1'000'000` | Digit separators (C++14) |
| `3.14`, `3.14f`, `1e9` | `double`, `float`, `double` |
| `'a'`, `"abc"` | `char`, `const char[4]` (array incl. `'\0'`) |
| `"abc"s`, `"abc"sv` | `std::string`, `std::string_view` (with `using namespace std::literals`) |
| `nullptr` | The null pointer literal (type `std::nullptr_t`) |

# Floating point is approximate

```cpp filename:C%2B%2B
#include <cmath>
#include <iostream>
int main() {
    double a = 0.1 + 0.2;
    std::cout << (a == 0.3) << '\n';                   // 0: not exactly equal
    std::cout << (std::fabs(a - 0.3) < 1e-9) << '\n';  // 1: compare with a tolerance
    std::cout << 7 / 2 << ' ' << 7 / 2.0 << '\n';      // integer vs floating division
}
```

```text filename:Output
0
1
3 3.5
```

```question
What is the difference between int x; and int x{}; inside a function?

---

`int x;` leaves `x` uninitialised — reading it is undefined behaviour. `int x{};` <em>value-initialises</em> it to `0`. For class types with a default constructor both call that constructor.
```

```question
Why prefer brace initialisation?

---

It works the same way for every type (built-ins, aggregates, classes, containers), it rejects narrowing conversions, and it avoids the <em>most vexing parse</em> (`Widget w();` declares a function, `Widget w{};` creates an object). The one gotcha: for types with an `initializer_list` constructor, `std::vector<int> v{3, 0}` means the elements `{3, 0}`, not “3 zeros”.
```
