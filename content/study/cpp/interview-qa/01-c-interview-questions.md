---
id: 61d583f2-2f6d-7408-8b86-55298a1e4292
key: topic:cpp/interview-qa
subject: cpp
topic: interview-qa
title: C++ Interview Questions
slug: c-interview-questions
order: 1
---

The questions that come up again and again, with crisp answers. Each links back to a topic in these notes for depth.

# Fundamentals

```question
What is the difference between struct and class in C++?

---

Only the defaults: members and base classes are `public` by default in a `struct` and `private` in a `class`. Otherwise identical — both can have constructors, methods, inheritance and virtual functions.
```

```question
What is the difference between a pointer and a reference?

---

A reference is an alias: must be initialised, can't be null or re-seated. A pointer is an object holding an address: can be null, re-pointed, has arithmetic. Use references by default, pointers for optional or re-seatable relationships.
```

```question
What are the differences between new/delete and malloc/free?

---

`new` allocates <em>and</em> calls the constructor, returns a typed pointer and throws `std::bad_alloc` on failure; `delete` calls the destructor. `malloc`/`free` deal with raw bytes, return `void*`/`NULL`, and never run constructors or destructors. Never mix them.
```

```question
What does the static keyword mean in different contexts?

---

Inside a function: the variable persists across calls and is initialised once. At namespace scope: internal linkage (file-private). In a class: the member is shared by all instances (static functions have no `this`).
```

```question
What is the difference between const and constexpr?

---

`const` = read-only after initialisation (value may be known only at run time). `constexpr` = must be computable at compile time (variables) or can be evaluated at compile time (functions).
```

# OOP

```question
How does runtime polymorphism work in C++?

---

Through virtual functions: each polymorphic class has a vtable of function pointers and each object a hidden vptr to it. A call through a base pointer/reference looks up the right function in the object's vtable at run time.
```

```question
Why should a base class destructor be virtual?

---

So that `delete basePtr;` runs the derived destructor first. Without `virtual`, only the base destructor runs — undefined behaviour and usually leaks.
```

```question
What is object slicing?

---

Copying a derived object into a base-class <em>value</em> keeps only the base part; the derived data and overrides are lost. Avoid it by passing polymorphic objects by reference or pointer.
```

```question
Can constructors be virtual? Can destructors be pure virtual?

---

Constructors can't be virtual (no object exists yet to dispatch on). Destructors can be pure virtual (`virtual ~Base() = 0;`) to make a class abstract — but they still need a definition, because derived destructors call them.
```

```question
What is the diamond problem?

---

With `B : A`, `C : A`, `D : B, C`, `D` contains two `A` sub-objects, making `A`'s members ambiguous. Virtual inheritance (`B : virtual A`, `C : virtual A`) shares a single `A`, constructed by the most-derived class.
```

# Memory &amp; lifetime

```question
What are the Rule of Three, Five and Zero?

---

If you define a destructor, copy constructor or copy assignment, you likely need all three (Three); add move constructor and move assignment (Five). Best: compose your class from RAII members so you define none of them (Zero).
```

```question
Explain move semantics.

---

Rvalue references (`T&&`) let a class provide a <em>move</em> constructor/assignment that steals the resources of an expiring object instead of copying them, leaving the source valid but empty. `std::move` casts an lvalue to an rvalue to opt into this.
```

```question
unique\_ptr vs shared\_ptr vs weak\_ptr?

---

`unique_ptr`: single owner, move-only, zero overhead — the default. `shared_ptr`: shared ownership via an atomic reference count; object dies with the last owner. `weak_ptr`: non-owning observer of a `shared_ptr` object; breaks cycles; `lock()` to use it.
```

```question
What is RAII?

---

Resource Acquisition Is Initialization: acquire a resource in a constructor and release it in the destructor, so the resource's lifetime is bound to an object's scope and cleanup happens automatically — even during exception unwinding.
```

```question
What is a memory leak and how do you prevent it in C++?

---

Heap memory that is never freed because the last pointer to it was lost. Prevent it by never owning memory through raw pointers: use containers and smart pointers, and check with ASan/LeakSanitizer or Valgrind.
```

