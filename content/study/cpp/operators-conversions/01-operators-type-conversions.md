---
id: 29f81c2f-72a3-76e0-bd45-20a695b1557e
key: topic:cpp/operators-conversions
subject: cpp
topic: operators-conversions
title: Operators & Type Conversions
slug: operators-type-conversions
order: 1
---

C++ operators behave like C's, with a few traps: integer division, precedence of bitwise ops, and implicit conversions between signed/unsigned and int/double.

# Operator overview

| Kind | Operators | Notes |
| --- | --- | --- |
| Arithmetic | `+ - * / %` | `int / int` truncates toward zero; `%` takes the sign of the left operand |
| Increment | `++x`, `x++` | Prefix returns the new value (by reference); postfix returns a copy of the old one |
| Comparison | `== != < <= > >=`, `<=>` (C++20) | `<=>` (spaceship) returns an ordering |
| Logical | `&& &#124;&#124; !` | Short-circuit evaluation |
| Bitwise | `& &#124; ^ ~ << >>` | Lower precedence than `==` — parenthesise! |
| Assignment | `= += -= *= /= %= &= &#124;= ^= <<= >>=` | Return a reference to the left side |
| Other | `?:`, `,`, `sizeof`, `::`, `.`, `->`, `.*`, `->*` | `::` is scope resolution |

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    std::cout << 7 / 2 << ' ' << -7 / 2 << ' ' << 7 % 3 << ' ' << -7 % 3 << '\n';
    int i = 5;
    int a = i++;          // a = 5, i = 6
    int b = ++i;          // i = 7, b = 7
    std::cout << a << ' ' << b << ' ' << i << '\n';
    int flags = 0b0110;
    std::cout << ((flags & 0b0100) != 0) << ' ' << (flags | 1) << ' ' << (flags ^ 0b1111) << ' ' << (1 << 10) << '\n';
    int x = 0;
    bool ok = (x != 0) && (10 / x > 1);   // short-circuit: division never runs
    std::cout << std::boolalpha << ok << '\n';
}
```

```text filename:Output
3 -3 1 -1
5 7 7
1 7 9 1024
false
```

> [!WARNING] Watch out
>
> `if (flags & MASK == 0)` parses as `flags & (MASK == 0)` because `==` binds tighter than `&`. Always write `(flags & MASK) == 0`.

# Implicit conversions

- <strong>Integral promotion:</strong> `char`, `short`, `bool` are promoted to `int` in arithmetic.
- <strong>Usual arithmetic conversions:</strong> in `int + double` the `int` becomes `double`; in `int + unsigned` the `int` becomes <strong>unsigned</strong>.
- <strong>Narrowing:</strong> `double → int` truncates, `long long → int` may lose bits — allowed with `=`, rejected with `{}`.

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    char c = 'A';
    std::cout << c + 1 << ' ' << static_cast<char>(c + 1) << '\n';   // promoted to int
    double d = 9.99;
    int t = static_cast<int>(d);                                     // truncates toward zero
    std::cout << t << ' ' << static_cast<int>(-9.99) << '\n';
    std::vector<int> v;                                              // v.size() is unsigned
    std::cout << v.size() - 1 << '\n';                               // wraps: not -1!
    std::cout << static_cast<long long>(v.size()) - 1 << '\n';
}
```

```text filename:Output
66 B
9 -9
18446744073709551615
-1
```

> [!WARNING] Watch out
>
> `for (int i = 0; i < v.size() - 1; ++i)` on an empty vector loops \~2⁶⁴ times: `v.size() - 1` wraps to a huge unsigned value. Use `i + 1 < v.size()` or `std::ssize(v)` (C++20, signed).

# Explicit casts

| Cast | Use for |
| --- | --- |
| `static_cast<T>(x)` | Ordinary, checked-at-compile-time conversions (numeric, up/down a class hierarchy without check) |
| `dynamic_cast<T>(x)` | Safe down-casting of polymorphic types, checked at run time |
| `const_cast<T>(x)` | Add/remove `const` (rarely legitimate) |
| `reinterpret_cast<T>(x)` | Reinterpret bits/pointers (low-level, unsafe) |
| `(T)x` / `T(x)` | C-style cast: tries all of the above — avoid, it hides intent |

See <strong>Casts &amp; RTTI</strong> for the full story on the four named casts.

# Evaluation order

> [!WARNING] Watch out
>
> Precedence says how an expression is <em>grouped</em>, not in which order operands are <em>evaluated</em>. `f() + g()` may call `g` first, and `i = i++ + 1`-style expressions that modify a variable twice without sequencing are undefined (or unspecified) — split them into separate statements.

```question
What is the difference between ++i and i++?

---

`++i` increments and returns the variable itself (an lvalue). `i++` makes a copy of the old value, increments, and returns the copy. For `int` the compiler optimises both identically, but for iterators and class types `++it` avoids a copy — prefer it when you don't need the old value.
```
