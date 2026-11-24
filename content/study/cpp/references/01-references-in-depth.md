---
id: 84ff5e44-4f5a-7315-b2ea-011d23c7d5b4
key: topic:cpp/references
subject: cpp
topic: references
title: References in Depth
slug: references-in-depth
order: 1
---

A reference is another name for an existing object. C++ has lvalue references (`T&`), const references (`const T&`) and rvalue references (`T&&`).

# lvalue references

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    int x = 1;
    int& r = x;          // r is x
    r = 5;
    std::cout << x << ' ' << (&r == &x) << '\n';

    int y = 99;
    r = y;               // NOT re-binding: assigns 99 to x
    std::cout << x << '\n';

    std::vector<int> v{1, 2, 3};
    int& first = v[0];   // reference to an element
    first = 100;
    std::cout << v[0] << '\n';
}
```

```text filename:Output
5 1
99
100
```

- Must be initialised: `int& r;` is an error.
- Can't be null and can't be re-seated to another object.
- No “reference to reference”, no arrays of references, no pointers to references.

# const references bind to temporaries

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
std::string makeName() { return "temp"; }
int main() {
    const std::string& ref = makeName();   // lifetime of the temporary is extended to ref's scope
    const int& n = 42;                     // binds to a materialised temporary
    std::cout << ref << ' ' << n << '\n';
    // std::string& bad = makeName();      // error: non-const lvalue ref can't bind to an rvalue
}
```

```text filename:Output
temp 42
```

# lvalues and rvalues

> [!INFO]
>
> <strong>lvalue</strong> — an expression that names an object with an identity — you can take its address: variables, `*p`, `v[i]`, a function returning `T&`.

> [!INFO]
>
> <strong>rvalue</strong> — a temporary or literal with no persistent identity: `42`, `a + b`, `makeName()`, `std::move(x)`. Rvalue references `T&&` bind only to these — the basis of move semantics.

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>

void take(const std::string&) { std::cout << "lvalue (or const)\n"; }
void take(std::string&&)      { std::cout << "rvalue — can steal its guts\n"; }

int main() {
    std::string s = "hi";
    take(s);                     // lvalue
    take(std::string("tmp"));    // prvalue (temporary)
    take(s + "!");               // result of an expression is a temporary
    take(std::move(s));          // std::move casts s to an rvalue (xvalue)
}
```

```text filename:Output
lvalue (or const)
rvalue — can steal its guts
rvalue — can steal its guts
rvalue — can steal its guts
```

| Reference | Binds to lvalue | Binds to rvalue | Typical use |
| --- | --- | --- | --- |
| `T&` | Yes | No | Modify caller's object |
| `const T&` | Yes | Yes | Read-only parameter, no copy |
| `T&&` | No | Yes | Move constructors, sink parameters |
| `auto&&` / `T&&` in a template | Yes | Yes | Forwarding (“universal”) reference |

# Dangling references

```cpp filename:C%2B%2B%20%E2%80%94%20reference%20invalidated%20by%20reallocation
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v{1, 2, 3};
    int& ref = v[0];
    v.push_back(4);             // may reallocate: ref now refers to freed memory
    std::cout << ref << '\n';   // AddressSanitizer: heap-use-after-free
}
```

> [!WARNING] Watch out
>
> References don't keep objects alive (except the temporary-lifetime-extension case above). Returning a reference to a local, or holding one into a `vector` that grows, is undefined behaviour.

```question
Can a reference be null?

---

Not in a valid program. You can <em>create</em> one by dereferencing a null pointer (`int& r = *p;`), but that dereference is already undefined behaviour. Code may assume references always refer to an object.
```

```question
What does it mean that std::move doesn't move anything?

---

`std::move(x)` is just a cast to `T&&` — it marks `x` as an rvalue so that overload resolution picks the move constructor/assignment. The actual moving happens in that constructor. After being moved from, `x` is valid but in an unspecified state.
```
