---
id: 72c5e1d9-5663-7f02-a58d-de9a9e0c794a
key: topic:cpp/file-streams
subject: cpp
topic: file-streams
title: File I/O with fstream
slug: file-i-o-with-fstream
order: 1
---

`<fstream>` gives you `std::ofstream` (write), `std::ifstream` (read) and `std::fstream` (both). They work exactly like `cin`/`cout` and close themselves (RAII).

# Write, then read back

```cpp filename:C%2B%2B
#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

int main() {
    {
        std::ofstream out("scores.txt");                 // truncates / creates
        if (!out) { std::cerr << "cannot open\n"; return 1; }
        out << "ada 91\n" << "bob 78\n" << "cy 85\n";
    }                                                     // closed (and flushed) here

    {
        std::ofstream app("scores.txt", std::ios::app);  // append mode
        app << "dee 99\n";
    }

    std::ifstream in("scores.txt");
    std::string name;
    int score, total = 0, count = 0;
    while (in >> name >> score) {                         // token-by-token
        total += score;
        ++count;
    }
    std::cout << count << " students, average " << total / count << '\n';

    in.clear();                                           // reset EOF flag…
    in.seekg(0);                                          // …and rewind
    std::string line;
    std::getline(in, line);                               // line-by-line
    std::cout << "first line: " << line << '\n';
    in.close();
    std::remove("scores.txt");
}
```

```text filename:Output
4 students, average 88
first line: ada 91
```

| Mode flag | Meaning |
| --- | --- |
| `std::ios::in` / `std::ios::out` | Read / write (defaults for `ifstream` / `ofstream`) |
| `std::ios::app` | Every write goes to the end |
| `std::ios::trunc` | Discard existing contents (default for `ofstream`) |
| `std::ios::binary` | No newline translation (matters on Windows) |
| `std::ios::ate` | Start at the end, but may seek anywhere |

# Stream state

| Check | True when |
| --- | --- |
| `if (stream)` / `!stream.fail()` | Last operation succeeded |
| `stream.eof()` | Tried to read past the end |
| `stream.fail()` | Format error or EOF (e.g. reading letters into an `int`) |
| `stream.bad()` | Unrecoverable I/O error |
| `stream.clear()` | Resets the flags so you can continue |

> [!WARNING] Watch out
>
> `while (!in.eof()) { in >> x; … }` processes the last value twice (or garbage) because `eof()` only becomes true <em>after</em> a read fails. Loop on the read itself: `while (in >> x)` / `while (std::getline(in, line))`.

# Binary files &amp; whole-file reads

```cpp filename:C%2B%2B
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>

int main() {
    std::vector<int> data{1, 2, 3, 1000000};
    {
        std::ofstream out("data.bin", std::ios::binary);
        out.write(reinterpret_cast<const char*>(data.data()), data.size() * sizeof(int));
    }
    std::ifstream in("data.bin", std::ios::binary);
    std::vector<int> back(4);
    in.read(reinterpret_cast<char*>(back.data()), back.size() * sizeof(int));
    std::cout << in.gcount() << " bytes, last = " << back[3] << '\n';

    std::ofstream("note.txt") << "line one\nline two\n";
    std::ifstream t("note.txt");
    std::stringstream buffer;
    buffer << t.rdbuf();                                  // slurp the whole file
    std::cout << buffer.str().size() << " chars\n";
    std::remove("data.bin");
    std::remove("note.txt");
}
```

```text filename:Output
16 bytes, last = 1000000
18 chars
```

> [!NOTE] std::filesystem
>
> For paths, directories, file sizes and existence checks, use `<filesystem>` (C++17): `std::filesystem::exists(p)`, `file_size(p)`, `directory_iterator`, `create_directories`.

```question
Do you need to call close() on an fstream?

---

Usually not: the destructor flushes and closes the file when the stream goes out of scope (RAII). Call `close()` explicitly when you want to reuse the stream object, check for errors on close, or make sure data is on disk before doing something else with the file.
```
