---
id: 09e616f4-75f9-7f52-a9ab-af1e7677af05
key: topic:cpp/destructors-raii
subject: cpp
topic: destructors-raii
title: Destructors & RAII
slug: destructors-raii
order: 1
---

A destructor `~T()` runs automatically when an object's lifetime ends. <strong>RAII</strong> ties a resource (memory, file, lock, socket) to an object so the destructor always releases it — even when an exception is thrown.

> [!INFO]
>
> <strong>RAII</strong> — <em>Resource Acquisition Is Initialization</em>: acquire the resource in the constructor, release it in the destructor. The object's scope becomes the resource's lifetime.

# Destructor basics

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

struct Noisy {
    std::string name;
    explicit Noisy(std::string n) : name(std::move(n)) { std::cout << "ctor " << name << '\n'; }
    ~Noisy() { std::cout << "dtor " << name << '\n'; }
};

int main() {
    Noisy a("a");
    {
        Noisy b("b");
        Noisy c("c");
    }                             // c then b destroyed here — reverse order
    Noisy d("d");
    std::cout << "end of main\n";
}                                 // d then a
```

```text filename:Output
ctor a
ctor b
ctor c
dtor c
dtor b
ctor d
end of main
dtor d
dtor a
```

# Writing an RAII wrapper

```cpp filename:C%2B%2B
#include <cstdio>
#include <iostream>
#include <stdexcept>

class File {
    std::FILE* f_;
public:
    File(const char* path, const char* mode) : f_(std::fopen(path, mode)) {
        if (!f_) throw std::runtime_error("cannot open file");
    }
    ~File() { std::fclose(f_); std::cout << "file closed\n"; }
    File(const File&) = delete;              // one owner only
    File& operator=(const File&) = delete;
    std::FILE* get() const { return f_; }
};

void process() {
    File out("raii_demo.txt", "w");
    std::fputs("hello\n", out.get());
    throw std::runtime_error("something failed");   // destructor still closes the file
}

int main() {
    try { process(); } catch (const std::exception& e) { std::cout << "caught: " << e.what() << '\n'; }
    std::remove("raii_demo.txt");
}
```

```text filename:Output
file closed
caught: something failed
```

> [!NOTE] Memory
>
> `std::unique_ptr`, `std::shared_ptr`, `std::vector`, `std::string`

> [!NOTE] Locks
>
> `std::lock_guard`, `std::unique_lock`, `std::scoped_lock`

> [!NOTE] Files & streams
>
> `std::ifstream` / `std::ofstream` close on destruction

> [!NOTE] Threads
>
> `std::jthread` joins on destruction

# Scope guards

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>

template <class F>
class ScopeExit {                       // run any cleanup when the scope ends
    F fn_;
public:
    explicit ScopeExit(F fn) : fn_(std::move(fn)) {}
    ~ScopeExit() { fn_(); }
    ScopeExit(const ScopeExit&) = delete;
    ScopeExit& operator=(const ScopeExit&) = delete;
};

int main() {
    int depth = 0;
    {
        ++depth;
        ScopeExit restore([&] { --depth; std::cout << "restored\n"; });
        std::cout << "depth " << depth << '\n';
    }
    std::cout << "depth " << depth << '\n';
}
```

```text filename:Output
depth 1
restored
depth 0
```

> [!WARNING] Watch out
>
> Destructors should never throw. They're implicitly `noexcept`; if one throws while the stack is already unwinding due to another exception, `std::terminate` is called.

```question
Why doesn't C++ need a garbage collector?

---

Because resources are owned by objects with deterministic lifetimes: when the owner goes out of scope its destructor frees them. Containers and smart pointers apply RAII to memory; the same technique also handles non-memory resources (files, locks, sockets) that a GC wouldn't close promptly.
```

```question
When is a destructor called?

---

Automatic objects: at the end of their scope (including during exception unwinding). Static objects: after `main` returns. Heap objects: on `delete` (or when the owning smart pointer releases them). Temporaries: at the end of the full expression. Members and bases: after the containing object's destructor body, in reverse declaration order.
```
