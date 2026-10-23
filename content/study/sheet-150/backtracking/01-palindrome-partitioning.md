---
id: 5ef37197-3c6a-7009-9a9a-d82e3c8b68e4
key: problem:sheet-150/lc-131
subject: sheet-150
topic: backtracking
title: Palindrome Partitioning
slug: palindrome-partitioning
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 131](https://leetcode.com/problems/palindrome-partitioning/)

# Problem

Partition a string such that every substring is a palindrome. Example for `"aab"`: `["a", "a", "b"]`, `["aa", "b"]`.

# Understanding the problem

There can be exponentially many partitions. Checking substring palindromes on the fly adds repeated O(n) work.

# Intuition

Precompute whether every substring is a palindrome using 2D Dynamic Programming in O(n^2) time before backtracking.

# Approach

1. Build 2D boolean array `palindrome[n][n]`.
2. Set single characters `palindrome[i][i] = True`.
3. Fill DP table for lengths 2 to n: `palindrome[left][right] = True` if characters match and inner substring is palindrome.
4. Backtrack from `start = 0`, using `palindrome[start][end]` for O(1) checks.

# Naive Solution

At every position, try every possible substring and check whether it is a palindrome with `string == string[::-1]`.

```python filename:Python
class Solution:
    def partition(self, s):
        result = []

        def is_palindrome(string):
            return string == string[::-1]

        def backtrack(start, current):
            if start == len(s):
                result.append(current[:])
                return

            for end in range(start + 1, len(s) + 1):
                substring = s[start:end]

                if is_palindrome(substring):
                    current.append(substring)
                    backtrack(end, current)
                    current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<string>> partition(string s) {
        vector<vector<string>> result;
        vector<string> current;
        backtrack(s, 0, current, result);
        return result;
    }

private:
    bool isPalindrome(const string& str) {
        return str == string(str.rbegin(), str.rend());
    }

    void backtrack(const string& s, int start, vector<string>& current, vector<vector<string>>& result) {
        if (start == (int)s.size()) {
            result.push_back(current);
            return;
        }

        for (int end = start + 1; end <= (int)s.size(); end++) {
            string substring = s.substr(start, end - start);

            if (isPalindrome(substring)) {
                current.push_back(substring);
                backtrack(s, end, current, result);
                current.pop_back();
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> result = new ArrayList<>();
        backtrack(s, 0, new ArrayList<>(), result);
        return result;
    }

    private boolean isPalindrome(String str) {
        return str.equals(new StringBuilder(str).reverse().toString());
    }

    private void backtrack(String s, int start, List<String> current, List<List<String>> result) {
        if (start == s.length()) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int end = start + 1; end <= s.length(); end++) {
            String substring = s.substring(start, end);

            if (isPalindrome(substring)) {
                current.add(substring);
                backtrack(s, end, current, result);
                current.remove(current.size() - 1);
            }
        }
    }
}
```

```javascript filename:JavaScript
var partition = function(s) {
    const result = [];

    const isPalindrome = (str) => str === [...str].reverse().join('');

    const backtrack = (start, current) => {
        if (start === s.length) {
            result.push([...current]);
            return;
        }

        for (let end = start + 1; end <= s.length; end++) {
            const substring = s.slice(start, end);

            if (isPalindrome(substring)) {
                current.push(substring);
                backtrack(end, current);
                current.pop();
            }
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(n × 2^n) approximately · Aux Space: O(n) · Output Space: O(n × 2^n)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def partition(self, s):
        n = len(s)

        palindrome = [[False] * n for _ in range(n)]

        for i in range(n):
            palindrome[i][i] = True

        for length in range(2, n + 1):
            for left in range(n - length + 1):
                right = left + length - 1

                if s[left] == s[right]:
                    if length == 2 or palindrome[left + 1][right - 1]:
                        palindrome[left][right] = True

        result = []

        def backtrack(start, current):
            if start == n:
                result.append(current[:])
                return

            for end in range(start, n):
                if palindrome[start][end]:
                    current.append(s[start:end + 1])
                    backtrack(end + 1, current)
                    current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<string>> partition(string s) {
        int n = s.size();

        vector<vector<bool>> palindrome(n, vector<bool>(n, false));

        for (int i = 0; i < n; i++) palindrome[i][i] = true;

        for (int length = 2; length <= n; length++) {
            for (int left = 0; left <= n - length; left++) {
                int right = left + length - 1;

                if (s[left] == s[right]) {
                    if (length == 2 || palindrome[left + 1][right - 1]) {
                        palindrome[left][right] = true;
                    }
                }
            }
        }

        vector<vector<string>> result;
        vector<string> current;
        backtrack(s, 0, palindrome, current, result);
        return result;
    }

private:
    void backtrack(const string& s, int start, vector<vector<bool>>& palindrome,
                   vector<string>& current, vector<vector<string>>& result) {
        int n = s.size();

        if (start == n) {
            result.push_back(current);
            return;
        }

        for (int end = start; end < n; end++) {
            if (palindrome[start][end]) {
                current.push_back(s.substr(start, end - start + 1));
                backtrack(s, end + 1, palindrome, current, result);
                current.pop_back();
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<String>> partition(String s) {
        int n = s.length();

        boolean[][] palindrome = new boolean[n][n];

        for (int i = 0; i < n; i++) palindrome[i][i] = true;

        for (int length = 2; length <= n; length++) {
            for (int left = 0; left <= n - length; left++) {
                int right = left + length - 1;

                if (s.charAt(left) == s.charAt(right)) {
                    if (length == 2 || palindrome[left + 1][right - 1]) {
                        palindrome[left][right] = true;
                    }
                }
            }
        }

        List<List<String>> result = new ArrayList<>();
        backtrack(s, 0, palindrome, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(String s, int start, boolean[][] palindrome,
                           List<String> current, List<List<String>> result) {
        int n = s.length();

        if (start == n) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int end = start; end < n; end++) {
            if (palindrome[start][end]) {
                current.add(s.substring(start, end + 1));
                backtrack(s, end + 1, palindrome, current, result);
                current.remove(current.size() - 1);
            }
        }
    }
}
```

```javascript filename:JavaScript
var partition = function(s) {
    const n = s.length;

    const palindrome = Array.from({ length: n }, () => new Array(n).fill(false));

    for (let i = 0; i < n; i++) palindrome[i][i] = true;

    for (let length = 2; length <= n; length++) {
        for (let left = 0; left <= n - length; left++) {
            const right = left + length - 1;

            if (s[left] === s[right]) {
                if (length === 2 || palindrome[left + 1][right - 1]) {
                    palindrome[left][right] = true;
                }
            }
        }
    }

    const result = [];

    const backtrack = (start, current) => {
        if (start === n) {
            result.push([...current]);
            return;
        }

        for (let end = start; end < n; end++) {
            if (palindrome[start][end]) {
                current.push(s.slice(start, end + 1));
                backtrack(end + 1, current);
                current.pop();
            }
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Palindrome DP: O(n^2) · Time: O(n^2 + n × 2^n) · Aux Space: O(n^2) DP + O(n) recursion · Output Space: O(n × 2^n)</strong>

# Takeaway

Precompute expensive repeated checks → Backtracking becomes cleaner and faster.
