---
id: cec69b52-08d5-7521-abe2-39bdd69edb79
key: problem:sheet-150/lc-10
subject: sheet-150
topic: dp-2d
title: Regular Expression Matching
slug: regular-expression-matching
order: 1
---

Difficulty: <strong>Hard</strong> · [LeetCode 10](https://leetcode.com/problems/regular-expression-matching/)

# Problem

Given input string `s` and pattern `p`, implement regex matching with `'.'` (matches any single char) and `'*'` (matches zero or more of preceding element).

# Understanding the problem

Recursive branching occurs whenever `*` appears in pattern. State is represented by pair of indices `(i, j)` for `s` and `p`.

# Intuition

Cache recursive subproblems with hash table `memo[(i, j)]` storing boolean results for matching `s[i:]` and `p[j:]`.

# Approach

1. Initialize `memo = {}`.
2. In `dfs(i, j)`: check if `(i, j)` in `memo`. If `j == len(p)` return `i == len(s)`.
3. Check `first_match = i < len(s) and (p[j] == s[i] or p[j] == '.')`.
4. If `j + 1 < len(p) and p[j+1] == '*'`: set `answer = dfs(i, j+2) or (first_match and dfs(i+1, j))`.
5. Else: set `answer = first_match and dfs(i+1, j+1)`.
6. Store `memo[(i, j)] = answer` and return.

# Naive Solution — Recursion

Recursive branching when `*` appears in pattern.

```python filename:Python
class Solution:
    def isMatch(self, s, p):

        def dfs(i, j):

            if j == len(p):
                return i == len(s)

            first_match = (
                i < len(s)
                and (
                    p[j] == s[i]
                    or p[j] == "."
                )
            )

            if (
                j + 1 < len(p)
                and p[j + 1] == "*"
            ):
                return (
                    dfs(i, j + 2)
                    or
                    (
                        first_match
                        and dfs(i + 1, j)
                    )
                )

            return (
                first_match
                and dfs(i + 1, j + 1)
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isMatch(string s, string p) {
        return dfs(s, p, 0, 0);
    }

private:
    bool dfs(const string& s, const string& p, int i, int j) {
        if (j == (int)p.size()) return i == (int)s.size();

        bool firstMatch = i < (int)s.size() && (p[j] == s[i] || p[j] == '.');

        if (j + 1 < (int)p.size() && p[j + 1] == '*') {
            return dfs(s, p, i, j + 2) || (firstMatch && dfs(s, p, i + 1, j));
        }

        return firstMatch && dfs(s, p, i + 1, j + 1);
    }
};
```

```java filename:Java
class Solution {
    public boolean isMatch(String s, String p) {
        return dfs(s, p, 0, 0);
    }

    private boolean dfs(String s, String p, int i, int j) {
        if (j == p.length()) return i == s.length();

        boolean firstMatch = i < s.length()
            && (p.charAt(j) == s.charAt(i) || p.charAt(j) == '.');

        if (j + 1 < p.length() && p.charAt(j + 1) == '*') {
            return dfs(s, p, i, j + 2) || (firstMatch && dfs(s, p, i + 1, j));
        }

        return firstMatch && dfs(s, p, i + 1, j + 1);
    }
}
```

```javascript filename:JavaScript
var isMatch = function(s, p) {
    const dfs = (i, j) => {
        if (j === p.length) return i === s.length;

        const firstMatch = i < s.length && (p[j] === s[i] || p[j] === ".");

        if (j + 1 < p.length && p[j + 1] === "*") {
            return dfs(i, j + 2) || (firstMatch && dfs(i + 1, j));
        }

        return firstMatch && dfs(i + 1, j + 1);
    };

    return dfs(0, 0);
};
```

<strong>Time: Exponential · Aux Space: O(m+n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isMatch(self, s, p):

        memo = {}

        def dfs(i, j):

            if (i, j) in memo:
                return memo[(i, j)]

            if j == len(p):
                return i == len(s)

            first_match = (
                i < len(s)
                and (
                    p[j] == s[i]
                    or p[j] == "."
                )
            )

            if (
                j + 1 < len(p)
                and p[j + 1] == "*"
            ):
                answer = (
                    dfs(i, j + 2)
                    or
                    (
                        first_match
                        and dfs(i + 1, j)
                    )
                )

            else:
                answer = (
                    first_match
                    and dfs(i + 1, j + 1)
                )

            memo[(i, j)] = answer
            return answer

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isMatch(string s, string p) {
        // memo[i][j]: -1 = not computed, 0 = false, 1 = true
        memo.assign(s.size() + 1, vector<int>(p.size() + 1, -1));
        return dfs(s, p, 0, 0);
    }

private:
    vector<vector<int>> memo;

    bool dfs(const string& s, const string& p, int i, int j) {
        if (memo[i][j] != -1) return memo[i][j];

        if (j == (int)p.size()) return i == (int)s.size();

        bool firstMatch = i < (int)s.size() && (p[j] == s[i] || p[j] == '.');
        bool answer;

        if (j + 1 < (int)p.size() && p[j + 1] == '*') {
            answer = dfs(s, p, i, j + 2) || (firstMatch && dfs(s, p, i + 1, j));
        } else {
            answer = firstMatch && dfs(s, p, i + 1, j + 1);
        }

        memo[i][j] = answer;
        return answer;
    }
};
```

```java filename:Java
class Solution {
    // memo[i][j]: null = not computed yet
    private Boolean[][] memo;

    public boolean isMatch(String s, String p) {
        memo = new Boolean[s.length() + 1][p.length() + 1];
        return dfs(s, p, 0, 0);
    }

    private boolean dfs(String s, String p, int i, int j) {
        if (memo[i][j] != null) return memo[i][j];

        if (j == p.length()) return i == s.length();

        boolean firstMatch = i < s.length()
            && (p.charAt(j) == s.charAt(i) || p.charAt(j) == '.');
        boolean answer;

        if (j + 1 < p.length() && p.charAt(j + 1) == '*') {
            answer = dfs(s, p, i, j + 2) || (firstMatch && dfs(s, p, i + 1, j));
        } else {
            answer = firstMatch && dfs(s, p, i + 1, j + 1);
        }

        memo[i][j] = answer;
        return answer;
    }
}
```

```javascript filename:JavaScript
var isMatch = function(s, p) {
    const memo = new Map();

    const dfs = (i, j) => {
        const key = `${i},${j}`;
        if (memo.has(key)) return memo.get(key);

        if (j === p.length) return i === s.length;

        const firstMatch = i < s.length && (p[j] === s[i] || p[j] === ".");
        let answer;

        if (j + 1 < p.length && p[j + 1] === "*") {
            answer = dfs(i, j + 2) || (firstMatch && dfs(i + 1, j));
        } else {
            answer = firstMatch && dfs(i + 1, j + 1);
        }

        memo.set(key, answer);
        return answer;
    };

    return dfs(0, 0);
};
```

<strong>Time: O(mn) · Space: O(mn)</strong>

# Takeaway

<strong>2D State DP / DFS + Memoization</strong> — Handles wildcard matching by memoizing `(i, j)` states across recursive branches.
