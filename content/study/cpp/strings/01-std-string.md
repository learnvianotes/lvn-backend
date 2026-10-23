---
id: 1f0a6169-2e95-7890-815a-e8eabcf872c3
key: topic:cpp/strings
subject: cpp
topic: strings
title: std::string
slug: std-string
order: 1
---

`std::string` is a growable, owning sequence of `char` with value semantics — copying a string copies its characters. Forget `char*` for text.

# Create, combine, access

```cpp filename:C%2B%2B
#include <cctype>
#include <iostream>
#include <string>

int main() {
    std::string a = "Hello";
    std::string b(3, '!');              // "!!!"
    std::string c = a + ", world" + b;  // concatenation
    c += '?';
    std::cout << c << ' ' << c.size() << '\n';
    std::cout << c[0] << c.front() << c.back() << ' ' << c.at(4) << '\n';
    std::cout << std::boolalpha << c.empty() << ' ' << (a == "Hello") << ' ' << (a < "Help") << '\n';
    for (char& ch : a) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
    std::cout << a << '\n';
}
```

```text filename:Output
Hello, world!!!? 16
HH? o
false true true
HELLO
```

# Search &amp; modify

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

int main() {
    std::string s = "the quick brown fox";
    std::cout << s.find("quick") << ' ' << s.find('o') << ' ' << s.rfind('o') << '\n';
    if (s.find("cat") == std::string::npos) std::cout << "no cat\n";

    std::cout << s.substr(4, 5) << '|' << s.substr(16) << '\n';   // substr(pos, count)
    s.replace(4, 5, "slow");                                      // replace(pos, count, text)
    s.insert(0, ">> ");
    s.erase(s.size() - 4);                                        // erase from pos to end
    std::cout << s << '\n';
    std::cout << s.starts_with(">>") << s.ends_with("brown") << '\n';  // C++20
}
```

```text filename:Output
4 12 17
no cat
quick|fox
>> the slow brown
11
```

| Operation | Call | Notes |
| --- | --- | --- |
| Length | `s.size()` / `s.length()` | O(1) |
| Find | `s.find(x, pos)`, `rfind`, `find_first_of` | Returns index or `std::string::npos` |
| Substring | `s.substr(pos, len)` | Returns a <em>new</em> string (copy) |
| Modify | `+=`, `push_back`, `pop_back`, `insert`, `erase`, `replace`, `clear` | Amortised O(1) append |
| Compare | `==`, `<`, `s.compare(t)` | Lexicographic |
| Prefix/suffix | `starts_with`, `ends_with` (C++20), `contains` (C++23) |  |
| C string | `s.c_str()` | Null-terminated `const char*` for C APIs |

# Numbers ↔ strings

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

int main() {
    int n = std::stoi("42");
    double d = std::stod("3.5");
    long long big = std::stoll("9000000000");
    std::string s = std::to_string(n + 1) + "/" + std::to_string(big);
    std::cout << n * 2 << ' ' << d * 2 << ' ' << s << '\n';
    std::cout << std::stoi("ff", nullptr, 16) << ' ' << std::stoi("  12abc") << '\n';   // base 16; stops at non-digits
    try { std::cout << std::stoi("abc"); } catch (const std::invalid_argument&) { std::cout << "invalid\n"; }
}
```

```text filename:Output
84 7 43/9000000000
255 12
invalid
```

# Splitting and joining

```cpp filename:C%2B%2B
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

std::vector<std::string> split(const std::string& s, char delim) {
    std::vector<std::string> parts;
    std::stringstream ss(s);
    std::string item;
    while (std::getline(ss, item, delim)) parts.push_back(item);
    return parts;
}

int main() {
    auto parts = split("red,green,,blue", ',');
    std::cout << parts.size() << '\n';
    std::string joined;
    for (std::size_t i = 0; i < parts.size(); ++i) joined += (i ? " | " : "") + parts[i];
    std::cout << joined << '\n';
}
```

```text filename:Output
4
red | green |  | blue
```

> [!NOTE] SSO
>
> Small strings (≈ up to 15–22 chars depending on the library) are stored <em>inside</em> the string object — the <strong>small string optimisation (SSO)</strong> — so no heap allocation happens for them.

> [!WARNING] Watch out
>
> `s + 'a' + 'b'` is fine, but `"abc" + "def"` doesn't compile (two pointers), and `"abc" + 1` compiles to pointer arithmetic (`"bc"`)! Make one side a `std::string`: `std::string("abc") + "def"` or `"abc"s + "def"`.

```question
What does std::string::npos mean?

---

It's the largest value of `std::size_t` (`static_cast<size_t>(-1)`). Search functions return it to mean “not found”, and `substr`/`erase` accept it as “until the end”.
```

```question
Is std::string null-terminated?

---

Since C++11, `s.c_str()` and `s.data()` are guaranteed to point to a null-terminated buffer and `s[s.size()]` is `'\0'`. But a `std::string` may also contain embedded `'\0'` characters, and `size()` doesn't count the terminator.
```
