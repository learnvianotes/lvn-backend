---
id: b2db81fb-e332-7e78-ad91-62a5929dd362
key: topic:cpp/string-view
subject: cpp
topic: string-view
title: std::string_view
slug: std-string-view
order: 1
---

`std::string_view` (C++17) is a read-only, non-owning window onto characters: a pointer plus a length. Passing and slicing it never allocates.

# Why use it

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <string_view>

std::size_t countVowels(std::string_view text) {       // accepts literals, std::string, substrings…
    std::size_t n = 0;
    for (char c : text) n += std::string_view("aeiou").find(c) != std::string_view::npos;
    return n;
}

int main() {
    std::string s = "education";
    std::cout << countVowels(s) << ' ' << countVowels("sky") << '\n';   // no temporary std::string for "sky"

    std::string_view sv = "  trim me  ";
    sv.remove_prefix(sv.find_first_not_of(' '));
    sv.remove_suffix(sv.size() - sv.find_last_not_of(' ') - 1);
    std::cout << '[' << sv << "] " << sv.substr(0, 4) << '\n';          // substr is O(1): no copy
}
```

```text filename:Output
5 0
[trim me] trim
```

|  | `const std::string&` | `std::string_view` |
| --- | --- | --- |
| Pass a literal `"abc"` | Creates a temporary `std::string` (may allocate) | No allocation |
| `substr` | Copies → new string | O(1), shares the characters |
| Owns data | The referred string does | <strong>Never</strong> |
| Null-terminated | Yes (`c_str()`) | <strong>Not guaranteed</strong> |
| Can modify chars | No (const) | No |

# The dangling trap

```cpp filename:C%2B%2B%20%E2%80%94%20view%20outliving%20its%20string
#include <iostream>
#include <string>
#include <string_view>

std::string makeGreeting() { return std::string(40, 'x'); }

int main() {
    std::string_view sv = makeGreeting();   // view into a temporary that dies at the ';'
    std::cout << sv << '\n';                // clang warns (-Wdangling-gsl); at run time: use-after-free
}
```

> [!WARNING] Watch out
>
> A `string_view` must never outlive the characters it views. Don't return one pointing into a local `std::string`, and don't store one in a long-lived object unless you control the owner's lifetime.

> [!TIP] Do
>
> Use `std::string_view` for read-only <em>parameters</em> and short-lived parsing.

> [!DANGER] Avoid
>
> Storing `string_view` members or returning views into temporaries; passing `sv.data()` to a C API that expects a null-terminated string.

```question
When should a function take std::string by value instead of string\_view?

---

When it will <em>keep</em> a copy (e.g. a constructor storing a name): take `std::string` by value and `std::move` it into the member. Callers with temporaries then pay only a move. `string_view` is for functions that only read during the call.
```
