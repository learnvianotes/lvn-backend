---
id: f6f05f5e-c140-7ddf-b3b2-91d00cb9b5a9
key: topic:cpp/copy-semantics
subject: cpp
topic: copy-semantics
title: "Copy Semantics: Shallow vs Deep"
slug: copy-semantics-shallow-vs-deep
order: 1
---

Copying an object calls its copy constructor (new object) or copy assignment operator (existing object). If the class owns a raw resource, the default member-wise copy is <em>shallow</em> — and wrong.

# Copy constructor vs copy assignment

```cpp filename:C%2B%2B
#include <iostream>
struct Tag {
    int v = 0;
    Tag() = default;
    Tag(const Tag& o) : v(o.v) { std::cout << "copy ctor\n"; }
    Tag& operator=(const Tag& o) { v = o.v; std::cout << "copy assign\n"; return *this; }
};
void byValue(Tag) {}
int main() {
    Tag a;
    Tag b = a;       // copy ctor: b is being created (the '=' here is not assignment)
    Tag c(a);        // copy ctor
    c = b;           // copy assignment: c already exists
    byValue(a);      // copy ctor for the parameter
}
```

```text filename:Output
copy ctor
copy ctor
copy assign
copy ctor
```

# The shallow-copy bug

```cpp filename:C%2B%2B%20%E2%80%94%20double%20free%20(ASan)
#include <cstring>
class Buffer {
    char* data_;
public:
    explicit Buffer(const char* s) : data_(new char[std::strlen(s) + 1]) { std::strcpy(data_, s); }
    ~Buffer() { delete[] data_; }
    // no copy constructor → the compiler copies the *pointer*
};
int main() {
    Buffer a("hello");
    Buffer b = a;        // b.data_ == a.data_
}                        // both destructors delete[] the same block → double free
```

# Deep copy done right

```cpp filename:C%2B%2B
#include <algorithm>
#include <cstring>
#include <iostream>
#include <utility>

class Buffer {
    std::size_t size_;
    char* data_;
public:
    explicit Buffer(const char* s) : size_(std::strlen(s)), data_(new char[size_ + 1]) {
        std::copy(s, s + size_ + 1, data_);
    }
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& o) : size_(o.size_), data_(new char[o.size_ + 1]) {   // deep copy
        std::copy(o.data_, o.data_ + size_ + 1, data_);
    }
    Buffer& operator=(Buffer o) {          // copy-and-swap: `o` is already a copy
        swap(*this, o);                    // take its contents; old ones die with `o`
        return *this;
    }
    friend void swap(Buffer& a, Buffer& b) noexcept {
        std::swap(a.size_, b.size_);
        std::swap(a.data_, b.data_);
    }
    void set(std::size_t i, char c) { data_[i] = c; }
    const char* str() const { return data_; }
};

int main() {
    Buffer a("hello");
    Buffer b = a;          // independent copy
    b.set(0, 'j');
    Buffer c("x");
    c = a;                 // assignment
    Buffer& alias = c;
    c = alias;             // self-assignment is safe
    std::cout << a.str() << ' ' << b.str() << ' ' << c.str() << '\n';
}
```

```text filename:Output
hello jello hello
```

> [!NOTE] Copy-and-swap
>
> Copy-and-swap gives the <strong>strong exception guarantee</strong> (if the copy throws, `*this` is untouched) and handles self-assignment for free.

> [!TIP] Do
>
> Hold resources in members that already know how to copy themselves (`std::string`, `std::vector`, `std::unique_ptr`) — then you write <em>no</em> copy code at all (Rule of Zero).

> [!DANGER] Avoid
>
> Owning raw pointers (`char*`, `T*` from `new`) in a class without writing — or deleting — the copy operations.

```question
What's the difference between a shallow and a deep copy?

---

A shallow copy duplicates the member values, so two objects' pointers end up pointing at the same resource (leading to double frees and aliasing bugs). A deep copy allocates a fresh resource and copies the pointed-to contents, giving each object its own.
```

```question
When is the copy constructor called?

---

When a new object is initialised from an existing one: `T b = a;`, `T b(a);`, passing by value, returning by value (unless elided), throwing/catching by value, and when containers copy elements.
```
