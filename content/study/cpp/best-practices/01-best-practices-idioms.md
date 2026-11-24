---
id: 59f66e05-746f-7d51-839e-8898d902f846
key: topic:cpp/best-practices
subject: cpp
topic: best-practices
title: Best Practices & Idioms
slug: best-practices-idioms
order: 1
---

A condensed set of rules (drawn from the C++ Core Guidelines) that keep modern C++ safe, readable and fast.

# Resource management

> [!TIP] Do
>
> Let objects own resources (RAII): containers, `std::string`, `std::unique_ptr` (default), `std::shared_ptr` (when truly shared). Aim for the Rule of Zero.

> [!DANGER] Avoid
>
> `new`/`delete`, `malloc`/`free`, owning raw pointers, manual `lock()`/`unlock()`.

# Types &amp; interfaces

- Make things `const` by default — variables, parameters (`const T&`), member functions.
- Prefer `enum class`, `std::array`/`std::vector`, `std::string_view`/`std::span` for views, `std::optional` for “maybe”.
- Mark single-argument constructors `explicit`; mark overrides `override`; give polymorphic bases a `virtual` destructor.
- Pass cheap types by value, others by `const&`; return by value (move/elision make it cheap).
- Use strong types instead of `bool`/`int` soup: `setTimeout(Seconds{5})`, not `setTimeout(5)`.

# Expressions &amp; control

- Initialise every variable at declaration; prefer `{}` to catch narrowing.
- Use `auto` to avoid repeating types, not to hide important ones.
- Prefer algorithms and range-for over index loops; prefer `std::ranges::` versions in C++20.
- Use named casts (`static_cast`) and minimise them; never C-style casts.
- Keep functions short and single-purpose; limit scope of variables (`if (auto x = …; cond)`).

# Tooling

| Tool | Why |
| --- | --- |
| `-Wall -Wextra -Wpedantic -Werror` | Catch mistakes at compile time |
| ASan / UBSan / TSan | Catch memory errors, UB and races in tests |
| `clang-tidy` | Static analysis, modernisation checks (`modernize-*`, `cppcoreguidelines-*`) |
| `clang-format` | Consistent formatting, no style debates |
| CMake + a package manager (vcpkg/Conan) | Reproducible builds and dependencies |
| GoogleTest / Catch2 | Unit tests |

# Idioms worth knowing

> [!NOTE] RAII
>
> Resource lifetime = object lifetime.

> [!NOTE] Copy-and-swap
>
> Strongly exception-safe assignment.

> [!NOTE] Pimpl
>
> `std::unique_ptr<Impl>` member hides implementation, cuts compile times, stabilises ABI.

> [!NOTE] CRTP
>
> `class D : Base<D>` — static polymorphism without virtual calls.

> [!NOTE] Erase–remove
>
> `v.erase(std::remove(...), v.end())`, now `std::erase_if`.

> [!NOTE] Type erasure
>
> `std::function`, `std::any` — uniform interface over unrelated types.

```cpp filename:C%2B%2B
#include <iostream>

template <typename Derived>
struct Shape {                                           // CRTP base
    double area() const { return static_cast<const Derived&>(*this).areaImpl(); }
    void describe() const { std::cout << "area " << area() << '\n'; }
};
struct Square : Shape<Square> {
    double s;
    explicit Square(double x) : s(x) {}
    double areaImpl() const { return s * s; }
};

int main() { Square{3}.describe(); }                     // resolved at compile time, no vtable
```

```text filename:Output
area 9
```

```question
What is CRTP and why use it?

---

The Curiously Recurring Template Pattern: a class derives from a base template instantiated with itself (`class D : public Base<D>`). The base can call derived members via `static_cast<Derived&>(*this)`, giving polymorphic-looking code resolved at compile time — no vtable, fully inlinable. Used for mixins (e.g. adding comparison operators) and static interfaces.
```
