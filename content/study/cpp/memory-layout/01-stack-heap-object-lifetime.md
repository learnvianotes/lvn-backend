---
id: 8715d55c-ee29-71ba-8d85-371850d73d57
key: topic:cpp/memory-layout
subject: cpp
topic: memory-layout
title: Stack, Heap & Object Lifetime
slug: stack-heap-object-lifetime
order: 1
---

Where an object lives decides how long it lives. C++ has four <em>storage durations</em>; knowing them is the key to avoiding dangling pointers.

# Memory segments of a process

| Region | Holds | Lifetime | Managed by |
| --- | --- | --- | --- |
| <strong>Stack</strong> | Local variables, parameters, return addresses | Until the enclosing block ends | Automatic (push/pop) |
| <strong>Heap</strong> (free store) | Objects from `new` / containers' buffers | Until `delete` | You (or RAII owners) |
| <strong>Static / global data</strong> | Globals, `static` locals &amp; members | Whole program | Runtime |
| <strong>Code (text)</strong> | Machine instructions, string literals (read-only data) | Whole program | Loader |

# Storage durations

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>

struct Tracer {
    std::string name;
    explicit Tracer(std::string n) : name(std::move(n)) { std::cout << "+ " << name << '\n'; }
    ~Tracer() { std::cout << "- " << name << '\n'; }
};

Tracer global("static");                 // static: before main, destroyed after main

void f() {
    static Tracer once("static-local");  // created on first call only
    Tracer local("automatic");           // destroyed at the end of f
}

int main() {
    std::cout << "main starts\n";
    f();
    f();
    auto heap = std::make_unique<Tracer>("dynamic");   // lives until its owner lets go
    heap.reset();
    std::cout << "main ends\n";
}
```

```text filename:Output
+ static
main starts
+ static-local
+ automatic
- automatic
+ automatic
- automatic
+ dynamic
- dynamic
main ends
- static-local
- static
```

- <strong>Automatic</strong> — block-scoped locals. Destroyed in <em>reverse order of construction</em> when the block ends.
- <strong>Static</strong> — globals, namespace variables, `static` locals/members. Static locals are initialised on first use (thread-safe since C++11).
- <strong>Dynamic</strong> — `new`/`delete`, or owned by smart pointers/containers.
- <strong>Thread</strong> — `thread_local` variables: one instance per thread.

# Stack vs heap

|  | Stack | Heap |
| --- | --- | --- |
| Allocation speed | Very fast (move a pointer) | Slower (allocator bookkeeping) |
| Size limit | Small (\~1–8 MB) | Large (up to available memory) |
| Lifetime | Tied to scope | Explicit / owner-controlled |
| Fragmentation | None | Possible |
| Typical failure | Stack overflow (deep recursion, huge local arrays) | Leaks, use-after-free |

> [!WARNING] Watch out
>
> `int big[10'000'000];` as a local variable (40 MB) overflows the stack. Use `std::vector<int> big(10'000'000);` — the vector object sits on the stack, its buffer on the heap.

# Object size &amp; alignment

```cpp filename:C%2B%2B
#include <iostream>
struct Padded  { char a; int b; char c; };    // 1 + 3 pad + 4 + 1 + 3 pad
struct Ordered { int b; char a; char c; };    // 4 + 1 + 1 + 2 pad
struct Empty {};
int main() {
    std::cout << sizeof(Padded) << ' ' << sizeof(Ordered) << ' ' << alignof(int) << ' ' << sizeof(Empty) << '\n';
}
```

```text filename:Output
12 8 4 1
```

> [!NOTE] Key point
>
> Members are laid out in declaration order with padding to satisfy alignment. Ordering members from largest to smallest often shrinks a struct. An empty class still has size 1 so distinct objects have distinct addresses.

```question
Why is the stack faster than the heap?

---

Allocating on the stack is just adjusting the stack pointer, and freeing is automatic at scope exit; the memory is also hot in cache. Heap allocation must find a free block of the right size (and possibly lock for thread safety), then later return it.
```

```question
In what order are local objects destroyed?

---

In reverse order of construction, when control leaves their scope — whether by reaching `}`, `return`, `break`, or an exception unwinding the stack. This deterministic order is what makes RAII reliable.
```
