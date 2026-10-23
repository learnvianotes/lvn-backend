---
id: 9a599f19-f0bf-70b3-b1e7-1210581c6507
key: topic:cpp/formatting-output
subject: cpp
topic: formatting-output
title: Formatting Output
slug: formatting-output
order: 1
---

Two tools: stream <em>manipulators</em> from `<iomanip>` (classic, sticky state) and C++20's `std::format` (Python-style format strings, type-safe).

# `std::format` (C++20)

```cpp filename:C%2B%2B
#include <format>
#include <iostream>
#include <numbers>

int main() {
    std::cout << std::format("{} + {} = {}\n", 2, 3, 2 + 3);
    std::cout << std::format("[{:>6}] [{:<6}] [{:^6}]\n", "r", "l", "c");  // align in width 6
    std::cout << std::format("{:.3f} {:e}\n", std::numbers::pi, 12345.678);
    std::cout << std::format("{:05d} {:+d} {:#x} {:#b}\n", 42, 7, 255, 5);
    std::cout << std::format("{1} {0} {1}\n", "a", "b");                  // positional
    std::cout << std::format("{:*^11}\n", " hi ");                          // custom fill
}
```

```text filename:Output
2 + 3 = 5
[     r] [l     ] [  c   ]
3.142 1.234568e+04
00042 +7 0xff 0b101
b a b
*** hi ****
```

| Spec | Meaning | Example → result |
| --- | --- | --- |
| `{:>8}` `{:<8}` `{:^8}` | Right / left / centre in width 8 | `{:>4}`, `7` → `7` |
| `{:*^8}` | Centre with fill character `*` | `{:*^5}`, `"a"` → `**a**` |
| `{:.2f}` | Fixed, 2 decimals | `3.14159` → `3.14` |
| `{:e}` / `{:g}` | Scientific / shortest | `1500.0` → `1.500000e+03` / `1500` |
| `{:05d}` | Zero-pad to width 5 | `42` → `00042` |
| `{:x}` `{:#x}` `{:b}` `{:o}` | Hex, hex with `0x`, binary, octal | `255` → `ff`, `0xff` |
| `{:+}` | Always show sign | `7` → `+7` |

> [!NOTE] C++23
>
> C++23 adds `std::print("{}\n", x)` / `std::println`, which format <em>and</em> write in one call. Until then, `std::cout << std::format(...)`.

# Stream manipulators (`<iomanip>`)

```cpp filename:C%2B%2B
#include <iomanip>
#include <iostream>

int main() {
    double price = 3.14159;
    std::cout << std::fixed << std::setprecision(2) << price << '\n';
    std::cout << price * 2 << '\n';                 // precision is *sticky*
    std::cout << std::setw(6) << 42 << '|' << 42 << '|' << '\n';   // setw applies to next item only
    std::cout << std::setfill('0') << std::setw(4) << 7 << '\n';
    std::cout << std::left << std::setfill('.') << std::setw(8) << "name" << "Ada\n";
    std::cout << std::hex << 255 << ' ' << std::dec << 255 << '\n';
    std::cout << std::boolalpha << true << ' ' << std::noboolalpha << true << '\n';
}
```

```text filename:Output
3.14
6.28
    42|42|
0007
name....Ada
ff 255
true 1
```

| Manipulator | Effect | Sticky? |
| --- | --- | --- |
| `std::setw(n)` | Minimum width of the next field | No — next output only |
| `std::setprecision(n)` | Significant digits (or decimals with `fixed`) | Yes |
| `std::fixed` / `std::scientific` | Floating-point notation | Yes |
| `std::setfill(c)` | Padding character | Yes |
| `std::left` / `std::right` | Alignment inside the width | Yes |
| `std::hex` / `std::oct` / `std::dec` | Integer base | Yes |
| `std::boolalpha` | Print `true`/`false` instead of `1`/`0` | Yes |

> [!WARNING] Watch out
>
> Manipulators (except `setw`) change the stream's state <em>permanently</em>. A `std::hex` left on `std::cout` makes every later integer print in hex — reset with `std::dec`.

> [!TIP] Do
>
> Prefer `std::format` in new code — the format is visible in one string and nothing leaks into later output.

> [!DANGER] Avoid
>
> Mixing `printf` and `std::cout` on the same output without care — their buffers are synchronised only while `sync_with_stdio(true)` (the default).

```question
What does std::setprecision(3) do without std::fixed?

---

It sets the number of <em>significant digits</em>: `std::cout << std::setprecision(3) << 3.14159` prints `3.14`, and `1234.5` prints `1.23e+03`. With `std::fixed` it means digits <em>after the decimal point</em>.
```
