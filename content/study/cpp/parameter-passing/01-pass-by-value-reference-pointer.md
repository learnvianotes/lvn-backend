---
id: e497bbac-b27d-7e7f-981b-2f56ec949f40
key: topic:cpp/parameter-passing
subject: cpp
topic: parameter-passing
title: Pass by Value, Reference & Pointer
slug: pass-by-value-reference-pointer
order: 1
---

How a parameter is declared decides whether the function gets a copy, an alias to the caller's object, or its address.

# The three ways

```cpp filename:C%2B%2B
#include <iostream>

void byValue(int x)      { x = 100; std::cout << "inside " << x << '\n'; }  // a copy
void byReference(int& x) { x = 200; }        // x IS the caller's variable
void byPointer(int* x)   { if (x) *x = 300; } // modifies through the address (may be null)

int main() {
    int a = 1;
    byValue(a);      std::cout << a << '\n';
    byReference(a);  std::cout << a << '\n';
    byPointer(&a);   std::cout << a << '\n';
    byPointer(nullptr);                       // allowed: pointers can express “no object”
}
```

```text filename:Output
inside 100
1
200
300
```

| Style | Copies? | Can modify caller? | Can be null? | Use for |
| --- | --- | --- | --- | --- |
| `T x` | Yes | No | — | Cheap types (`int`, `double`, small structs, iterators), or when you need a copy anyway |
| `const T& x` | No | No | No | <strong>Read-only</strong> access to anything non-trivial (`std::string`, `std::vector`) |
| `T& x` | No | Yes | No | Out/in-out parameters |
| `T* x` | No | Yes | <strong>Yes</strong> | Optional objects, C APIs |
| `T&& x` | No | Yes (steals) | No | Taking ownership of temporaries (move semantics) |

# Why `const&` for big objects

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

struct Tracker {
    std::string name;
    Tracker(std::string n) : name(std::move(n)) {}
    Tracker(const Tracker& other) : name(other.name) { std::cout << "copy!\n"; }
};

void slow(Tracker t)        { std::cout << "slow " << t.name << '\n'; }
void fast(const Tracker& t) { std::cout << "fast " << t.name << '\n'; }

int main() {
    Tracker big("report");
    slow(big);      // copies the whole object
    fast(big);      // no copy
}
```

```text filename:Output
copy!
slow report
fast report
```

# Swapping — the classic example

```cpp filename:C%2B%2B
#include <iostream>
void swapRef(int& a, int& b) { int t = a; a = b; b = t; }
void swapPtr(int* a, int* b) { int t = *a; *a = *b; *b = t; }
int main() {
    int x = 1, y = 2;
    swapRef(x, y);
    std::cout << x << y << '\n';
    swapPtr(&x, &y);
    std::cout << x << y << '\n';
}
```

```text filename:Output
21
12
```

# Passing arrays and containers

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

int sumArray(const int* arr, std::size_t n) {   // a C array decays to a pointer: size is lost
    int s = 0;
    for (std::size_t i = 0; i < n; ++i) s += arr[i];
    return s;
}
void doubleAll(std::vector<int>& v) { for (int& x : v) x *= 2; }

int main() {
    int raw[] = {1, 2, 3};
    std::cout << sumArray(raw, 3) << '\n';
    std::vector<int> v{1, 2, 3};
    doubleAll(v);
    std::cout << v[0] << v[1] << v[2] << '\n';
}
```

```text filename:Output
6
246
```

> [!NOTE] Guideline
>
> Rule of thumb: <strong>in</strong> params — by value if cheap to copy (≤ \~2 words), else `const T&`. <strong>Out/in-out</strong> — `T&`. <strong>Optional</strong> — `T*` or `std::optional`. <strong>Sink</strong> params you'll store — by value, then `std::move` into place.

> [!WARNING] Watch out
>
> A non-const reference can't bind to a temporary: `void f(std::string& s); f("hi");` is an error. `const std::string&` can — the temporary lives until the call returns.

```question
Is Java/Python-style pass by reference the same as C++ references?

---

No. Java and Python pass a <em>reference value</em> by value: reassigning the parameter doesn't affect the caller. A C++ `T&` parameter is a true alias: `x = other;` inside the function assigns to the caller's object.
```

```question
When would you pass by pointer instead of reference?

---

When “no object” is a valid input (`nullptr`), when interoperating with C APIs, or when you want the call site to show that the argument may be modified (`update(&config)`). Otherwise references are safer: they can't be null or re-seated.
```
