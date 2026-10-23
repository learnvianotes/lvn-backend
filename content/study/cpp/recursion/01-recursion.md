---
id: 277d117b-a86f-7ca0-87b8-1d92ae05000a
key: topic:cpp/recursion
subject: cpp
topic: recursion
title: Recursion
slug: recursion
order: 1
---

A recursive function calls itself on a smaller input until it reaches a base case. Every call gets its own stack frame.

# Anatomy

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

long long factorial(int n) {
    if (n <= 1) return 1;              // base case
    return n * factorial(n - 1);       // recursive case: smaller problem
}

int power(int b, int e) {              // fast exponentiation: O(log e)
    if (e == 0) return 1;
    int half = power(b, e / 2);
    return e % 2 ? half * half * b : half * half;
}

bool isPalindrome(const std::string& s, int l, int r) {
    if (l >= r) return true;
    return s[l] == s[r] && isPalindrome(s, l + 1, r - 1);
}

int main() {
    std::cout << factorial(20) << '\n';
    std::cout << power(3, 13) << '\n';
    std::cout << isPalindrome("racecar", 0, 6) << isPalindrome("rocket", 0, 5) << '\n';
}
```

```text filename:Output
2432902008176640000
1594323
10
```

# Backtracking: generate all subsets

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

void subsets(const std::vector<int>& nums, std::size_t i, std::vector<int>& cur) {
    if (i == nums.size()) {
        std::cout << '{';
        for (int x : cur) std::cout << x;
        std::cout << "} ";
        return;
    }
    subsets(nums, i + 1, cur);          // exclude nums[i]
    cur.push_back(nums[i]);             // include nums[i]
    subsets(nums, i + 1, cur);
    cur.pop_back();                     // undo (backtrack)
}

int main() {
    std::vector<int> cur;
    subsets({1, 2, 3}, 0, cur);
    std::cout << '\n';
}
```

```text filename:Output
{} {3} {2} {23} {1} {13} {12} {123}
```

# Memoisation

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

long long fib(int n, std::vector<long long>& memo) {
    if (n < 2) return n;
    if (memo[n] != -1) return memo[n];          // already computed
    return memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
}

int main() {
    std::vector<long long> memo(91, -1);
    std::cout << fib(90, memo) << '\n';          // instant; naive recursion would take ages
}
```

```text filename:Output
2880067194370816120
```

> [!WARNING] Watch out
>
> Deep recursion overflows the stack (default \~1–8 MB): a recursive DFS on a 10⁶-node path graph will crash. Convert to an explicit stack/loop when depth can be large.

|  | Recursion | Iteration |
| --- | --- | --- |
| Readability | Natural for trees, divide &amp; conquer, backtracking | Natural for linear scans |
| Memory | O(depth) stack frames | O(1) extra (or an explicit stack) |
| Risk | Stack overflow | — |

```question
Does C++ guarantee tail-call optimisation?

---

No. Compilers often turn tail calls into jumps at `-O2`, but the standard doesn't require it and destructors of locals can prevent it. Don't rely on it for unbounded recursion depth.
```
