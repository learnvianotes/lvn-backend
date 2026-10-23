---
id: e32a9846-f72f-73d9-8351-f2092b5fedbe
key: topic:cpp/abstract-classes
subject: cpp
topic: abstract-classes
title: Abstract Classes & Interfaces
slug: abstract-classes-interfaces
order: 1
---

A <em>pure virtual</em> function (`= 0`) has no implementation in the base class. A class with at least one is <strong>abstract</strong>: it can't be instantiated, only derived from — that's how C++ spells “interface”.

# Interface + implementations

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Notifier {                                   // interface: only pure virtuals
public:
    virtual ~Notifier() = default;
    virtual void send(const std::string& msg) = 0;
    virtual std::string channel() const = 0;
};

class EmailNotifier : public Notifier {
public:
    void send(const std::string& msg) override { std::cout << "email: " << msg << '\n'; }
    std::string channel() const override { return "email"; }
};

class SmsNotifier : public Notifier {
public:
    void send(const std::string& msg) override { std::cout << "sms: " << msg.substr(0, 10) << '\n'; }
    std::string channel() const override { return "sms"; }
};

void alertAll(const std::vector<std::unique_ptr<Notifier>>& targets, const std::string& msg) {
    for (const auto& t : targets) t->send(msg);   // depends only on the interface
}

int main() {
    std::vector<std::unique_ptr<Notifier>> targets;
    targets.push_back(std::make_unique<EmailNotifier>());
    targets.push_back(std::make_unique<SmsNotifier>());
    alertAll(targets, "Server CPU at 97%");
    // Notifier n;   // error: abstract class
}
```

```text filename:Output
email: Server CPU at 97%
sms: Server CPU
```

```cpp filename:C%2B%2B
struct Shape { virtual double area() const = 0; virtual ~Shape() = default; };
struct Square : Shape { double s = 1; };      // forgot to override area → still abstract
int main() {
    Square sq;                                // error: variable type 'Square' is an abstract class
}
```

# Template method pattern

```cpp filename:C%2B%2B
#include <iostream>

class Report {
public:
    void generate() const {              // fixed algorithm (non-virtual)…
        std::cout << "== " << title() << " ==\n";
        body();
        std::cout << "-- end --\n";
    }
    virtual ~Report() = default;
private:
    virtual const char* title() const = 0;    // …customisation points (private virtual is fine)
    virtual void body() const = 0;
};

class SalesReport : public Report {
    const char* title() const override { return "Sales"; }
    void body() const override { std::cout << "total: 42\n"; }
};

int main() { SalesReport{}.generate(); }
```

```text filename:Output
== Sales ==
total: 42
-- end --
```

# Pure virtual with a body

```cpp filename:C%2B%2B
#include <iostream>
struct Base {
    virtual ~Base() = 0;                         // pure virtual destructor: makes Base abstract…
    virtual void log() const = 0;
};
Base::~Base() { std::cout << "~Base\n"; }       // …but it MUST still have a body
void Base::log() const { std::cout << "default logging\n"; }   // optional default implementation

struct Impl : Base { void log() const override { Base::log(); } };
int main() { Impl i; i.log(); }
```

```text filename:Output
default logging
~Base
```

|  | Abstract class | Interface (C++ convention) |
| --- | --- | --- |
| Pure virtual functions | At least one | All (plus virtual dtor) |
| Data members | Allowed | None |
| Implemented functions | Allowed | None |
| Multiple inheritance | Possible but careful | Safe and common |

```question
Can an abstract class have a constructor?

---

Yes. You can't create a standalone object of it, but its constructor runs as part of constructing every derived object — useful to initialise the base's data members. It's often made `protected`.
```

```question
Abstract class vs interface in C++?

---

C++ has no `interface` keyword. An “interface” is just an abstract class with only pure virtual functions, a virtual destructor and no data. An abstract class may additionally carry state and shared implementation.
```
