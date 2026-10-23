---
id: 8cc2efdc-31e7-7d4c-b828-56905f027251
key: problem:sheet-150/lc-678
subject: sheet-150
topic: greedy
title: Valid Parenthesis String
slug: valid-parenthesis-string
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 678](https://leetcode.com/problems/valid-parenthesis-string/)

# Problem

Given string `s` containing `'('`, `')'`, and `'*'` (where `'*'` can be `'('`, `')'`, or empty), return `True` if it is valid.

# Understanding the problem

Instead of branching on every `'*'`, track the <em>range</em> of possible open-parenthesis balances: `[low, high]`. `high < 0` means even the most optimistic interpretation is invalid. `low == 0` at the end means there's at least one valid interpretation.

# Intuition

Track a range `[low, high]` of possible open balances. `'('` increments both. `')'` decrements both. `'*'` shrinks `low` and grows `high`. If `high < 0`, definitely invalid. Clamp `low` at 0 (balance can't go below 0 in any valid string).

# Approach

1. Initialize `low = 0`, `high = 0`.
2. For each char in `s`:
3. `'('`: `low += 1; high += 1`.
4. `')'`: `low -= 1; high -= 1`.
5. `'*'`: `low -= 1; high += 1`.
6. If `high < 0`: return `False`.
7. Clamp: `low = max(low, 0)`.
8. Return `low == 0`.

# Naive Solution — Brute Force

Backtracking: try all three interpretations of each `'*'` recursively.

```python filename:Python
class Solution:
    def checkValidString(self, s):

        def dfs(index, balance):
            if balance < 0:
                return False

            if index == len(s):
                return balance == 0

            char = s[index]

            if char == "(":
                return dfs(index + 1, balance + 1)

            if char == ")":
                return dfs(index + 1, balance - 1)

            # Try '*' as '(', ')', or ''
            return (
                dfs(index + 1, balance + 1)
                or dfs(index + 1, balance - 1)
                or dfs(index + 1, balance)
            )

        return dfs(0, 0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool checkValidString(string s) {
        return dfs(s, 0, 0);
    }

private:
    bool dfs(const string& s, int index, int balance) {
        if (balance < 0) {
            return false;
        }

        if (index == (int)s.size()) {
            return balance == 0;
        }

        char c = s[index];

        if (c == '(') {
            return dfs(s, index + 1, balance + 1);
        }

        if (c == ')') {
            return dfs(s, index + 1, balance - 1);
        }

        // Try '*' as '(', ')', or ''
        return dfs(s, index + 1, balance + 1)
            || dfs(s, index + 1, balance - 1)
            || dfs(s, index + 1, balance);
    }
};
```

```java filename:Java
class Solution {
    public boolean checkValidString(String s) {
        return dfs(s, 0, 0);
    }

    private boolean dfs(String s, int index, int balance) {
        if (balance < 0) {
            return false;
        }

        if (index == s.length()) {
            return balance == 0;
        }

        char c = s.charAt(index);

        if (c == '(') {
            return dfs(s, index + 1, balance + 1);
        }

        if (c == ')') {
            return dfs(s, index + 1, balance - 1);
        }

        // Try '*' as '(', ')', or ''
        return dfs(s, index + 1, balance + 1)
            || dfs(s, index + 1, balance - 1)
            || dfs(s, index + 1, balance);
    }
}
```

```javascript filename:JavaScript
var checkValidString = function(s) {
    const dfs = (index, balance) => {
        if (balance < 0) {
            return false;
        }

        if (index === s.length) {
            return balance === 0;
        }

        const char = s[index];

        if (char === "(") {
            return dfs(index + 1, balance + 1);
        }

        if (char === ")") {
            return dfs(index + 1, balance - 1);
        }

        // Try '*' as '(', ')', or ''
        return (
            dfs(index + 1, balance + 1) ||
            dfs(index + 1, balance - 1) ||
            dfs(index + 1, balance)
        );
    };

    return dfs(0, 0);
};
```

<strong>Time: O(3ⁿ) · Space: O(n) recursion</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def checkValidString(self, s):
        low = 0
        high = 0

        for char in s:
            if char == "(":
                low += 1
                high += 1

            elif char == ")":
                low -= 1
                high -= 1

            else:  # '*'
                low -= 1
                high += 1

            if high < 0:
                return False

            low = max(low, 0)

        return low == 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool checkValidString(string s) {
        int low = 0;
        int high = 0;

        for (char c : s) {
            if (c == '(') {
                low++;
                high++;
            } else if (c == ')') {
                low--;
                high--;
            } else {  // '*'
                low--;
                high++;
            }

            if (high < 0) {
                return false;
            }

            low = max(low, 0);
        }

        return low == 0;
    }
};
```

```java filename:Java
class Solution {
    public boolean checkValidString(String s) {
        int low = 0;
        int high = 0;

        for (char c : s.toCharArray()) {
            if (c == '(') {
                low++;
                high++;
            } else if (c == ')') {
                low--;
                high--;
            } else {  // '*'
                low--;
                high++;
            }

            if (high < 0) {
                return false;
            }

            low = Math.max(low, 0);
        }

        return low == 0;
    }
}
```

```javascript filename:JavaScript
var checkValidString = function(s) {
    let low = 0;
    let high = 0;

    for (const char of s) {
        if (char === "(") {
            low++;
            high++;
        } else if (char === ")") {
            low--;
            high--;
        } else {  // '*'
            low--;
            high++;
        }

        if (high < 0) {
            return false;
        }

        low = Math.max(low, 0);
    }

    return low === 0;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Balance Range \[low, high\] — track the window of possible states instead of every individual state