# STL &amp; templates

```question
vector vs list? map vs unordered\_map?

---

`vector` is contiguous (fast iteration, O(1) random access, amortised O(1) push\_back); `list` is linked (O(1) splice/insert given an iterator, no random access, poor cache use). `map` is a sorted red-black tree (O(log n), ordered); `unordered_map` is a hash table (O(1) average, unordered).
```

```question
What is iterator invalidation?

---

Operations that restructure a container can make existing iterators, pointers and references dangle: e.g. `vector::push_back` that reallocates invalidates all of them; `erase` invalidates those at/after the erased position. Using an invalidated iterator is UB.
```

```question
How does std::sort work and what does it require?

---

Introsort (quicksort + heapsort fallback + insertion sort for small ranges): O(n log n) worst case, not stable. It needs random-access iterators and a comparator that is a strict weak ordering.
```

```question
What are templates and when are they instantiated?

---

Blueprints for functions/classes parameterised by types or values. The compiler generates (instantiates) a concrete version when a template is used with specific arguments, which is why template definitions usually live in headers.
```

```question
What are concepts?

---

C++20 named compile-time predicates on template arguments (`std::integral`, custom `concept Shape = requires …`). They constrain templates, give readable errors, and enable overloading by capability, replacing most SFINAE.
```

# Modern C++ &amp; concurrency

```question
What is the difference between std::thread and std::async?

---

`std::thread` just runs a function; results/exceptions need manual plumbing and it must be joined. `std::async` returns a `std::future` that yields the result (or rethrows the exception) via `get()`.
```

```question
What is a data race and how do you prevent it?

---

Concurrent access to the same memory location by two threads, at least one writing, without synchronisation — undefined behaviour. Prevent it with mutexes (`std::lock_guard`, `std::scoped_lock`), atomics, or by not sharing mutable data.
```

```question
What does noexcept do and why does it matter for performance?

---

It declares a function won't throw (violations call `std::terminate`). Containers check it: `std::vector` moves elements during reallocation only if the move constructor is `noexcept`, otherwise it copies.
```

```question
What is std::move vs std::forward?

---

`std::move` unconditionally casts to an rvalue (“I'm done with this”). `std::forward<T>` casts to an rvalue only if the original argument was one — used with forwarding references (`T&&` in templates) for perfect forwarding.
```

# Tricky output questions

```cpp filename:C%2B%2B
#include <iostream>

struct A {
    A()  { std::cout << "A"; }
    virtual ~A() { std::cout << "~A"; }
    virtual void f() { std::cout << "A::f "; }
};
struct B : A {
    B()  { std::cout << "B "; }
    ~B() override { std::cout << "~B"; }
    void f() override { std::cout << "B::f "; }
};

int main() {
    A* p = new B;        // prints "AB "
    p->f();              // virtual dispatch
    A a = *p;            // slicing: copy of the A part (copy ctor prints nothing)
    a.f();
    delete p;            // virtual destructor: ~B then ~A
    std::cout << '\n';
}                        // then the sliced copy `a` is destroyed
```

```text filename:Output
AB B::f A::f ~B~A
~A
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

int main() {
    int i = 5;
    int& r = i;
    int* p = &i;
    r++;
    (*p) *= 2;
    std::cout << i << ' ';

    std::vector<int> v{1, 2, 3};
    auto a = v;          // copy
    auto& b = v;         // alias
    a.push_back(4);
    b.push_back(5);
    std::cout << v.size() << a.size() << ' ';

    int x = 10;
    auto byVal = [x]() { return x; };
    auto byRef = [&x]() { return x; };
    x = 20;
    std::cout << byVal() << ' ' << byRef() << ' ';
    std::cout << sizeof(char) << sizeof(bool) << '\n';
}
```

```text filename:Output
12 44 10 20 11
```

> [!NOTE] Practice
>
> Walk through these line by line before running them — interviewers use exactly this kind of snippet to test construction order, virtual dispatch, slicing, references and lambda captures.
