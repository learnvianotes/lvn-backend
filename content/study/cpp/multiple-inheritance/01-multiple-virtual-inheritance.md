---
id: 5618b918-08a8-7930-b328-9bfbbe3ff537
key: topic:cpp/multiple-inheritance
subject: cpp
topic: multiple-inheritance
title: Multiple & Virtual Inheritance
slug: multiple-virtual-inheritance
order: 1
---

A class can inherit from several bases. That's safe for interfaces, but when two bases share a common ancestor you get the <strong>diamond problem</strong> — solved by `virtual` inheritance.

# Multiple inheritance

```cpp filename:C%2B%2B
#include <iostream>

struct Printable { virtual void print() const = 0; virtual ~Printable() = default; };
struct Serializable { virtual std::string serialize() const = 0; virtual ~Serializable() = default; };

struct Point : Printable, Serializable {         // implements two interfaces
    int x = 1, y = 2;
    void print() const override { std::cout << "Point(" << x << ", " << y << ")\n"; }
    std::string serialize() const override { return std::to_string(x) + "," + std::to_string(y); }
};

int main() {
    Point p;
    const Printable& pr = p;
    const Serializable& se = p;
    pr.print();
    std::cout << se.serialize() << '\n';
}
```

```text filename:Output
Point(1, 2)
1,2
```

# The diamond problem

`Device` → `Scanner` / `Printer` → `Copier`

```cpp filename:C%2B%2B
#include <iostream>

struct Device { int id = 0; };
struct Scanner : Device {};
struct Printer : Device {};
struct Copier : Scanner, Printer {};      // contains TWO Device sub-objects

int main() {
    Copier c;
    c.Scanner::id = 1;                     // must disambiguate
    c.Printer::id = 2;
    std::cout << c.Scanner::id << ' ' << c.Printer::id << ' ' << sizeof(Copier) / sizeof(int) << '\n';
    // c.id = 5;                           // error: ambiguous
}
```

```text filename:Output
1 2 2
```

# Virtual inheritance

```cpp filename:C%2B%2B
#include <iostream>

struct Device {
    int id;
    explicit Device(int i) : id(i) { std::cout << "Device(" << i << ")\n"; }
};
struct Scanner : virtual Device { Scanner() : Device(1) {} };   // shared base
struct Printer : virtual Device { Printer() : Device(2) {} };
struct Copier : Scanner, Printer {
    Copier() : Device(3) {}               // the MOST-DERIVED class initialises the virtual base
};

int main() {
    Copier c;
    std::cout << c.id << '\n';            // one Device, no ambiguity
}
```

```text filename:Output
Device(3)
3
```

- With `virtual` inheritance there is exactly <strong>one</strong> shared base sub-object.
- The most-derived class constructs the virtual base; the intermediate classes' initialisers for it are ignored.
- Cost: an extra indirection (virtual base offset) to reach the shared base, and more complex object layout.

# Name clashes between bases

```cpp filename:C%2B%2B
#include <iostream>
struct Camera { void start() const { std::cout << "camera on\n"; } };
struct Phone  { void start() const { std::cout << "phone on\n"; } };
struct SmartPhone : Camera, Phone {
    void start() const { Phone::start(); Camera::start(); }   // resolve explicitly
};
int main() { SmartPhone{}.start(); }
```

```text filename:Output
phone on
camera on
```

> [!TIP] Do
>
> Use multiple inheritance of <em>interfaces</em> (pure abstract bases) freely.

> [!DANGER] Avoid
>
> Deep hierarchies with multiple <em>stateful</em> bases — prefer composition.

```question
What is the diamond problem and how does C++ solve it?

---

When `D` inherits from `B` and `C`, which both inherit from `A`, `D` contains two copies of `A`, so `A`'s members are ambiguous and the state is duplicated. Declaring `B : virtual A` and `C : virtual A` makes them share one `A` sub-object, which the most-derived class (`D`) constructs.
```
