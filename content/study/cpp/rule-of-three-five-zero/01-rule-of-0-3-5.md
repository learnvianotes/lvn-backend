---
id: 7cd26c99-5386-787f-b890-d86d56c556c2
key: topic:cpp/rule-of-three-five-zero
subject: cpp
topic: rule-of-three-five-zero
title: Rule of 0 / 3 / 5
slug: rule-of-0-3-5
order: 1
---

If a class needs a custom destructor, copy or move operation, it almost certainly needs all of them. Better still: design so it needs none.

# The rules

> [!NOTE] Rule of Three (C++98)
>
> If you define any of <em>destructor</em>, <em>copy constructor</em>, <em>copy assignment</em>, define all three.

> [!NOTE] Rule of Five (C++11)
>
> Add <em>move constructor</em> and <em>move assignment</em>: define or `=delete` all five together.

> [!NOTE] Rule of Zero
>
> Don't manage resources by hand. Use members that manage themselves (`std::string`, `std::vector`, `std::unique_ptr`) and write <strong>none</strong> of the five.

# Rule of Zero in practice

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Document {                                    // no destructor, no copy/move code
    std::string title_;
    std::vector<std::string> lines_;
    std::unique_ptr<int> cache_ = std::make_unique<int>(0);   // move-only member
public:
    explicit Document(std::string t) : title_(std::move(t)) {}
    void add(std::string line) { lines_.push_back(std::move(line)); }
    std::size_t size() const { return lines_.size(); }
};

int main() {
    Document d("notes");
    d.add("line 1");
    Document moved = std::move(d);   // compiler-generated move: correct automatically
    std::cout << moved.size() << ' ' << d.size() << '\n';
    // Document copy = moved;        // error: unique_ptr member makes it move-only
}
```

```text filename:Output
1 0
```

# Rule of Five, spelled out

```cpp filename:C%2B%2B%20%E2%80%94%20all%20five%20special%20members
#include <utility>

class Handle {
    int* res_ = nullptr;
public:
    explicit Handle(int v) : res_(new int(v)) {}
    ~Handle() { delete res_; }                                                   // 1 destructor
    Handle(const Handle& o) : res_(o.res_ ? new int(*o.res_) : nullptr) {}       // 2 copy ctor
    Handle& operator=(const Handle& o) {                                          // 3 copy assign
        Handle tmp(o);
        std::swap(res_, tmp.res_);
        return *this;
    }
    Handle(Handle&& o) noexcept : res_(std::exchange(o.res_, nullptr)) {}         // 4 move ctor
    Handle& operator=(Handle&& o) noexcept {                                      // 5 move assign
        std::swap(res_, o.res_);                                                  //   old value dies with o
        return *this;
    }
};
```

# What declaring one member suppresses

| You declare… | Default ctor | Copy ops | Move ops |
| --- | --- | --- | --- |
| Nothing | Generated | Generated | Generated |
| Any constructor | <strong>Not generated</strong> | Generated | Generated |
| Destructor | Generated | Generated (deprecated) | <strong>Not generated</strong> → moves become copies |
| Copy ctor or copy assignment | — | The other is generated (deprecated) | <strong>Not generated</strong> |
| Move ctor or move assignment | — | <strong>Deleted</strong> | The other is not generated |

> [!WARNING] Watch out
>
> Adding an empty `~T() {}` “for logging” silently removes a class's move operations: every “move” becomes a copy. If you must declare a destructor, also `= default` the move and copy operations.

```question
Explain the Rule of Zero.

---

Classes that aren't specifically resource managers shouldn't declare any of the special member functions. Let RAII members (containers, smart pointers, strings) handle ownership; the compiler-generated copy/move/destructor then do the right thing, and the code is shorter and exception-safe.
```
