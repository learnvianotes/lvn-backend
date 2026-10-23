---
id: 70afb0f9-03ae-7d72-a0f8-1f59cbc0a21a
key: topic:cpp/friend
subject: cpp
topic: friend
title: Friend Functions & Classes
slug: friend-functions-classes
order: 1
---

A `friend` declaration grants a specific function or class access to a class's private members — a controlled exception to encapsulation.

# Friend function

```cpp filename:C%2B%2B
#include <iostream>

class Fraction {
    int num_, den_;
public:
    Fraction(int n, int d) : num_(n), den_(d) {}
    friend std::ostream& operator<<(std::ostream& os, const Fraction& f) {   // hidden friend
        return os << f.num_ << '/' << f.den_;
    }
    friend Fraction operator*(const Fraction& a, const Fraction& b) {
        return {a.num_ * b.num_, a.den_ * b.den_};
    }
    friend bool sameValue(const Fraction& a, const Fraction& b);
};

bool sameValue(const Fraction& a, const Fraction& b) {    // defined outside, still a friend
    return a.num_ * b.den_ == b.num_ * a.den_;
}

int main() {
    Fraction half(1, 2), third(1, 3);
    std::cout << half * third << ' ' << sameValue(half, Fraction(2, 4)) << '\n';
}
```

```text filename:Output
1/6 1
```

# Friend class

```cpp filename:C%2B%2B
#include <iostream>

class Engine {
    int rpm_ = 0;
    friend class Mechanic;          // Mechanic may touch Engine's privates
};

class Mechanic {
public:
    static void tune(Engine& e, int rpm) { e.rpm_ = rpm; }
    static int read(const Engine& e) { return e.rpm_; }
};

int main() {
    Engine e;
    Mechanic::tune(e, 3000);
    std::cout << Mechanic::read(e) << '\n';
}
```

```text filename:Output
3000
```

- Friendship is <strong>granted, not taken</strong> — the class decides who its friends are.
- It's <strong>not symmetric</strong> (A friend of B doesn't make B a friend of A), <strong>not transitive</strong>, and <strong>not inherited</strong>.
- A <em>hidden friend</em> (defined inside the class) is found only by argument-dependent lookup — the preferred way to write operators.

> [!TIP] Do
>
> Use friends for tightly coupled pairs: operators, stream I/O, a container and its iterator, test helpers.

> [!DANGER] Avoid
>
> Using `friend` to dodge a design problem — if many outsiders need private access, the interface is wrong.

```question
Does friend break encapsulation?

---

Used deliberately, it <em>strengthens</em> it: instead of adding public getters/setters that everyone can call, you grant access to one specific function that is logically part of the class's interface (like `operator<<`). The class still controls exactly who gets in.
```
