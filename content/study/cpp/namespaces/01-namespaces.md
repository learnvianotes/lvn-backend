---
id: 791a9147-8dc6-75f1-a821-7f3f582c48ac
key: topic:cpp/namespaces
subject: cpp
topic: namespaces
title: Namespaces
slug: namespaces
order: 1
---

A namespace is a named scope that groups related declarations and prevents name clashes between libraries.

# Declaring and using

```cpp filename:C%2B%2B
#include <iostream>

namespace geometry {
    constexpr double pi = 3.14159;
    double circleArea(double r) { return pi * r * r; }

    namespace units {                      // nested namespace
        double toCm(double inches) { return inches * 2.54; }
    }
}

namespace app::config {                     // C++17 nested-namespace shorthand
    int retries = 3;
}

int main() {
    std::cout << geometry::circleArea(1.0) << '\n';
    std::cout << geometry::units::toCm(10) << '\n';
    namespace gu = geometry::units;         // namespace alias
    std::cout << gu::toCm(1) << ' ' << app::config::retries << '\n';
    using geometry::pi;                     // using-declaration: one name
    std::cout << pi << '\n';
}
```

```text filename:Output
3.14159
25.4
2.54 3
3.14159
```

# Anonymous namespaces &amp; `::`

```cpp filename:C%2B%2B
#include <iostream>

namespace {                    // anonymous: visible only in this .cpp (internal linkage)
    int helperCalls = 0;
    void helper() { ++helperCalls; }
}

int value = 1;                 // global

int main() {
    int value = 2;             // local shadows the global
    helper();
    helper();
    std::cout << value << ' ' << ::value << ' ' << helperCalls << '\n';   // ::value = global scope
}
```

```text filename:Output
2 1 2
```

| Construct | Effect |
| --- | --- |
| `ns::name` | Qualified access |
| `using ns::name;` | Using-declaration: brings one name into scope |
| `using namespace ns;` | Using-directive: makes <em>all</em> names visible (risk of ambiguity) |
| `namespace a = long::name;` | Alias |
| `namespace { … }` | Anonymous — replaces `static` for file-local functions/variables |
| `inline namespace v2 { … }` | Members are also visible in the enclosing namespace (library versioning) |

# Argument-dependent lookup (ADL)

When you call an unqualified function, C++ also searches the namespaces of the argument types. That's why `std::cout << x` finds `std::operator<<` and `swap(a, b)` can find a custom `swap` next to your type.

```cpp filename:C%2B%2B
#include <iostream>
namespace shop {
    struct Item { int price; };
    void print(const Item& i) { std::cout << "Item $" << i.price << '\n'; }
}
int main() {
    shop::Item it{5};
    print(it);        // no `shop::` needed — found by ADL via the argument's type
}
```

```text filename:Output
Item $5
```

> [!TIP] Do
>
> Put your project's code in its own namespace; in `.cpp` files, `using` specific names is fine.

> [!DANGER] Avoid
>
> `using namespace` at global scope in a header

```question
What is the difference between an anonymous namespace and static at file scope?

---

Both give <em>internal linkage</em> (the name is private to the translation unit). The anonymous namespace is the modern, more general choice: it also works for types (classes, enums), whereas `static` applies only to functions and variables.
```
