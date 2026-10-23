---
id: 193e574c-417e-77c1-a31b-a8544c1fae42
key: topic:cpp/class-templates
subject: cpp
topic: class-templates
title: Class Templates & Specialisation
slug: class-templates-specialisation
order: 1
---

Class templates are how the STL is built: `std::vector<T>`, `std::map<K, V>`, `std::array<T, N>`. The type parameter becomes part of the class's type.

# A generic container

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

template <typename T>
class Stack {
public:
    void push(const T& value) { items_.push_back(value); }
    void pop() {
        if (items_.empty()) throw std::out_of_range("pop on empty stack");
        items_.pop_back();
    }
    const T& top() const { return items_.back(); }
    bool empty() const { return items_.empty(); }
    std::size_t size() const { return items_.size(); }
private:
    std::vector<T> items_;
};

int main() {
    Stack<int> s;
    s.push(1); s.push(2); s.push(3);
    s.pop();
    std::cout << s.top() << ' ' << s.size() << '\n';

    Stack<std::string> words;
    words.push("hello");
    std::cout << words.top() << '\n';
}
```

```text filename:Output
2 2
hello
```

# Defaults, non-type parameters and CTAD

```cpp filename:C%2B%2B
#include <array>
#include <iostream>
#include <utility>
#include <vector>

template <typename T, std::size_t Capacity = 4>
class RingBuffer {
    std::array<T, Capacity> data_{};
    std::size_t head_ = 0, count_ = 0;
public:
    void push(T v) {
        data_[(head_ + count_) % Capacity] = v;
        if (count_ < Capacity) ++count_; else head_ = (head_ + 1) % Capacity;
    }
    T front() const { return data_[head_]; }
    std::size_t size() const { return count_; }
};

int main() {
    RingBuffer<int, 3> rb;
    for (int i = 1; i <= 5; ++i) rb.push(i);       // keeps the last 3
    std::cout << rb.front() << ' ' << rb.size() << '\n';

    std::pair p{1, 2.5};                            // CTAD (C++17): pair<int, double>
    std::vector v{1, 2, 3};                         // vector<int>
    std::cout << p.second << ' ' << v.size() << '\n';
}
```

```text filename:Output
3 3
2.5 3
```

# Full and partial specialisation

```cpp filename:C%2B%2B
#include <iostream>

template <typename T>
struct TypeName { static const char* get() { return "unknown"; } };

template <>                                   // full specialisation
struct TypeName<int> { static const char* get() { return "int"; } };

template <typename T>                         // partial specialisation: any pointer
struct TypeName<T*> { static const char* get() { return "pointer"; } };

template <typename K, typename V>
struct Pair { const char* kind() const { return "general"; } };
template <typename T>
struct Pair<T, T> { const char* kind() const { return "same types"; } };   // partial

int main() {
    std::cout << TypeName<int>::get() << ' ' << TypeName<double*>::get() << ' ' << TypeName<char>::get() << '\n';
    std::cout << Pair<int, double>{}.kind() << ", " << Pair<int, int>{}.kind() << '\n';
}
```

```text filename:Output
int pointer unknown
general, same types
```

|  | Function templates | Class templates |
| --- | --- | --- |
| Full specialisation | Yes | Yes |
| Partial specialisation | <strong>No</strong> (overload instead) | Yes |
| Deduce arguments | Yes (from call) | C++17 CTAD (from constructor) |

# Member templates &amp; `typename`

```cpp filename:C%2B%2B
#include <iostream>
#include <list>
#include <vector>

template <typename Container>
typename Container::value_type first(const Container& c) {   // `typename`: a dependent *type*
    return *c.begin();
}

struct Printer {
    template <typename T>
    void print(const T& x) const { std::cout << x << '\n'; }   // member function template
};

int main() {
    std::cout << first(std::vector<int>{7, 8}) << ' ' << first(std::list<char>{'z'}) << '\n';
    Printer{}.print(3.5);
}
```

```text filename:Output
7 z
3.5
```

```question
Why do you sometimes need the typename keyword inside a template?

---

In `Container::value_type`, the compiler can't know whether `value_type` is a type or a static member until `Container` is known. By default it assumes a value; `typename` tells it the dependent name is a type.
```

```question
What is the difference between full and partial specialisation?

---

Full specialisation fixes <em>all</em> template parameters (`TypeName<int>`); partial specialisation fixes some or constrains their form (`TypeName<T*>`, `Pair<T, T>`) and is still a template. Only class (and variable) templates can be partially specialised.
```
