---
id: 419fbeaa-f9e8-708c-bd5f-b5384395c328
key: topic:cpp/concepts
subject: cpp
topic: concepts
title: Concepts & Constraints (C++20)
slug: concepts-constraints-c-20
order: 1
---

A concept is a named, compile-time predicate on types. Constraining a template with one gives clear error messages and lets you overload on what a type can do.

# Using standard concepts

```cpp filename:C%2B%2B
#include <concepts>
#include <iostream>

template <std::integral T>                 // T must be an integer type
T gcd(T a, T b) { return b == 0 ? a : gcd(b, a % b); }

auto half(std::floating_point auto x) { return x / 2; }      // abbreviated syntax

template <typename T>
    requires std::totally_ordered<T>       // requires-clause
const T& clampTo(const T& v, const T& lo, const T& hi) { return v < lo ? lo : hi < v ? hi : v; }

int main() {
    std::cout << gcd(48, 18) << ' ' << half(5.0) << ' ' << clampTo(15, 0, 10) << '\n';
    // gcd(4.5, 1.5);   // error: constraints not satisfied — 'double' is not integral
}
```

```text filename:Output
6 2.5 10
```

```cpp filename:C%2B%2B%20%E2%80%94%20constraint%20violated
#include <concepts>
template <std::integral T>
T gcd(T a, T b) { return b == 0 ? a : gcd(b, a % b); }
int main() { return static_cast<int>(gcd(4.5, 1.5)); }
```

```text filename:Compiler%20error%20%E2%80%94%20short%20and%20to%20the%20point
error: no matching function for call to 'gcd'
note: candidate template ignored: constraints not satisfied [with T = double]
note: because 'double' does not satisfy 'integral'
```

# Defining a concept

```cpp filename:C%2B%2B
#include <concepts>
#include <iostream>
#include <string>
#include <vector>

template <typename T>
concept Shape = requires(const T& s) {
    { s.area() } -> std::convertible_to<double>;    // must have area() returning something double-like
    { s.name() } -> std::convertible_to<std::string>;
};

struct Square { double side; double area() const { return side * side; } std::string name() const { return "square"; } };
struct Blob   { int size; };

void report(const Shape auto& s) { std::cout << s.name() << ": " << s.area() << '\n'; }

template <typename T>
concept Container = requires(T c) { c.begin(); c.end(); c.size(); };

void info(const Container auto& c) { std::cout << "container of " << c.size() << '\n'; }
void info(const auto&)            { std::cout << "not a container\n"; }   // less constrained fallback

int main() {
    report(Square{3});
    // report(Blob{1});   // error: Blob does not satisfy Shape
    info(std::vector<int>{1, 2});
    info(42);
    std::cout << Shape<Square> << Shape<Blob> << '\n';     // concepts are bool constants
}
```

```text filename:Output
square: 9
container of 2
not a container
10
```

| Concept (`<concepts>`, `<iterator>`, `<ranges>`) | Satisfied when |
| --- | --- |
| `std::integral`, `std::floating_point` | Built-in integer / floating type |
| `std::same_as<T, U>`, `std::convertible_to<From, To>` | Type relationships |
| `std::equality_comparable`, `std::totally_ordered` | `==` / `<` etc. work |
| `std::copyable`, `std::movable`, `std::default_initializable` | Object capabilities |
| `std::invocable<F, Args...>`, `std::predicate<F, Args...>` | Callable with those arguments |
| `std::ranges::range`, `std::random_access_iterator` | Range / iterator categories |

# Four ways to write a constraint

```cpp filename:C%2B%2B%20%E2%80%94%20equivalent%20forms
#include <concepts>
template <std::integral T> T a(T x) { return x; }                  // 1. constrained parameter
template <typename T> requires std::integral<T> T b(T x) { return x; }   // 2. requires-clause
template <typename T> T c(T x) requires std::integral<T> { return x; }   // 3. trailing requires
std::integral auto d(std::integral auto x) { return x; }           // 4. abbreviated
```

```question
What problem do concepts solve compared with plain templates?

---

Plain templates accept any type and fail deep inside the implementation with pages of errors. Concepts state requirements in the interface: misuse is rejected at the call site with a short message, overloads can be selected by capability (more-constrained wins), and the code documents itself. They replace most `enable_if`/SFINAE tricks.
```
