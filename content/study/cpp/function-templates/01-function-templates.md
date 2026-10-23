---
id: 7a043413-3925-7557-9f1a-65dc74a73dd4
key: topic:cpp/function-templates
subject: cpp
topic: function-templates
title: Function Templates
slug: function-templates
order: 1
---

A template is a blueprint the compiler stamps out for each set of types you use it with. Write the algorithm once; get type-checked, fully optimised code for every type.

# Defining and calling

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

template <typename T>                     // `class T` means the same
T maxOf(T a, T b) { return a > b ? a : b; }

template <typename T, typename U>
auto add(T a, U b) { return a + b; }      // return type deduced from the expression

template <typename T, int N>              // non-type template parameter
constexpr int length(const T (&)[N]) { return N; }

int main() {
    std::cout << maxOf(3, 7) << ' ' << maxOf(2.5, 1.5) << ' ' << maxOf<std::string>("pear", "apple") << '\n';
    std::cout << add(1, 2.5) << '\n';
    int arr[] = {1, 2, 3, 4};
    std::cout << length(arr) << '\n';
    // maxOf(3, 7.0);   // error: T deduced as both int and double
    std::cout << maxOf<double>(3, 7.5) << '\n';   // explicit template argument
}
```

```text filename:Output
7 2.5 pear
3.5
4
7.5
```

# How instantiation works

1. <strong>Deduction</strong>

   From the call `maxOf(3, 7)` the compiler deduces `T = int`.

2. <strong>Instantiation</strong>

   It generates `int maxOf<int>(int, int)` — a real function — and type-checks it.

3. <strong>Reuse</strong>

   Every call with `T = int` in this translation unit uses the same instantiation; identical instantiations in other TUs are merged by the linker.

> [!NOTE] Key point
>
> Templates are checked twice: syntax when defined, and fully when instantiated. Errors like “no match for `operator>`” appear only when you use the template with a type that lacks it — which is what <strong>concepts</strong> fix.

# Overloading and explicit specialisation

```cpp filename:C%2B%2B
#include <cstring>
#include <iostream>

template <typename T>
bool equal(const T& a, const T& b) { return a == b; }

template <>                                               // full specialisation for const char*
bool equal<const char*>(const char* const& a, const char* const& b) { return std::strcmp(a, b) == 0; }

template <typename T>
void describe(T)  { std::cout << "value\n"; }
template <typename T>
void describe(T*) { std::cout << "pointer\n"; }           // overload: more specialised, preferred

int main() {
    const char* x = "hi";
    char buf[] = "hi";
    const char* y = buf;
    std::cout << equal(1, 1) << equal(x, y) << '\n';     // compares contents, not addresses
    int n = 0;
    describe(n);
    describe(&n);
}
```

```text filename:Output
11
value
pointer
```

> [!NOTE] Key point
>
> Prefer <em>overloading</em> function templates to specialising them — specialisations don't take part in overload resolution, which surprises people.

# Abbreviated templates (C++20)

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
auto sum(const auto& container) {          // `auto` parameter = implicit template
    typename std::decay_t<decltype(container)>::value_type total{};
    for (const auto& x : container) total += x;
    return total;
}
int main() {
    std::cout << sum(std::vector<int>{1, 2, 3}) << ' ' << sum(std::vector<double>{0.5, 0.25}) << '\n';
}
```

```text filename:Output
6 0.75
```

```question
What is template argument deduction?

---

The process where the compiler figures out template parameters from the types of the call's arguments, so you can write `maxOf(3, 7)` instead of `maxOf<int>(3, 7)`. Deduction doesn't consider implicit conversions: `maxOf(3, 7.0)` fails because `T` would have to be both `int` and `double`.
```

```question
Do templates cause code bloat?

---

Each distinct instantiation is separate code, so using a template with many types can grow the binary. In exchange each version is specialised and inlinable. Mitigations: factor type-independent code into non-template helpers, and use type erasure where performance isn't critical.
```
