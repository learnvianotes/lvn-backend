---
id: 32baf6d5-bb2a-753c-83f4-48d6d35f2ec0
key: topic:cpp/stringstream
subject: cpp
topic: stringstream
title: String Streams
slug: string-streams
order: 1
---

`std::stringstream` (from `<sstream>`) is a stream whose buffer is a string — use it to parse text with `>>` or to build strings with `<<`.

# Parsing

```cpp filename:C%2B%2B
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int main() {
    std::istringstream in("3 4.5 hello 7");
    int a; double b; std::string word; int c;
    in >> a >> b >> word >> c;
    std::cout << a + c << ' ' << b << ' ' << word << '\n';

    std::string line = "10,20,30";
    std::stringstream ss(line);
    std::vector<int> nums;
    for (std::string tok; std::getline(ss, tok, ',');) nums.push_back(std::stoi(tok));
    std::cout << nums.size() << ' ' << nums[2] << '\n';

    std::istringstream bad("12abc");
    int n; std::string rest;
    bad >> n >> rest;                     // reads 12, then "abc"
    std::cout << n << ' ' << rest << '\n';

    std::istringstream words("  the   quick brown  ");
    int count = 0;
    for (std::string w; words >> w;) ++count;
    std::cout << count << " words\n";
}
```

```text filename:Output
10 4.5 hello
3 30
12 abc
3 words
```

# Building strings

```cpp filename:C%2B%2B
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

std::string toHex(int value) {
    std::ostringstream os;
    os << "0x" << std::hex << std::setw(4) << std::setfill('0') << value;
    return os.str();
}

int main() {
    std::ostringstream report;
    report << "total=" << 42 << ", ratio=" << std::fixed << std::setprecision(2) << 0.4567;
    std::cout << report.str() << '\n';
    std::cout << toHex(255) << '\n';

    report.str("");                        // reuse: reset the contents…
    report.clear();                        // …and the state flags
    report << "fresh";
    std::cout << report.str() << '\n';
}
```

```text filename:Output
total=42, ratio=0.46
0x00ff
fresh
```

| Class | Direction |
| --- | --- |
| `std::istringstream` | Read from a string (`>>`, `getline`) |
| `std::ostringstream` | Write into a string (`<<`, then `.str()`) |
| `std::stringstream` | Both |

> [!NOTE] Key point
>
> For simple number formatting `std::format` / `std::to_string` are faster and clearer; for fast number parsing without exceptions or locale, use `std::from_chars` (`<charconv>`).

```question
How do you split a string by a delimiter in C++?

---

Wrap it in a `std::stringstream` and call `std::getline(ss, token, delim)` in a loop — or, in C++20, iterate `str | std::views::split(delim)`. For whitespace-separated tokens, just use `ss >> token`.
```
