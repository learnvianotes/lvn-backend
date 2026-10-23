---
id: ca6db05e-e76e-7eeb-8897-50197fec2231
key: topic:cpp/type-traits-if-constexpr
subject: cpp
topic: type-traits-if-constexpr
title: Type Traits & if constexpr
slug: type-traits-if-constexpr
order: 1
---

`<type_traits>` lets templates ask questions about types at compile time; `if constexpr` (C++17) keeps only the branch that applies, so each instantiation compiles just the code it needs.

# Asking questions about types

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <type_traits>

int main() {
    std::cout << std::boolalpha
              << std::is_integral_v<int> << ' '
              << std::is_floating_point_v<int> << ' '
              << std::is_pointer_v<char*> << ' '
              << std::is_same_v<std::remove_const_t<const int>, int> << ' '
              << std::is_trivially_copyable_v<std::string> << ' '
              << std::is_base_of_v<std::exception, std::runtime_error> << '\n';
    static_assert(std::is_same_v<std::decay_t<const int&>, int>);
    static_assert(sizeof(long long) == 8, "this code assumes 64-bit long long");
}
```

```text filename:Output
true false true true false true
```

| Trait | Question / transformation |
| --- | --- |
| `is_integral_v<T>`, `is_floating_point_v<T>`, `is_arithmetic_v<T>` | Category checks |
| `is_same_v<A, B>` | Exactly the same type? |
| `is_base_of_v<B, D>`, `is_convertible_v<From, To>` | Relationships |
| `remove_reference_t<T>`, `remove_const_t<T>`, `decay_t<T>` | Strip qualifiers (decay = what pass-by-value does) |
| `conditional_t<Cond, A, B>` | Compile-time ternary on types |
| `enable_if_t<Cond, T>` | Remove an overload unless `Cond` (pre-C++20 SFINAE) |

# `if constexpr`

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <type_traits>
#include <vector>

template <typename T>
std::string describe(const T& value) {
    if constexpr (std::is_integral_v<T>)
        return "integer " + std::to_string(value * 2);     // only compiled for integers
    else if constexpr (std::is_floating_point_v<T>)
        return "float " + std::to_string(value);
    else if constexpr (requires { value.size(); })         // C++20 requires-expression
        return "sized thing of " + std::to_string(value.size());
    else
        return "something else";
}

int main() {
    std::cout << describe(21) << '\n' << describe(0.5) << '\n'
              << describe(std::vector<int>{1, 2, 3}) << '\n' << describe(nullptr) << '\n';
}
```

```text filename:Output
integer 42
float 0.500000
sized thing of 3
something else
```

> [!NOTE] Key point
>
> With a plain `if`, <em>both</em> branches must compile for every `T` — `value * 2` on a `std::vector` would be an error. `if constexpr` discards the untaken branch inside templates.

# Writing your own trait

```cpp filename:C%2B%2B
#include <iostream>
#include <list>
#include <type_traits>
#include <vector>

template <typename T> struct is_vector : std::false_type {};
template <typename T, typename A> struct is_vector<std::vector<T, A>> : std::true_type {};
template <typename T> inline constexpr bool is_vector_v = is_vector<T>::value;

int main() {
    std::cout << is_vector_v<std::vector<int>> << is_vector_v<std::list<int>> << is_vector_v<int> << '\n';
}
```

```text filename:Output
100
```

```question
What is SFINAE?

---

<em>Substitution Failure Is Not An Error</em>: if substituting template arguments into a function template's signature produces invalid code, that overload is silently dropped instead of causing an error. Pre-C++20 code uses it (via `std::enable_if`) to constrain templates; C++20 concepts express the same thing readably.
```
