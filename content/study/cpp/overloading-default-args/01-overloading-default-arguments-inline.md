---
id: 2159eb04-6472-719c-8dca-3a6ba7cc2cae
key: topic:cpp/overloading-default-args
subject: cpp
topic: overloading-default-args
title: Overloading, Default Arguments & inline
slug: overloading-default-arguments-inline
order: 1
---

Several functions can share a name if their parameter lists differ; the compiler picks the best match at compile time. Default arguments fill in trailing parameters.

# Function overloading

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

int area(int side)               { return side * side; }
int area(int w, int h)           { return w * h; }
double area(double radius)       { return 3.14159 * radius * radius; }
std::string describe(int)        { return "int"; }
std::string describe(long)       { return "long"; }
std::string describe(const std::string&) { return "string"; }

int main() {
    std::cout << area(4) << ' ' << area(2, 3) << ' ' << area(1.0) << '\n';
    std::cout << describe(1) << ' ' << describe(1L) << ' ' << describe("hi") << '\n';
    std::cout << describe('c') << '\n';   // char → int is a promotion: best match
}
```

```text filename:Output
16 6 3.14159
int long string
int
```

| Rank | Conversion needed | Example |
| --- | --- | --- |
| 1. Exact match | None (or trivial: array→pointer, adding `const`) | `f(int)` for `f(5)` |
| 2. Promotion | `char`/`short`/`bool` → `int`, `float` → `double` | `f(int)` for `f('c')` |
| 3. Standard conversion | `int` → `double`, `double` → `int`, derived\* → base\* | `f(double)` for `f(5)` |
| 4. User-defined | Constructor or conversion operator | `f(std::string)` for `f("hi")` |

> [!WARNING] Watch out
>
> Return type alone can't distinguish overloads, and two equally good matches are a compile error: with `f(int)` and `f(double)`, calling `f(5L)` is <strong>ambiguous</strong>.

```cpp filename:C%2B%2B
void f(int) {}
void f(double) {}
int main() {
    f(5L);      // error: call to 'f' is ambiguous (long → int and long → double rank the same)
}
```

# Default arguments

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

void log(const std::string& msg, int level = 1, char end = '\n') {
    std::cout << "[" << level << "] " << msg << end;
}

int main() {
    log("start");
    log("warn", 2);
    log("inline", 3, ' ');
    log("done");
}
```

```text filename:Output
[1] start
[2] warn
[3] inline [1] done
```

- Defaults must be the <strong>trailing</strong> parameters: `void f(int a = 1, int b);` is illegal.
- Specify them once — in the declaration (header), not again in the definition.
- They're substituted at the <em>call site</em> at compile time; for virtual functions the default comes from the <em>static</em> type — a classic trap.

# `inline`

`inline` originally meant “please paste the body at the call site”. Today compilers decide inlining themselves; the keyword's real meaning is <strong>ODR</strong>: an `inline` function (or C++17 `inline` variable) may be defined in a header included by many `.cpp` files without “multiple definition” link errors.

```cpp filename:C%2B%2B
#include <iostream>
inline int maxOf(int a, int b) { return a > b ? a : b; }   // OK to live in a header
inline constexpr int kVersion = 3;                           // C++17 inline variable
struct Box {
    int w = 2;
    int width() const { return w; }   // member functions defined in the class are implicitly inline
};
int main() { std::cout << maxOf(3, 9) << ' ' << kVersion << ' ' << Box{}.width() << '\n'; }
```

```text filename:Output
9 3 2
```

```question
Can overloaded functions differ only by const on a by-value parameter?

---

No. `void f(int)` and `void f(const int)` declare the <em>same</em> function — top-level `const` on a by-value parameter isn't part of the signature. `f(int&)` vs `f(const int&)`, however, are distinct overloads.
```

```question
What's the difference between a macro and an inline function?

---

A macro is textual substitution by the preprocessor: no types, no scope, arguments may be evaluated twice (`MAX(i++, j)`). An inline function is a real function — type-checked, scoped, arguments evaluated once — and is optimised just as well.
```
