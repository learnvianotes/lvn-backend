---
id: 476e6cff-fa46-75ff-90bf-9eaf999d8a06
key: topic:cpp/shared-weak-ptr
subject: cpp
topic: shared-weak-ptr
title: shared_ptr & weak_ptr
slug: shared-ptr-weak-ptr
order: 1
---

`std::shared_ptr` allows <em>shared</em> ownership through reference counting; the object is destroyed when the last owner lets go. `std::weak_ptr` observes without owning — the cure for reference cycles.

# Reference counting

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>

struct Texture {
    std::string file;
    explicit Texture(std::string f) : file(std::move(f)) {}
    ~Texture() { std::cout << "unload " << file << '\n'; }
};

int main() {
    auto tex = std::make_shared<Texture>("grass.png");   // count = 1
    std::cout << tex.use_count() << '\n';
    {
        auto sprite1 = tex;                               // count = 2
        std::shared_ptr<Texture> sprite2 = tex;           // count = 3
        std::cout << tex.use_count() << '\n';
    }                                                     // back to 1
    std::cout << tex.use_count() << '\n';
    tex.reset();                                          // 0 → destroyed
    std::cout << "done\n";
}
```

```text filename:Output
1
3
1
unload grass.png
done
```

# How it works

A `shared_ptr` is two pointers: one to the object, one to a <strong>control block</strong> holding the strong count, the weak count and the deleter. `make_shared` allocates object and control block in <em>one</em> allocation.

|  | `unique_ptr` | `shared_ptr` |
| --- | --- | --- |
| Owners | Exactly one | Many |
| Copyable | No (move only) | Yes (increments the count) |
| Size | 1 pointer | 2 pointers |
| Cost | Free | Atomic increments/decrements on copy/destroy |
| Default choice? | <strong>Yes</strong> | Only when ownership is genuinely shared |

# Cycles leak — `weak_ptr` breaks them

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>

struct Employee;
struct Team {
    std::string name;
    std::shared_ptr<Employee> lead;         // owns its lead
    ~Team() { std::cout << "~Team\n"; }
};
struct Employee {
    std::string name;
    std::weak_ptr<Team> team;               // observes: does NOT keep the team alive
    ~Employee() { std::cout << "~Employee\n"; }
};

int main() {
    auto team = std::make_shared<Team>();
    auto ada = std::make_shared<Employee>();
    team->name = "core";
    team->lead = ada;
    ada->team = team;
    if (auto t = ada->team.lock())          // lock(): shared_ptr if still alive, else empty
        std::cout << "ada is in " << t->name << '\n';
    std::cout << team.use_count() << ' ' << ada.use_count() << '\n';
}   // both destroyed; with shared_ptr in both directions neither destructor would run
```

```text filename:Output
ada is in core
1 2
~Team
~Employee
```

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
int main() {
    std::weak_ptr<int> watcher;
    {
        auto p = std::make_shared<int>(42);
        watcher = p;
        std::cout << watcher.expired() << ' ' << *watcher.lock() << '\n';
    }
    std::cout << watcher.expired() << ' ' << (watcher.lock() == nullptr) << '\n';
}
```

```text filename:Output
0 42
1 1
```

# `enable_shared_from_this`

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>

struct Session : std::enable_shared_from_this<Session> {
    std::shared_ptr<Session> self() { return shared_from_this(); }   // NOT shared_ptr<Session>(this)!
};

int main() {
    auto s = std::make_shared<Session>();
    auto again = s->self();
    std::cout << s.use_count() << '\n';     // shares the same control block
}
```

```text filename:Output
2
```

> [!WARNING] Watch out
>
> Never create two `shared_ptr`s from the same raw pointer (`std::shared_ptr<T> a(raw), b(raw);`) — each gets its own control block and both delete the object. Create once with `make_shared` and copy the `shared_ptr`.

```question
Is shared\_ptr thread-safe?

---

The reference count is updated atomically, so copying and destroying <em>different</em> `shared_ptr` instances that share an object is safe across threads. Accessing the <em>pointed-to object</em>, or modifying the <em>same</em> `shared_ptr` instance from several threads, still needs synchronisation (C++20 offers `std::atomic<std::shared_ptr<T>>`).
```

```question
When would you use weak\_ptr?

---

To break ownership cycles (child → parent back-links, observer lists), and for caches that should not keep objects alive: `lock()` tells you whether the object still exists and gives you temporary ownership while you use it.
```
