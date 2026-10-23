---
id: cb92990c-1b70-7f59-b8f8-1e110e18d560
key: topic:cpp/casts-rtti
subject: cpp
topic: casts-rtti
title: Casts & RTTI
slug: casts-rtti
order: 1
---

C++ replaces the all-powerful C cast with four named casts, each saying <em>what</em> you're doing. `dynamic_cast` and `typeid` use Run-Time Type Information.

# The four casts

| Cast | Checked | Use |
| --- | --- | --- |
| `static_cast<T>` | Compile time | Numeric conversions, `void*` → `T*`, up-casts, down-casts you <em>know</em> are valid, enum ↔ int |
| `dynamic_cast<T>` | <strong>Run time</strong> | Safe down-cast/cross-cast in a polymorphic hierarchy; `nullptr` (pointers) or `std::bad_cast` (references) on failure |
| `const_cast<T>` | Compile time | Remove/add `const` — e.g. calling a legacy API that forgot `const`. Modifying a truly const object is UB |
| `reinterpret_cast<T>` | None | Reinterpret bits: pointer ↔ integer, unrelated pointer types. Platform-specific |

# `static_cast`

```cpp filename:C%2B%2B
#include <iostream>
enum class Level { Low = 1, High = 3 };
int main() {
    double avg = static_cast<double>(7) / 2;
    int lvl = static_cast<int>(Level::High);
    char c = static_cast<char>(65);
    void* vp = &lvl;
    int* ip = static_cast<int*>(vp);
    std::cout << avg << ' ' << lvl << ' ' << c << ' ' << *ip << '\n';
}
```

```text filename:Output
3.5 3 A 3
```

# `dynamic_cast`

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <typeinfo>
#include <vector>

struct Animal { virtual ~Animal() = default; };     // must be polymorphic
struct Dog : Animal { void fetch() const { std::cout << "fetching\n"; } };
struct Cat : Animal {};

int main() {
    std::vector<std::unique_ptr<Animal>> zoo;
    zoo.push_back(std::make_unique<Dog>());
    zoo.push_back(std::make_unique<Cat>());
    for (const auto& a : zoo) {
        if (auto* d = dynamic_cast<Dog*>(a.get())) d->fetch();     // nullptr if not a Dog
        else std::cout << "not a dog\n";
    }
    Cat cat;
    Animal& ref = cat;
    try {
        Dog& d = dynamic_cast<Dog&>(ref);                         // reference form throws
        d.fetch();
    } catch (const std::bad_cast&) {
        std::cout << "bad_cast\n";
    }
}
```

```text filename:Output
fetching
not a dog
bad_cast
```

> [!NOTE] Key point
>
> Needing lots of `dynamic_cast` is a design smell — usually a virtual function should do the type-specific work. It also costs a run-time walk of the type hierarchy.

# `typeid`

```cpp filename:C%2B%2B
#include <iostream>
#include <typeinfo>
struct Base { virtual ~Base() = default; };
struct Derived : Base {};
struct NonPoly {};
struct NonPolyDerived : NonPoly {};
int main() {
    Derived d;
    Base& b = d;
    NonPolyDerived npd;
    NonPoly& np = npd;
    std::cout << (typeid(b) == typeid(Derived)) << ' ' << (typeid(np) == typeid(NonPolyDerived)) << '\n';
    std::cout << typeid(int).name() << ' ' << typeid(double).name() << '\n';   // implementation-defined names
}
```

```text filename:Output
1 0
i d
```

# `const_cast` &amp; `reinterpret_cast`

```cpp filename:C%2B%2B
#include <cstdint>
#include <cstring>
#include <iostream>

void legacyPrint(char* s) { std::cout << s << '\n'; }   // doesn't modify, but isn't const-correct

int main() {
    const char* msg = "hello";
    legacyPrint(const_cast<char*>(msg));                 // OK only because legacyPrint doesn't write

    int value = 0x01020304;
    auto addr = reinterpret_cast<std::uintptr_t>(&value);   // pointer → integer
    std::cout << (addr % alignof(int)) << '\n';

    float f = 1.0f;
    std::uint32_t bits;
    std::memcpy(&bits, &f, sizeof bits);                 // the safe way to inspect bits (or std::bit_cast)
    std::cout << std::hex << bits << '\n';
}
```

```text filename:Output
hello
0
3f800000
```

> [!WARNING] Watch out
>
> `*reinterpret_cast<std::uint32_t*>(&f)` violates <em>strict aliasing</em> (undefined behaviour). Use `std::memcpy` or C++20 `std::bit_cast<std::uint32_t>(f)` to reinterpret an object's bytes.

```question
Why avoid C-style casts in C++?

---

`(T)x` silently tries `const_cast`, `static_cast` and `reinterpret_cast` combinations until one compiles, so it can cast away `const` or reinterpret pointers by accident. Named casts state intent, are restricted to what they say, and are easy to grep for.
```

```question
static\_cast vs dynamic\_cast for down-casting?

---

`static_cast<Derived*>(basePtr)` trusts you: no run-time check, UB if the object isn't really a `Derived`. `dynamic_cast` checks the actual type using RTTI and returns `nullptr` (or throws for references) when it's wrong — safer but slower, and it only works on polymorphic types.
```
