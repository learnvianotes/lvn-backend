---
id: 1c1d8ee0-1e0a-7616-b34c-eddd5a574c18
key: topic:cpp/constructors
subject: cpp
topic: constructors
title: Constructors
slug: constructors
order: 1
---

A constructor initialises an object when it is created. C++ has default, parameterised, copy and move constructors, plus member initializer lists, delegation and `explicit`.

# Kinds of constructors

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

class Person {
public:
    Person() : name_("anonymous"), age_(0) { std::cout << "default\n"; }
    Person(std::string name, int age) : name_(std::move(name)), age_(age) { std::cout << "param\n"; }
    Person(const Person& o) : name_(o.name_), age_(o.age_) { std::cout << "copy\n"; }
    Person(Person&& o) noexcept : name_(std::move(o.name_)), age_(o.age_) { std::cout << "move\n"; }
    void show() const { std::cout << name_ << " (" << age_ << ")\n"; }
private:
    std::string name_;
    int age_;
};

int main() {
    Person a;                   // default
    Person b("Ada", 36);        // parameterised
    Person c = b;               // copy
    Person d = std::move(b);    // move
    a.show(); c.show(); d.show();
}
```

```text filename:Output
default
param
copy
move
anonymous (0)
Ada (36)
Ada (36)
```

# Member initializer lists

Members are initialised <em>before</em> the constructor body runs. Initialise them in the list — assigning in the body means default-construct first, then assign. `const` members, references and members without a default constructor <strong>must</strong> use the list.

```cpp filename:C%2B%2B
#include <iostream>
class Config {
    const int maxUsers_;          // const: must be initialised, can't be assigned
    int& counter_;                // reference: same
    int timeout_ = 30;            // default member initializer (C++11)
public:
    Config(int maxUsers, int& counter) : maxUsers_(maxUsers), counter_(counter) { ++counter_; }
    Config(int maxUsers, int& counter, int timeout) : Config(maxUsers, counter) {   // delegating
        timeout_ = timeout;
    }
    void show() const { std::cout << maxUsers_ << ' ' << timeout_ << ' ' << counter_ << '\n'; }
};
int main() {
    int created = 0;
    Config a(10, created);
    Config b(20, created, 5);
    a.show();
    b.show();
}
```

```text filename:Output
10 30 2
20 5 2
```

> [!WARNING] Watch out
>
> Members are initialised in the order they are <strong>declared in the class</strong>, not the order in the initializer list. `B(int v) : b_(v), a_(b_) {}` with `a_` declared first reads `b_` before it's initialised. (`-Wall` warns about the mismatch.)

# `explicit`

```cpp filename:C%2B%2B
#include <iostream>
struct Meters {
    double v;
    explicit Meters(double x) : v(x) {}      // no implicit double → Meters
};
struct Label {
    int id;
    Label(int i) : id(i) {}                  // implicit conversion allowed
};
void run(Meters m) { std::cout << m.v << "m\n"; }
void print(Label l) { std::cout << "#" << l.id << '\n'; }
int main() {
    run(Meters(5));       // must be explicit
    print(42);            // 42 silently becomes a Label — often surprising
    // run(5.0);          // error: no implicit conversion
}
```

```text filename:Output
5m
#42
```

> [!NOTE] Guideline
>
> Mark single-argument constructors `explicit` unless the implicit conversion is genuinely natural (like `std::string` from `const char*`).

# Compiler-generated constructors

| Special member | Generated when… |
| --- | --- |
| Default constructor `T()` | You declare <strong>no</strong> constructors at all |
| Copy constructor / copy assignment | You don't declare a move operation (deprecated if you declare a destructor) |
| Move constructor / move assignment | You declare <strong>none</strong> of: copy ops, move ops, destructor |
| Destructor | You don't declare one |

```cpp filename:C%2B%2B
#include <iostream>
struct Widget {
    int size = 1;
    Widget() = default;                  // bring back the default ctor alongside another one
    explicit Widget(int s) : size(s) {}
    Widget(const Widget&) = delete;      // forbid copying
};
int main() {
    Widget a;
    Widget b(5);
    std::cout << a.size << ' ' << b.size << '\n';
    // Widget c = b;   // error: call to deleted constructor
}
```

```text filename:Output
1 5
```

# The most vexing parse

```cpp filename:C%2B%2B
#include <iostream>
struct Timer { int ticks = 0; };
int main() {
    Timer t{};        // an object
    // Timer u();     // declares a *function* u returning Timer — not an object!
    std::cout << t.ticks << '\n';
}
```

```text filename:Output
0
```

```question
Why initialise members in the initializer list rather than the constructor body?

---

Because members are always initialised before the body runs. Assigning in the body means default-constructing then assigning (wasteful for strings/containers), and it's impossible for `const` members, references and types without a default constructor.
```

```question
Can a constructor be virtual?

---

No. When a constructor runs, the object's dynamic type is being built, so there's nothing to dispatch on yet. For “virtual construction” use a factory function or a virtual `clone()` method.
```
