---
id: 71bae61f-841b-78e9-aae8-6eb6f917807c
key: topic:cpp/container-adaptors
subject: cpp
topic: container-adaptors
title: stack, queue & priority_queue
slug: stack-queue-priority-queue
order: 1
---

Container adaptors wrap a sequence container and expose only a restricted interface: LIFO (`stack`), FIFO (`queue`) or “largest first” (`priority_queue`).

# `std::stack` &amp; `std::queue`

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
#include <stack>
#include <string>

bool balanced(const std::string& s) {
    std::stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') st.push(c);
        else {
            if (st.empty()) return false;
            char open = st.top();
            st.pop();
            if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
        }
    }
    return st.empty();
}

int main() {
    std::cout << balanced("{[()]}") << balanced("([)]") << '\n';

    std::queue<std::string> q;                  // FIFO
    q.push("first"); q.push("second"); q.push("third");
    q.pop();
    std::cout << q.front() << ' ' << q.back() << ' ' << q.size() << '\n';
}
```

```text filename:Output
10
second third 2
```

| Adaptor | Operations | Default underlying container |
| --- | --- | --- |
| `stack<T>` | `push`, `pop`, `top`, `empty`, `size` | `deque<T>` |
| `queue<T>` | `push`, `pop`, `front`, `back`, `empty`, `size` | `deque<T>` |
| `priority_queue<T>` | `push`, `pop`, `top`, `empty`, `size` | `vector<T>` (binary heap) |

> [!WARNING] Watch out
>
> `pop()` returns `void` — read `top()`/`front()` first. Calling `top()`, `front()` or `pop()` on an empty adaptor is undefined behaviour. None of them are iterable.

# `std::priority_queue`

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <string>
#include <vector>

int main() {
    std::priority_queue<int> maxHeap;                                   // largest on top
    for (int x : {3, 1, 4, 1, 5}) maxHeap.push(x);
    std::cout << maxHeap.top() << ' ';
    maxHeap.pop();
    std::cout << maxHeap.top() << '\n';

    std::priority_queue<int, std::vector<int>, std::greater<int>> minHeap{std::greater<int>(), {3, 1, 4}};
    std::cout << minHeap.top() << '\n';                                 // smallest on top

    using Task = std::pair<int, std::string>;                           // (priority, name)
    auto cmp = [](const Task& a, const Task& b) { return a.first > b.first; };   // lower number = more urgent
    std::priority_queue<Task, std::vector<Task>, decltype(cmp)> tasks(cmp);
    tasks.push({2, "email"}); tasks.push({1, "outage"}); tasks.push({3, "lunch"});
    while (!tasks.empty()) { std::cout << tasks.top().second << ' '; tasks.pop(); }
    std::cout << '\n';
}
```

```text filename:Output
5 4
1
outage email lunch
```

> [!NOTE] Comparator direction
>
> The comparator says “`a` has <em>lower</em> priority than `b`” — so `std::less` (default) gives a max-heap and `std::greater` a min-heap. It's the reverse of what you'd expect from sorting.

# Top-k with a heap

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
int main() {
    std::vector<int> scores{50, 90, 20, 70, 85, 60};
    std::priority_queue<int, std::vector<int>, std::greater<int>> top3;   // min-heap of size k
    for (int s : scores) {
        top3.push(s);
        if (top3.size() > 3) top3.pop();       // drop the smallest: O(n log k)
    }
    while (!top3.empty()) { std::cout << top3.top() << ' '; top3.pop(); }
    std::cout << '\n';
}
```

```text filename:Output
70 85 90
```

```question
How is priority\_queue implemented?

---

As a binary heap stored in a `std::vector`, using `std::push_heap`/`std::pop_heap`: `top` is O(1), `push` and `pop` are O(log n), and building from n elements is O(n). It has no decrease-key; Dijkstra implementations push duplicates and skip stale entries instead.
```
