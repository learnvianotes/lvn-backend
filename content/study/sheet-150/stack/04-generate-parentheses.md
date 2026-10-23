---
id: 3c2659aa-4ca6-7ab5-9d86-10a40d67c7a3
key: problem:sheet-150/lc-22
subject: sheet-150
topic: stack
title: Generate Parentheses
slug: generate-parentheses
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 22](https://leetcode.com/problems/generate-parentheses/)

# Problem

Given `n` pairs of parentheses, write a function to generate all combinations of well-formed parentheses.

# Understanding the problem

Generate valid strings of length $2n$ where open count $\\le n$ and close count $\\le$ open count at all steps.

# Intuition

Backtracking with constraints: only add `'('` if `open_count < n`; only add `')'` if `close_count < open_count`. Prunes invalid branches early.

# Approach

1. Recursive helper `backtrack(current, open_count, close_count)`.
2. Base Case: `len(current) == 2 * n`, append to `result`.
3. Branch 1: If `open_count < n`, recurse with `'('`.
4. Branch 2: If `close_count < open_count`, recurse with `')'`.
5. Number of valid strings is given by the $n$th Catalan number $C\_n = \\frac{1}{n+1}\\binom{2n}{n}$.

# Naive Solution — Brute Force

Generate all $2^{2n}$ possible bracket strings recursively and validate each using a balance counter.

```python filename:Python
class Solution:
    def generateParenthesis(self, n):

        result = []

        def valid(s):
            balance = 0

            for char in s:
                if char == "(":
                    balance += 1
                else:
                    balance -= 1

                if balance < 0:
                    return False

            return balance == 0

        def generate(s):
            if len(s) == 2 * n:
                if valid(s):
                    result.append(s)
                return

            generate(s + "(")
            generate(s + ")")

        generate("")

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> generateParenthesis(int n) {
        vector<string> result;
        generate("", n, result);
        return result;
    }

private:
    bool valid(const string& s) {
        int balance = 0;
        for (char c : s) {
            if (c == '(') balance++;
            else balance--;
            if (balance < 0) return false;
        }
        return balance == 0;
    }

    void generate(const string& s, int n, vector<string>& result) {
        if (s.size() == 2 * n) {
            if (valid(s)) result.push_back(s);
            return;
        }
        generate(s + "(", n, result);
        generate(s + ")", n, result);
    }
};
```

```java filename:Java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList<>();
        generate("", n, result);
        return result;
    }

    private boolean valid(String s) {
        int balance = 0;
        for (char c : s.toCharArray()) {
            if (c == '(') balance++;
            else balance--;
            if (balance < 0) return false;
        }
        return balance == 0;
    }

    private void generate(String s, int n, List<String> result) {
        if (s.length() == 2 * n) {
            if (valid(s)) result.add(s);
            return;
        }
        generate(s + "(", n, result);
        generate(s + ")", n, result);
    }
}
```

```javascript filename:JavaScript
var generateParenthesis = function(n) {
    const result = [];
    const valid = s => {
        let balance = 0;
        for (const c of s) {
            if (c === "(") balance++;
            else balance--;
            if (balance < 0) return false;
        }
        return balance === 0;
    };
    const generate = s => {
        if (s.length === 2 * n) {
            if (valid(s)) result.push(s);
            return;
        }
        generate(s + "(");
        generate(s + ")");
    };
    generate("");
    return result;
};
```

<strong>Time: O(2^(2n) × n) · Space: O(n) recursion</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def generateParenthesis(self, n):

        result = []

        def backtrack(current, open_count, close_count):

            if len(current) == 2 * n:
                result.append(current)
                return

            if open_count < n:
                backtrack(
                    current + "(",
                    open_count + 1,
                    close_count
                )

            if close_count < open_count:
                backtrack(
                    current + ")",
                    open_count,
                    close_count + 1
                )

        backtrack("", 0, 0)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> generateParenthesis(int n) {
        vector<string> result;
        backtrack("", 0, 0, n, result);
        return result;
    }

private:
    void backtrack(const string& current, int openCount, int closeCount, int n, vector<string>& result) {
        if (current.size() == 2 * n) {
            result.push_back(current);
            return;
        }
        if (openCount < n) backtrack(current + "(", openCount + 1, closeCount, n, result);
        if (closeCount < openCount) backtrack(current + ")", openCount, closeCount + 1, n, result);
    }
};
```

```java filename:Java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList<>();
        backtrack("", 0, 0, n, result);
        return result;
    }

    private void backtrack(String current, int openCount, int closeCount, int n, List<String> result) {
        if (current.length() == 2 * n) {
            result.add(current);
            return;
        }
        if (openCount < n) backtrack(current + "(", openCount + 1, closeCount, n, result);
        if (closeCount < openCount) backtrack(current + ")", openCount, closeCount + 1, n, result);
    }
}
```

```javascript filename:JavaScript
var generateParenthesis = function(n) {
    const result = [];
    const backtrack = (current, openCount, closeCount) => {
        if (current.length === 2 * n) {
            result.push(current);
            return;
        }
        if (openCount < n) backtrack(current + "(", openCount + 1, closeCount);
        if (closeCount < openCount) backtrack(current + ")", openCount, closeCount + 1);
    };
    backtrack("", 0, 0);
    return result;
};
```

<strong>Time: O(C(n) × n) · Space: O(n) recursion</strong>

# Takeaway

<strong>Pattern</strong> — Backtracking with constraints (prune impossible branches)
