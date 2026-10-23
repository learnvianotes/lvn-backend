---
id: 144a9c7c-5630-74ec-afd8-ae698a3eea83
key: topic:cpp/functions-basics
subject: cpp
topic: functions-basics
title: Functions
slug: functions
order: 1
---

A function is a named, typed block of code: a return type, a name, a parameter list and a body. It must be <em>declared</em> before it is called.

# Declaration vs definition

```cpp filename:C%2B%2B
#include <iostream>

int add(int a, int b);                 // declaration (prototype): signature only

int main() {
    std::cout << add(2, 3) << '\n';    // OK: the compiler has seen the declaration
}

int add(int a, int b) {                // definition: signature + body
    return a + b;
}
```

```text filename:Output
5
```

| Part | Example | Notes |
| --- | --- | --- |
| Return type | `int`, `void`, `auto` | `void` = returns nothing; `auto` = deduced from `return` (C++14) |
| Name | `add` | Can be overloaded (same name, different parameters) |
| Parameters | `(int a, int b)` | Each is a local variable initialised from the argument |
| Trailing return | `auto add(int a, int b) -> int` | Useful when the type depends on parameters |
| Specifiers | `inline`, `constexpr`, `static`, `noexcept`, `[[nodiscard]]` | Change linkage, evaluation or guarantees |

# Return values

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>

auto average(double a, double b) { return (a + b) / 2; }          // deduced: double

std::pair<int, int> divmod(int a, int b) { return {a / b, a % b}; } // two results

[[nodiscard]] bool save(const std::string& path) { return !path.empty(); }

void greet(const std::string& who) {
    if (who.empty()) return;              // early return from a void function
    std::cout << "Hello, " << who << '\n';
}

int main() {
    std::cout << average(3, 4) << '\n';
    auto [q, r] = divmod(17, 5);
    std::cout << q << ' ' << r << '\n';
    greet("Ada");
    greet("");
    if (!save("out.txt")) std::cout << "failed\n";
}
```

```text filename:Output
3.5
3 2
Hello, Ada
```

> [!NOTE] Key point
>
> `[[nodiscard]]` makes ignoring the return value a warning — great for error codes and functions like `empty()` that are easily confused with `clear()`.

# Function call mechanics

1. <strong>Arguments evaluated</strong>

   In unspecified order, then copied/bound into the parameters.

2. <strong>Stack frame pushed</strong>

   Parameters and locals live in the new frame (automatic storage).

3. <strong>Body runs</strong>

   Until `return` or the closing brace.

4. <strong>Frame popped</strong>

   Locals are destroyed (destructors run, in reverse order). The return value is handed back — often constructed directly in the caller's space (<em>copy elision</em>).

> [!WARNING] Watch out
>
> Never return a reference or pointer to a local variable — the frame is gone after the return, so it dangles. Return by value instead; copy elision and move semantics make it cheap.

```cpp filename:C%2B%2B
#include <iostream>
int& broken() {
    int local = 42;
    return local;          // warning (error with -Werror): reference to stack memory returned
}
int main() { std::cout << broken() << '\n'; }
```

# `main` and static locals

```cpp filename:C%2B%2B
#include <iostream>
int nextId() {
    static int counter = 0;   // initialised once, lives for the whole program
    return ++counter;
}
int main() {
    nextId(); nextId();
    std::cout << nextId() << '\n';
}
```

```text filename:Output
3
```

```question
What is copy elision / RVO?

---

When a function returns a local object by value, the compiler constructs it directly in the caller's storage instead of creating it locally and copying. Since C++17 this is <em>guaranteed</em> for returning a prvalue (`return Widget{...};`) and very common for named locals (NRVO). That's why returning big objects by value is idiomatic.
```
