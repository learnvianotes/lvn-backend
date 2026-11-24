---
id: 09f7d56c-7fde-7e9c-a2f6-a94f3184c711
key: topic:cpp/unique-ptr
subject: cpp
topic: unique-ptr
title: "Smart Pointers: unique_ptr"
slug: smart-pointers-unique-ptr
order: 1
---

`std::unique_ptr<T>` is the sole owner of a heap object and deletes it when it goes out of scope. It's move-only, has zero overhead over a raw pointer, and should be your default for heap objects.

# Basics

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>

struct Widget {
    std::string name;
    explicit Widget(std::string n) : name(std::move(n)) { std::cout << "make " << name << '\n'; }
    ~Widget() { std::cout << "free " << name << '\n'; }
};

int main() {
    auto a = std::make_unique<Widget>("a");       // preferred way to create
    std::cout << a->name << ' ' << (*a).name << '\n';

    std::unique_ptr<Widget> b = std::move(a);     // ownership moves; copying is a compile error
    std::cout << (a == nullptr) << ' ' << b->name << '\n';

    b.reset(new Widget("c"));                     // frees "a", now owns "c"
    Widget* raw = b.get();                        // non-owning peek
    std::cout << raw->name << '\n';
    std::cout << "leaving main\n";
}                                                  // "c" freed automatically
```

```text filename:Output
make a
a a
1 a
make c
free a
c
leaving main
free c
```

| Operation | Meaning |
| --- | --- |
| `std::make_unique<T>(args...)` | Allocate and construct (exception-safe) |
| `p.get()` | Raw pointer, ownership kept |
| `p.release()` | Give up ownership — returns the raw pointer (you must delete it) |
| `p.reset(q)` | Delete current object, take ownership of `q` (or none) |
| `std::move(p)` | Transfer ownership |
| `if (p)` | Is it non-null? |
| `std::make_unique<T[]>(n)` | Array form — uses `delete[]` |

# Ownership in function signatures

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <vector>

struct Node { int value; };

std::unique_ptr<Node> create(int v) { return std::make_unique<Node>(v); }  // returns ownership
void inspect(const Node& n) { std::cout << "value " << n.value << '\n'; }  // just uses it
void store(std::vector<std::unique_ptr<Node>>& pool, std::unique_ptr<Node> n) {  // takes ownership
    pool.push_back(std::move(n));
}

int main() {
    std::vector<std::unique_ptr<Node>> pool;
    auto n = create(7);
    inspect(*n);
    store(pool, std::move(n));
    store(pool, create(9));
    std::cout << pool.size() << ' ' << pool[1]->value << ' ' << (n == nullptr) << '\n';
}
```

```text filename:Output
value 7
2 9 1
```

> [!NOTE] Guideline
>
> Pass `unique_ptr` by value only to <em>transfer</em> ownership. A function that just uses the object should take `T&`, `const T&` or `T*` — it shouldn't care how the object is owned.

# Custom deleters

```cpp filename:C%2B%2B
#include <cstdio>
#include <iostream>
#include <memory>

int main() {
    auto closer = [](std::FILE* f) { std::fclose(f); std::cout << "closed\n"; };
    {
        std::unique_ptr<std::FILE, decltype(closer)> file(std::fopen("up_demo.txt", "w"), closer);
        std::fputs("data", file.get());
    }
    std::remove("up_demo.txt");
}
```

```text filename:Output
closed
```

# Polymorphism &amp; the pimpl idiom

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <vector>

struct Shape { virtual ~Shape() = default; virtual double area() const = 0; };
struct Square : Shape { double s; explicit Square(double x) : s(x) {} double area() const override { return s * s; } };
struct Circle : Shape { double r; explicit Circle(double x) : r(x) {} double area() const override { return 3.0 * r * r; } };

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Square>(2));
    shapes.push_back(std::make_unique<Circle>(1));
    double total = 0;
    for (const auto& s : shapes) total += s->area();
    std::cout << total << '\n';
}
```

```text filename:Output
7
```

```question
Why prefer make\_unique over unique\_ptr&lt;T&gt;(new T)?

---

It's shorter, never mentions `new`, and is exception-safe in expressions like `f(std::unique_ptr<A>(new A), g())` (before C++17 the `new A` could run, then `g()` throw, leaking A). It also keeps the “no naked new” rule easy to check.
```

```question
What is the overhead of unique\_ptr?

---

None in practice: with the default (stateless) deleter it is exactly one pointer in size, and `get()`, `*` and `->` compile to the same instructions as a raw pointer. The destructor just calls `delete`.
```
