---
id: 0177c2b7-ca9a-7317-aff8-6481d4449291
key: topic:cpp/optional-variant-any
subject: cpp
topic: optional-variant-any
title: optional, variant & any
slug: optional-variant-any
order: 1
---

C++17 vocabulary types: `std::optional<T>` for “a value or nothing”, `std::variant<A, B, …>` for “exactly one of these types”, `std::any` for “any type at all”.

# `std::optional`

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <optional>
#include <string>

std::optional<int> findAge(const std::map<std::string, int>& db, const std::string& name) {
    auto it = db.find(name);
    if (it == db.end()) return std::nullopt;          // “no value” — no sentinel like -1
    return it->second;
}

int main() {
    std::map<std::string, int> db{{"ada", 36}};
    if (auto age = findAge(db, "ada")) std::cout << "ada " << *age << '\n';     // contextual bool
    auto missing = findAge(db, "bob");
    std::cout << missing.has_value() << ' ' << missing.value_or(-1) << '\n';
    try { std::cout << missing.value(); }                                       // throws if empty
    catch (const std::bad_optional_access&) { std::cout << "bad_optional_access\n"; }

    std::optional<std::string> nick;
    nick = "Addy";
    nick.reset();
    nick.emplace(3, 'z');
    std::cout << *nick << ' ' << nick->size() << '\n';
}
```

```text filename:Output
ada 36
0 -1
bad_optional_access
zzz 3
```

> [!NOTE] Key point
>
> `optional` stores the value <em>inline</em> (no heap allocation) plus a `bool`. Use it for return values that may be absent and for optional members; don't use `optional<T&>` (not allowed) — use `T*` for optional references.

# `std::variant` — a type-safe union

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <variant>
#include <vector>

template <class... Fs> struct overloaded : Fs... { using Fs::operator()...; };   // visitor helper

using Json = std::variant<std::nullptr_t, bool, int, std::string>;

int main() {
    std::vector<Json> values{nullptr, true, 42, std::string("hi")};
    for (const auto& v : values) {
        std::visit(overloaded{
            [](std::nullptr_t)          { std::cout << "null\n"; },
            [](bool b)                  { std::cout << "bool " << b << '\n'; },
            [](int i)                   { std::cout << "int " << i << '\n'; },
            [](const std::string& s)    { std::cout << "string " << s << '\n'; },
        }, v);
    }

    std::variant<int, std::string> x = 5;
    std::cout << x.index() << ' ' << std::holds_alternative<int>(x) << ' ' << std::get<int>(x) << '\n';
    x = "now a string";
    if (auto* s = std::get_if<std::string>(&x)) std::cout << *s << '\n';
    try { std::get<int>(x); } catch (const std::bad_variant_access&) { std::cout << "bad_variant_access\n"; }
}
```

```text filename:Output
null
bool 1
int 42
string hi
0 1 5
now a string
bad_variant_access
```

A `variant` holds exactly one alternative at a time, knows which (`index()`), and its size is the largest alternative plus a tag. It's the value-semantic alternative to a class hierarchy when the set of types is closed: no heap, no virtual calls, and `std::visit` forces you to handle every case.

# `std::any`

```cpp filename:C%2B%2B
#include <any>
#include <iostream>
#include <string>

int main() {
    std::any a = 42;
    std::cout << a.type().name() << ' ' << std::any_cast<int>(a) << '\n';
    a = std::string("text");
    if (auto* s = std::any_cast<std::string>(&a)) std::cout << *s << '\n';   // pointer form: nullptr on mismatch
    try { std::any_cast<double>(a); } catch (const std::bad_any_cast&) { std::cout << "bad_any_cast\n"; }
    a.reset();
    std::cout << a.has_value() << '\n';
}
```

```text filename:Output
i 42
text
bad_any_cast
0
```

| Type | Holds | Checked by | Typical use |
| --- | --- | --- | --- |
| `optional<T>` | A `T` or nothing | `has_value()`, `if (opt)` | Maybe-absent results |
| `variant<Ts...>` | Exactly one of a <em>closed</em> set of types | `index()`, `holds_alternative`, `visit` | State machines, AST nodes, message types, parse results |
| `any` | Any copyable type | `any_cast` (run time) | Rarely: plugin/config bags with unknown types |

> [!NOTE] C++23
>
> C++23 adds `std::expected<T, E>` — a value <strong>or an error</strong> — for error handling without exceptions. (libc++ in C++20 mode doesn't provide it; with `-std=c++23` it's available.)

```question
When would you use std::variant instead of inheritance?

---

When the set of alternatives is fixed and known (closed), you want value semantics (copyable, no heap allocation), and you're adding <em>operations</em> more often than <em>types</em>. Inheritance suits open sets of types where new subclasses get added and operations are fixed.
```
