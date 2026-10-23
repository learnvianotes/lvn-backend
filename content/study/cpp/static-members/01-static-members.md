---
id: 3d0ba26f-2498-752a-ac9a-0f04970fd655
key: topic:cpp/static-members
subject: cpp
topic: static-members
title: Static Members
slug: static-members
order: 1
---

A `static` member belongs to the class itself, not to any object: one shared copy of a data member, and member functions callable without an object.

# Static data and functions

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

class User {
public:
    explicit User(std::string name) : name_(std::move(name)), id_(++created_) { ++alive_; }
    ~User() { --alive_; }
    User(const User&) = delete;

    static int alive() { return alive_; }       // no `this`: can only touch static members
    int id() const { return id_; }

    static constexpr int kMaxNameLength = 32;    // compile-time constant
private:
    std::string name_;
    int id_;
    inline static int created_ = 0;              // C++17: define in-class with `inline`
    static int alive_;                           // classic: declared here…
};
int User::alive_ = 0;                            // …defined once in a .cpp

int main() {
    User a("ada");
    {
        User b("bob");
        std::cout << User::alive() << ' ' << b.id() << '\n';
    }
    User c("cy");
    std::cout << User::alive() << ' ' << c.id() << ' ' << User::kMaxNameLength << '\n';
}
```

```text filename:Output
2 2
2 3 32
```

|  | Non-static member | Static member |
| --- | --- | --- |
| Belongs to | Each object | The class (one copy) |
| Access | `obj.m` | `Class::m` (or `obj.m`) |
| Has `this` | Yes | No — can't use non-static members directly |
| Can be `virtual` / `const` | Yes | No |

# Singleton &amp; factory patterns

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

class Logger {
public:
    static Logger& instance() {            // Meyers singleton: thread-safe lazy init (C++11)
        static Logger logger;
        return logger;
    }
    void log(const std::string& msg) { std::cout << ++count_ << ": " << msg << '\n'; }
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
private:
    Logger() = default;                    // nobody else can construct one
    int count_ = 0;
};

class Temperature {
    double kelvin_;
    explicit Temperature(double k) : kelvin_(k) {}
public:
    static Temperature fromCelsius(double c) { return Temperature(c + 273.15); }   // named constructors
    static Temperature fromKelvin(double k)  { return Temperature(k); }
    double kelvin() const { return kelvin_; }
};

int main() {
    Logger::instance().log("start");
    Logger::instance().log("again");
    std::cout << Temperature::fromCelsius(25).kelvin() << '\n';
}
```

```text filename:Output
1: start
2: again
298.15
```

# The many meanings of `static`

| Where | Meaning |
| --- | --- |
| Class member | Shared by all objects |
| Local variable | Keeps its value between calls; initialised once |
| Namespace-scope function/variable | Internal linkage — private to this `.cpp` (prefer an anonymous namespace) |

> [!WARNING] Watch out
>
> Global and static objects in <em>different</em> `.cpp` files are initialised in an unspecified order (the <em>static initialisation order fiasco</em>). If one global's constructor uses another, wrap it in a function returning a function-local static.

```question
Why can't a static member function be const or virtual?

---

Both are about `this`: `const` qualifies the object the function is called on, and virtual dispatch uses the object's vtable. A static member function has no object and no `this`.
```
