---
id: 2c6156b4-c8f2-77e0-b3e3-23bb3eea13df
key: topic:cpp/perfect-forwarding
subject: cpp
topic: perfect-forwarding
title: Forwarding References & std::forward
slug: forwarding-references-std-forward
order: 1
---

A template parameter `T&&` is a <em>forwarding reference</em>: it binds to lvalues and rvalues alike. `std::forward<T>` passes the argument on with its original value category, so moves stay moves and copies stay copies.

# Reference collapsing

| Argument | `T` deduced as | `T&&` becomes |
| --- | --- | --- |
| lvalue `int x` | `int&` | `int& &&` → `int&` |
| rvalue `42` / `std::move(x)` | `int` | `int&&` |

Rule: `& &`, `& &&` and `&& &` collapse to `&`; only `&& &&` stays `&&`. A `T&&` is a forwarding reference <strong>only</strong> when `T` is being deduced (a template parameter or `auto&&`) — `std::string&&` is a plain rvalue reference.

# The problem `std::forward` solves

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>

void consume(const std::string&) { std::cout << "copy\n"; }
void consume(std::string&&)      { std::cout << "move\n"; }

template <typename T>
void wrapperBad(T&& arg) { consume(arg); }                    // a named variable is an lvalue!

template <typename T>
void wrapperGood(T&& arg) { consume(std::forward<T>(arg)); }  // restores the category

int main() {
    std::string s = "x";
    wrapperBad(s);              wrapperBad(std::string("t"));
    wrapperGood(s);             wrapperGood(std::string("t"));
}
```

```text filename:Output
copy
copy
copy
move
```

|  | `std::move(x)` | `std::forward<T>(x)` |
| --- | --- | --- |
| What it does | Unconditionally casts to rvalue | Casts to rvalue <em>only if</em> the original argument was an rvalue |
| Use with | Objects you own and are done with | Forwarding references `T&&` in templates |

# Real use: emplace

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>

struct Order {
    std::string item;
    int qty;
    Order(std::string i, int q) : item(std::move(i)), qty(q) { std::cout << "construct\n"; }
    Order(const Order& o) : item(o.item), qty(o.qty) { std::cout << "copy\n"; }
    Order(Order&& o) noexcept : item(std::move(o.item)), qty(o.qty) { std::cout << "move\n"; }
};

int main() {
    std::vector<Order> orders;
    orders.reserve(4);
    orders.push_back(Order("pen", 2));     // construct a temporary, then move it in
    orders.emplace_back("ink", 1);         // forwards the arguments: construct in place
}
```

```text filename:Output
construct
move
construct
```

> [!WARNING] Watch out
>
> Don't `std::forward` the same argument twice — the first call may already have moved from it. And don't overload a function on a forwarding reference: `template <class T> void f(T&&)` is an exact match for almost everything and will hijack your other overloads.

```question
What is perfect forwarding?

---

Passing arguments through a generic wrapper to another function exactly as they were given — preserving lvalue/rvalue-ness and const — using a forwarding reference `T&&` plus `std::forward<T>(arg)`. It's how `make_unique`, `emplace_back` and `std::thread`'s constructor avoid unnecessary copies.
```
