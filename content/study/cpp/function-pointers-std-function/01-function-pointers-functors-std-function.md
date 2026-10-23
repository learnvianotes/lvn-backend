---
id: 2d633ada-9278-7976-b72f-6e231cfb0b05
key: topic:cpp/function-pointers-std-function
subject: cpp
topic: function-pointers-std-function
title: Function Pointers, Functors & std::function
slug: function-pointers-functors-std-function
order: 1
---

Three ways to treat “a function” as a value: raw function pointers (C-style), function objects (classes with `operator()`), and the type-erased `std::function` wrapper.

# Function pointers

```cpp filename:C%2B%2B
#include <iostream>

int add(int a, int b) { return a + b; }
int mul(int a, int b) { return a * b; }

int apply(int (*op)(int, int), int x, int y) { return op(x, y); }

using BinaryOp = int (*)(int, int);          // alias makes the syntax readable

int main() {
    BinaryOp ops[] = {add, mul};             // table of functions
    for (BinaryOp op : ops) std::cout << apply(op, 3, 4) << ' ';
    std::cout << '\n';
    int (*p)(int, int) = &add;               // & and * are optional for functions
    std::cout << (*p)(1, 1) << ' ' << p(2, 2) << '\n';
}
```

```text filename:Output
7 12
2 4
```

# Functors (function objects)

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>

class InRange {                               // a functor can carry state
    int lo_, hi_;
public:
    InRange(int lo, int hi) : lo_(lo), hi_(hi) {}
    bool operator()(int x) const { return lo_ <= x && x <= hi_; }
};

int main() {
    std::vector<int> v{1, 5, 9, 12, 7};
    std::cout << std::count_if(v.begin(), v.end(), InRange(5, 10)) << '\n';
    std::sort(v.begin(), v.end(), std::greater<int>());   // standard functor from <functional>
    std::cout << v.front() << '\n';
}
```

```text filename:Output
3
12
```

# `std::function`

`std::function<R(Args...)>` can hold <em>any</em> callable with that signature — function pointer, functor or lambda (even with captures). It's the tool for storing callbacks of unknown type, at the cost of a possible heap allocation and an indirect call.

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <map>
#include <string>

int sub(int a, int b) { return a - b; }

int main() {
    int bonus = 100;
    std::map<std::string, std::function<int(int, int)>> calc{
        {"+", [](int a, int b) { return a + b; }},
        {"-", sub},
        {"max", [](int a, int b) { return std::max(a, b); }},
        {"bonus", [bonus](int a, int) { return a + bonus; }},
    };
    for (const auto& [name, fn] : calc) std::cout << name << ' ' << fn(8, 3) << '\n';

    std::function<void()> empty;
    std::cout << std::boolalpha << static_cast<bool>(empty) << '\n';   // calling it would throw bad_function_call
}
```

```text filename:Output
+ 11
- 5
bonus 108
max 8
false
```

# `std::bind` and `std::invoke`

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>

int power(int base, int exp) { int r = 1; while (exp--) r *= base; return r; }
struct Account { int balance = 50; int get() const { return balance; } };

int main() {
    using namespace std::placeholders;
    auto square = std::bind(power, _1, 2);           // fix the second argument
    auto squareL = [](int b) { return power(b, 2); }; // the lambda equivalent (preferred)
    std::cout << square(7) << ' ' << squareL(7) << '\n';

    Account acc;
    std::cout << std::invoke(&Account::get, acc) << ' ' << std::invoke(power, 2, 5) << '\n';  // uniform call syntax
}
```

```text filename:Output
49 49
50 32
```

| Option | Overhead | Holds state? | Use when |
| --- | --- | --- | --- |
| Function pointer | Indirect call | No | C APIs, simple tables of functions |
| Lambda / functor + template parameter | <strong>None</strong> (inlined) | Yes | Algorithms, hot paths: `template <class F> void run(F f)` |
| `std::function` | Type erasure; maybe allocation | Yes | Storing heterogeneous callbacks (maps, members, event handlers) |

```question
Why is std::sort with a lambda often faster than C's qsort?

---

`qsort` calls the comparator through a `void*`-based function pointer on every comparison, which the compiler usually can't inline. `std::sort` is a template: the lambda's type is part of the instantiation, so the comparison is inlined into the sorting loop.
```
