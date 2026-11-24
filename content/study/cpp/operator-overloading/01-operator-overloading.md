---
id: 7d4d451d-fdbf-72ba-9c9d-b254c0003049
key: topic:cpp/operator-overloading
subject: cpp
topic: operator-overloading
title: Operator Overloading
slug: operator-overloading
order: 1
---

You can give operators like `+`, `==`, `<<` and `[]` a meaning for your own types, so they read like built-ins. Overload only when the meaning is obvious.

# A value type with arithmetic

```cpp filename:C%2B%2B
#include <iostream>

struct Vec2 {
    double x = 0, y = 0;

    Vec2& operator+=(const Vec2& o) { x += o.x; y += o.y; return *this; }   // member: modifies *this
    Vec2 operator-() const { return {-x, -y}; }                             // unary minus
    bool operator==(const Vec2&) const = default;                           // C++20: memberwise ==
};

Vec2 operator+(Vec2 a, const Vec2& b) { return a += b; }        // non-member, built from +=
Vec2 operator*(const Vec2& v, double k) { return {v.x * k, v.y * k}; }
Vec2 operator*(double k, const Vec2& v) { return v * k; }         // allow 2 * v too

std::ostream& operator<<(std::ostream& os, const Vec2& v) {       // printing
    return os << '(' << v.x << ", " << v.y << ')';
}

int main() {
    Vec2 a{1, 2}, b{3, 4};
    std::cout << a + b << ' ' << -a << ' ' << 2 * b << '\n';
    a += b;
    std::cout << a << ' ' << (a == Vec2{4, 6}) << ' ' << (a != b) << '\n';
}
```

```text filename:Output
(4, 6) (-1, -2) (6, 8)
(4, 6) 1 1
```

# Member or non-member?

| Operator | Usually | Why |
| --- | --- | --- |
| `=`, `[]`, `()`, `->`, conversion | <strong>Must</strong> be members | Language rule |
| `+=`, `-=`, `++`, `--`, unary ops | Member | They modify / belong to `*this` |
| `+`, `-`, `*`, `==`, `<` | Non-member (often `friend`) | Symmetric: allows conversions on <em>both</em> sides (`2 * v`) |
| `<<`, `>>` (streams) | Non-member | Left operand is the stream, not your type |

# Comparison with `<=>` (C++20)

```cpp filename:C%2B%2B
#include <algorithm>
#include <compare>
#include <iostream>
#include <string>
#include <vector>

struct Version {
    int major, minor, patch;
    auto operator<=>(const Version&) const = default;   // generates <, <=, >, >=, == and !=
};

struct Employee {
    std::string name;
    int salary;
    std::strong_ordering operator<=>(const Employee& o) const { return salary <=> o.salary; }
    bool operator==(const Employee& o) const { return salary == o.salary; }
};

int main() {
    std::cout << (Version{1, 2, 3} < Version{1, 10, 0}) << (Version{2, 0, 0} >= Version{1, 9, 9}) << '\n';
    std::vector<Employee> team{{"Bo", 50}, {"Al", 90}, {"Cy", 70}};
    std::sort(team.begin(), team.end());
    for (const auto& e : team) std::cout << e.name << ' ';
    std::cout << '\n';
}
```

```text filename:Output
11
Bo Cy Al
```

# Subscript, call, increment

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>

class IntArray {
    int data_[4] = {};
public:
    int& operator[](std::size_t i) { return data_[i]; }              // non-const: allows writes
    const int& operator[](std::size_t i) const { return data_[i]; }  // const overload for const objects
};

struct Counter {
    int n = 0;
    Counter& operator++() { ++n; return *this; }                 // prefix
    Counter operator++(int) { Counter old = *this; ++n; return old; }   // postfix (dummy int)
    int operator()(int step) { return n += step; }               // call operator: a functor
    explicit operator bool() const { return n != 0; }            // conversion
};

int main() {
    IntArray a;
    a[2] = 7;
    std::cout << a[2] << '\n';
    Counter c;
    Counter before = c++;
    ++c;
    std::cout << before.n << ' ' << c.n << ' ' << c(10) << ' ' << static_cast<bool>(c) << '\n';
    if (c) std::cout << "non-zero\n";      // explicit bool still works in conditions
}
```

```text filename:Output
7
0 2 12 1
non-zero
```

# Copy assignment

`operator=` should return `*this` by reference and survive self-assignment. The <em>copy-and-swap</em> idiom gets both, plus exception safety — see <strong>Copy Semantics</strong>.

| Can't overload | Shouldn't overload |
| --- | --- |
| `::` `.` `.*` `?:` `sizeof` `typeid` | `&&`, `&#124;&#124;` (lose short-circuiting), `,`, unary `&` |

> [!WARNING] Watch out
>
> Keep the natural meaning: `+` shouldn't modify its operands, `==` must be symmetric and consistent with `!=`, and `<` must be a strict weak ordering if you want to use the type in `std::sort` or `std::map`.

```question
Why return a reference from operator+= but a value from operator+?

---

`a += b` modifies `a` and yields `a` itself, so returning `*this` by reference allows chaining without copies. `a + b` produces a <em>new</em> value, leaving both operands untouched — returning a reference would dangle.
```

```question
Why is operator&lt;&lt; for streams a non-member function?

---

The left operand of `std::cout << obj` is the stream. A member `operator<<` would have to be a member of `std::ostream`, which you can't modify. As a non-member it takes `(std::ostream&, const T&)` and returns the stream for chaining. Make it a `friend` if it needs private members.
```
