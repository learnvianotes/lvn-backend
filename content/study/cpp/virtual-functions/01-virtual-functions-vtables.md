---
id: e860056e-499f-7d18-9677-c965e1684c53
key: topic:cpp/virtual-functions
subject: cpp
topic: virtual-functions
title: Virtual Functions & vtables
slug: virtual-functions-vtables
order: 1
---

A `virtual` function is dispatched on the object's <em>dynamic</em> type at run time — the mechanism behind runtime polymorphism.

# Static vs dynamic binding

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <vector>

struct Shape {
    virtual double area() const { return 0; }
    std::string kind() const { return "shape"; }        // non-virtual
    virtual ~Shape() = default;                         // virtual destructor!
};
struct Rect : Shape {
    double w, h;
    Rect(double a, double b) : w(a), h(b) {}
    double area() const override { return w * h; }     // `override`: compiler checks it overrides
    std::string kind() const { return "rect"; }         // hides, doesn't override
};
struct Circle : Shape {
    double r;
    explicit Circle(double x) : r(x) {}
    double area() const override { return 3.14 * r * r; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Rect>(2, 3));
    shapes.push_back(std::make_unique<Circle>(1));
    for (const auto& s : shapes) std::cout << s->kind() << ' ' << s->area() << '\n';

    Rect r(1, 1);
    Shape& ref = r;
    std::cout << ref.area() << ' ' << ref.kind() << ' ' << r.kind() << '\n';
}
```

```text filename:Output
shape 6
shape 3.14
1 shape rect
```

| Call through… | Non-virtual function | Virtual function |
| --- | --- | --- |
| Object `r.f()` | Static type | Static type (= dynamic) |
| Pointer/reference to base `p->f()` | <strong>Static</strong> type (`Shape::f`) | <strong>Dynamic</strong> type (`Rect::f`) |

# How it works: vptr &amp; vtable

1. <strong>vtable per class</strong>

   Each class with virtual functions gets one static table of function pointers, one slot per virtual function.

2. <strong>vptr per object</strong>

   Every object carries a hidden pointer (usually the first 8 bytes) to its class's vtable. Constructors set it.

3. <strong>Call</strong>

   `p->area()` compiles to: load `p->vptr`, load slot <em>k</em>, call it — one or two extra memory loads.

```cpp filename:C%2B%2B
#include <iostream>
struct Plain   { int x; void f() {} };
struct Virtual { int x; virtual void f() {} virtual ~Virtual() = default; };
int main() {
    std::cout << sizeof(Plain) << ' ' << sizeof(Virtual) << '\n';   // 4 vs 16: vptr (8) + int + padding
}
```

```text filename:Output
4 16
```

# `override` and `final`

```cpp filename:C%2B%2B
struct Base {
    virtual void save(int version) const {}
    virtual ~Base() = default;
};
struct Derived : Base {
    void save(long version) const override {}   // error: doesn't override (parameter type differs)
};
int main() {}
```

```cpp filename:C%2B%2B
#include <iostream>
struct Base { virtual void run() const { std::cout << "base\n"; } virtual ~Base() = default; };
struct Leaf final : Base {                       // no class may derive from Leaf
    void run() const override { std::cout << "leaf\n"; }
};
struct Mid : Base { void run() const final { std::cout << "mid\n"; } };   // run can't be overridden further
int main() {
    const Base& b = Leaf{};
    b.run();
    Mid{}.run();
}
```

```text filename:Output
leaf
mid
```

# Virtual destructors

```cpp filename:C%2B%2B%20%E2%80%94%20missing%20virtual%20destructor
#include <iostream>
struct Base {
    virtual void speak() const {}
    ~Base() { std::cout << "~Base\n"; }                        // NOT virtual
};
struct Derived : Base {
    int* data = new int[100];
    ~Derived() { delete[] data; std::cout << "~Derived\n"; }
};
int main() {
    Base* p = new Derived;
    delete p;          // undefined behaviour: only ~Base would run → ~Derived skipped, leak
}
```

```text filename:Compiler%20error%20(-Wall)
error: delete called on non-final 'Base' that has virtual functions but non-virtual destructor [-Werror,-Wdelete-non-abstract-non-virtual-dtor]
```

> [!WARNING] Watch out
>
> If a class has any virtual function (or is meant to be deleted through a base pointer), give it a `virtual` destructor. Otherwise `delete basePtr;` skips the derived destructor.

# Object slicing

```cpp filename:C%2B%2B
#include <iostream>
struct Animal { virtual const char* sound() const { return "..."; } virtual ~Animal() = default; };
struct Cat : Animal { const char* sound() const override { return "meow"; } };
void byValue(Animal a)            { std::cout << a.sound() << '\n'; }   // copies only the Animal part
void byRef(const Animal& a)       { std::cout << a.sound() << '\n'; }
int main() {
    Cat c;
    byValue(c);
    byRef(c);
}
```

```text filename:Output
...
meow
```

> [!WARNING] Watch out
>
> Passing or storing a derived object <em>by value</em> as its base type <strong>slices</strong> off the derived part — virtual calls then use the base version. Pass polymorphic objects by reference or (smart) pointer; store them as `std::vector<std::unique_ptr<Base>>`.

# Calling virtuals in constructors

```cpp filename:C%2B%2B
#include <iostream>
struct Base {
    Base() { hello(); }                          // dispatches to Base::hello, not Derived's!
    virtual void hello() const { std::cout << "Base::hello\n"; }
    virtual ~Base() = default;
};
struct Derived : Base { void hello() const override { std::cout << "Derived::hello\n"; } };
int main() { Derived d; d.hello(); }
```

```text filename:Output
Base::hello
Derived::hello
```

```question
How are virtual functions implemented?

---

Typically with a per-class <em>vtable</em> (array of function pointers) and a hidden <em>vptr</em> in each object pointing to its class's table. A virtual call loads the vptr, indexes the table and calls indirectly. Cost: one pointer per object, an indirect call that can't normally be inlined.
```

```question
Why is calling a virtual function from a constructor dangerous?

---

While the base constructor runs, the derived part doesn't exist yet and the vptr points to the base vtable, so the call goes to the base version (or is undefined for a pure virtual). The same applies in destructors.
```
