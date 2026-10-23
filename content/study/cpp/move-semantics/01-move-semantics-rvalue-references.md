---
id: 5aa605d8-670e-7607-a314-b7f61feb903f
key: topic:cpp/move-semantics
subject: cpp
topic: move-semantics
title: Move Semantics & rvalue References
slug: move-semantics-rvalue-references
order: 1
---

Moving transfers a resource from an object that's about to die (or that you no longer need) instead of copying it. A `std::vector` move is three pointer copies — no matter how many elements it holds.

# Copy vs move

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>
#include <vector>

int main() {
    std::vector<int> a(1'000'000, 7);
    std::vector<int> b = a;               // copy: allocates and copies a million ints
    std::vector<int> c = std::move(a);    // move: steals a's buffer
    std::cout << a.size() << ' ' << b.size() << ' ' << c.size() << '\n';   // a is now empty (valid, unspecified)

    std::string s = "a fairly long string that will not fit in SSO";
    std::vector<std::string> names;
    names.push_back(s);                   // copies
    names.push_back(std::move(s));        // moves — s is left valid but unspecified
    std::cout << names.size() << ' ' << names[1].size() << '\n';
}
```

```text filename:Output
0 1000000 1000000
2 45
```

# Writing move operations

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>

class Buffer {
    int* data_ = nullptr;
    std::size_t size_ = 0;
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& o) : data_(new int[o.size_]), size_(o.size_) {
        std::copy(o.data_, o.data_ + size_, data_);
        std::cout << "copy\n";
    }
    Buffer(Buffer&& o) noexcept                                        // move constructor
        : data_(std::exchange(o.data_, nullptr)), size_(std::exchange(o.size_, 0)) {
        std::cout << "move\n";
    }
    Buffer& operator=(Buffer&& o) noexcept {                           // move assignment
        if (this != &o) {
            delete[] data_;
            data_ = std::exchange(o.data_, nullptr);
            size_ = std::exchange(o.size_, 0);
        }
        return *this;
    }
    Buffer& operator=(const Buffer&) = delete;   // kept short for the example
    std::size_t size() const { return size_; }
};

Buffer make() { return Buffer(8); }             // guaranteed elision: no copy, no move

int main() {
    Buffer a(4);
    Buffer b = std::move(a);        // move
    Buffer c = b;                   // copy
    Buffer d = make();              // nothing printed
    d = std::move(c);               // move assignment
    std::cout << a.size() << ' ' << b.size() << ' ' << c.size() << ' ' << d.size() << '\n';
}
```

```text filename:Output
move
copy
0 4 0 4
```

1. <strong>Steal</strong>

   Take the source's pointers/handles.

2. <strong>Reset the source</strong>

   Leave it in a valid, destructible state (usually empty) — `std::exchange(o.p, nullptr)` does both in one step.

3. <strong>Mark </strong><strong>`noexcept`</strong>

   `std::vector` only moves elements during reallocation if the move constructor is `noexcept`; otherwise it copies to keep the strong guarantee.

# Why `noexcept` matters

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
struct Safe   { Safe() = default;   Safe(const Safe&)   { std::cout << "C"; } Safe(Safe&&) noexcept { std::cout << "M"; } };
struct Unsafe { Unsafe() = default; Unsafe(const Unsafe&) { std::cout << "C"; } Unsafe(Unsafe&&)       { std::cout << "M"; } };
int main() {
    std::vector<Safe> a(2);
    a.reserve(10);             // reallocation moves the 2 elements
    std::cout << '\n';
    std::vector<Unsafe> b(2);
    b.reserve(10);             // reallocation copies — the move might throw
    std::cout << '\n';
}
```

```text filename:Output
MM
CC
```

# Pitfalls

- `std::move` only <em>casts</em>; if the type has no move constructor, the copy constructor is used.
- Don't use a moved-from object except to assign to it or destroy it (standard types guarantee “valid but unspecified”).
- `return std::move(local);` <strong>prevents</strong> copy elision — just `return local;` (it's moved automatically if not elided).
- `const` objects can't be moved from: `std::move(constObj)` yields `const T&&`, which binds to the copy constructor.

```question
What is an rvalue reference?

---

A reference declared with `&&` that binds only to rvalues (temporaries or objects cast with `std::move`). It lets a function overload specifically for “this object is expiring”, so it can steal resources instead of copying. Inside the function, a named rvalue reference is itself an lvalue.
```

```question
Why should move constructors be noexcept?

---

Containers like `std::vector` promise the strong exception guarantee when growing. They can only move elements into the new buffer if moving can't throw (otherwise a half-moved vector couldn't be restored), so they check `std::is_nothrow_move_constructible` and fall back to copying.
```
