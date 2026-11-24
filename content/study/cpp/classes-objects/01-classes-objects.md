---
id: 2a3c5846-1f3a-731b-8879-799998236658
key: topic:cpp/classes-objects
subject: cpp
topic: classes-objects
title: Classes & Objects
slug: classes-objects
order: 1
---

A class bundles data (members) with the functions that operate on it (member functions), and controls access with `public`, `private` and `protected`.

> [!INFO]
>
> <strong>Class</strong> — a user-defined type. An <strong>object</strong> is an instance of it. The class's <em>invariant</em> (e.g. “balance is never negative”) is protected by keeping data `private` and changing it only through member functions.

# Defining a class

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <string>

class BankAccount {
public:                                          // the interface
    BankAccount(std::string owner, double balance)
        : owner_(std::move(owner)), balance_(balance) {}

    void deposit(double amount) {
        if (amount <= 0) throw std::invalid_argument("amount must be positive");
        balance_ += amount;
    }
    bool withdraw(double amount) {
        if (amount > balance_) return false;     // invariant: balance_ >= 0
        balance_ -= amount;
        return true;
    }
    double balance() const { return balance_; }  // const: doesn't modify the object
    const std::string& owner() const { return owner_; }

private:                                         // the implementation
    std::string owner_;
    double balance_;
};

int main() {
    BankAccount acc("Ada", 100);
    acc.deposit(50);
    std::cout << acc.withdraw(500) << ' ' << acc.withdraw(30) << '\n';
    std::cout << acc.owner() << ": " << acc.balance() << '\n';
    // acc.balance_ = 1e9;   // error: 'balance_' is a private member
}
```

```text filename:Output
0 1
Ada: 120
```

| Access | Accessible from |
| --- | --- |
| `public` | Anywhere |
| `protected` | The class, its friends and derived classes |
| `private` | Only the class itself and its friends |

# `struct` vs `class`

They are the same thing except for defaults: `struct` members and bases are <strong>public</strong> by default, `class` ones <strong>private</strong>. Convention: `struct` for plain data bundles, `class` when there's an invariant to protect.

```cpp filename:C%2B%2B
#include <iostream>
struct Point {                  // aggregate: public data, no constructors needed
    int x = 0;
    int y = 0;
    int manhattan() const { return (x < 0 ? -x : x) + (y < 0 ? -y : y); }
};
int main() {
    Point p{3, -4};                        // aggregate initialisation
    Point q{.x = 1, .y = 2};               // designated initialisers (C++20)
    std::cout << p.manhattan() << ' ' << q.y << '\n';
}
```

```text filename:Output
7 2
```

# `const` member functions &amp; `this`

```cpp filename:C%2B%2B
#include <iostream>
class Counter {
    int value_ = 0;
    mutable int reads_ = 0;               // mutable: may change even in const functions
public:
    Counter& increment() { ++value_; return *this; }   // return *this to allow chaining
    int value() const { ++reads_; return value_; }
    int reads() const { return reads_; }
};
int main() {
    Counter c;
    c.increment().increment().increment();
    const Counter& view = c;
    std::cout << view.value() << ' ' << view.value() << ' ' << view.reads() << '\n';
    // view.increment();    // error: increment() is not const
}
```

```text filename:Output
3 3 2
```

- `this` is a pointer to the object the member function was called on; `*this` is the object.
- A `const` member function gets a `const T* this` — it can't modify members (except `mutable` ones) or call non-const members.
- Only `const` member functions can be called on `const` objects and through `const&` — so mark every non-mutating function `const`.

# Declaring in a header, defining in a `.cpp`

```cpp filename:C%2B%2B
#include <iostream>
class Circle {
public:
    explicit Circle(double r);
    double area() const;           // declared here (header)
private:
    double r_;
};

Circle::Circle(double r) : r_(r) {}                 // defined outside with ClassName::
double Circle::area() const { return 3.14159 * r_ * r_; }

int main() { std::cout << Circle(2).area() << '\n'; }
```

```text filename:Output
12.5664
```

```question
What are the four pillars of OOP and how does C++ express them?

---

<strong>Encapsulation</strong> — `private` data + public member functions. <strong>Abstraction</strong> — abstract classes / pure interfaces. <strong>Inheritance</strong> — `class D : public B`. <strong>Polymorphism</strong> — virtual functions (run time) and overloading/templates (compile time).
```

```question
What is the size of an object?

---

The sum of its non-static data members plus padding (and a vptr if it has virtual functions). Member functions and static members don't take space in each object. An empty class has size 1.
```
