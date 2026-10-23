---
id: e7d94d36-9309-7905-af59-a26f45dccce4
key: topic:cpp/program-structure-io
subject: cpp
topic: program-structure-io
title: Program Structure & I/O Streams
slug: program-structure-i-o-streams
order: 1
---

`main` is the entry point; `std::cin` and `std::cout` read and write through type-safe <em>streams</em> with `>>` and `<<`.

# Anatomy of a program

```cpp filename:C%2B%2B
#include <iostream>     // std::cin, std::cout, std::cerr
#include <string>       // std::string

int main() {
    std::string name;
    int age;
    std::cin >> name >> age;             // whitespace-separated tokens
    std::cout << "Hi " << name << ", next year you'll be " << age + 1 << ".\n";
}
```

```text filename:Output
Hi Asha, next year you'll be 25.
```

| Stream | Purpose | Buffered? |
| --- | --- | --- |
| `std::cout` | Standard output | Yes |
| `std::cin` | Standard input | Yes |
| `std::cerr` | Error output (unbuffered — shows up immediately) | No |
| `std::clog` | Log output to stderr | Yes |

# `main` signatures

```cpp filename:C%2B%2B
#include <iostream>
int main(int argc, char* argv[]) {       // argc = number of args, argv[0] = program name
    std::cout << "args: " << argc - 1 << '\n';
    for (int i = 1; i < argc; ++i) std::cout << i << ": " << argv[i] << '\n';
    return 0;                            // 0 = success; non-zero = failure
}
```

```text filename:Output
args: 2
1: build
2: --fast
```

# Reading lines with `getline`

`>>` stops at whitespace. To read a whole line use `std::getline`. After a `>>`, the newline is still in the buffer — skip it with `std::ws` (or `cin.ignore()`) first.

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
int main() {
    int id;
    std::string fullName;
    std::cin >> id;
    std::getline(std::cin >> std::ws, fullName);   // std::ws eats the leftover '\n'
    std::cout << id << " -> [" << fullName << "]\n";
}
```

```text filename:Output
7 -> [Ada Lovelace]
```

> [!WARNING] Watch out
>
> Without `std::ws`, `getline` right after `cin >> id` reads the <em>empty rest of the line</em> and `fullName` ends up `""`. This is the #1 beginner I/O bug.

# Reading until end of input

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    long long sum = 0;
    int x;
    while (std::cin >> x) sum += x;   // the stream converts to false at EOF or bad input
    std::cout << "sum = " << sum << '\n';
}
```

```text filename:Output
sum = 22
```

# `\n` vs `std::endl`

> [!NOTE] '\n'
>
> Just a newline character. Output stays buffered — fast.

> [!NOTE] std::endl
>
> Newline <strong>plus a flush</strong> of the buffer. Flushing on every line can make output-heavy programs many times slower.

> [!NOTE] Key point
>
> Use `'\n'` by default; flush explicitly (`std::flush` or `std::endl`) only when output must appear <em>now</em> (e.g. before a long computation or a crash).

# `using namespace std;`

Everything in the standard library lives in namespace `std`. Writing `using namespace std;` saves typing in small programs and contest code, but in headers or large code bases it pulls hundreds of names into scope and causes clashes (`std::count`, `std::distance`, `std::size`…).

> [!TIP] Do
>
> Qualify names (`std::cout`) or import just what you need: `using std::cout;`

> [!DANGER] Avoid
>
> `using namespace std;` in a header file — it leaks into every file that includes it

```question
What does std::cin &gt;&gt; x return, and why can it be used in a while condition?

---

It returns the stream itself (`std::istream&`), which allows chaining (`cin >> a >> b`). A stream is contextually convertible to `bool`: it's `false` once a read failed (EOF or input that can't be parsed as the target type), so `while (cin >> x)` reads until input runs out.
```
