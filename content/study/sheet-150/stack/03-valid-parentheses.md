---
id: d50034f6-c282-745a-9114-df42e907ad14
key: problem:sheet-150/lc-20
subject: sheet-150
topic: stack
title: Valid Parentheses
slug: valid-parentheses
order: 3
---

Difficulty: <strong>Easy</strong> · [LeetCode 20](https://leetcode.com/problems/valid-parentheses/)

# Problem

Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.

# Understanding the problem

Brackets must close in exact LIFO (last-in, first-out) order.

# Intuition

Push opening brackets onto a stack. When encountering a closing bracket, pop the stack top and verify it matches the expected opening pair.

# Approach

1. Use empty list `stack` and dictionary `pairs = {')': '(', ']': '[', '}': '{'}`.
2. For each char: if opening bracket `'([{'`, push to stack.
3. Else (closing bracket): return `False` if stack is empty or `stack.pop() != pairs[char]`.
4. Return `True` if stack is completely empty at the end.

# Naive Solution — Brute Force

Repeatedly scan string and remove matching adjacent pairs `'()'`, `'[]'`, `'{}'` using string replacement.

```python filename:Python
class Solution:
    def isValid(self, s):
        changed = True

        while changed:
            changed = False

            for pair in ["()", "[]", "{}"]:
                if pair in s:
                    s = s.replace(pair, "")
                    changed = True

        return len(s) == 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isValid(string s) {
        bool changed = true;
        while (changed) {
            changed = false;
            for (string pair : {"()", "[]", "{}"}) {
                if (s.find(pair) != string::npos) {
                    s = replaceAll(s, pair);
                    changed = true;
                }
            }
        }
        return s.empty();
    }

private:
    string replaceAll(const string& s, const string& pair) {
        string out;
        for (size_t i = 0; i < s.size(); ) {
            if (s.compare(i, 2, pair) == 0) i += 2;
            else out += s[i++];
        }
        return out;
    }
};
```

```java filename:Java
class Solution {
    public boolean isValid(String s) {
        boolean changed = true;
        while (changed) {
            changed = false;
            for (String pair : new String[]{"()", "[]", "{}"}) {
                if (s.contains(pair)) {
                    s = s.replace(pair, "");
                    changed = true;
                }
            }
        }
        return s.isEmpty();
    }
}
```

```javascript filename:JavaScript
var isValid = function(s) {
    let changed = true;
    while (changed) {
        changed = false;
        for (const pair of ["()", "[]", "{}"]) {
            if (s.includes(pair)) {
                s = s.split(pair).join("");
                changed = true;
            }
        }
    }
    return s.length === 0;
};
```

<strong>Time: O(n²) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isValid(self, s):
        stack = []

        pairs = {
            ")": "(",
            "]": "[",
            "}": "{"
        }

        for char in s:
            if char in "([{":
                stack.append(char)

            else:
                if not stack:
                    return False

                if stack.pop() != pairs[char]:
                    return False

        return not stack
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isValid(string s) {
        stack<char> st;
        unordered_map<char, char> pairs = {{')', '('}, {']', '['}, {'}', '{'}};
        for (char c : s) {
            if (c == '(' || c == '[' || c == '{') {
                st.push(c);
            } else {
                if (st.empty()) return false;
                char top = st.top();
                st.pop();
                if (top != pairs[c]) return false;
            }
        }
        return st.empty();
    }
};
```

```java filename:Java
class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push(c);
            } else {
                if (stack.isEmpty()) return false;
                if (!stack.pop().equals(pairs.get(c))) return false;
            }
        }
        return stack.isEmpty();
    }
}
```

```javascript filename:JavaScript
var isValid = function(s) {
    const stack = [];
    const pairs = { ")": "(", "]": "[", "}": "{" };
    for (const c of s) {
        if ("([{".includes(c)) {
            stack.push(c);
        } else {
            if (!stack.length) return false;
            if (stack.pop() !== pairs[c]) return false;
        }
    }
    return stack.length === 0;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern</strong> — Opening bracket → push; Closing bracket → pop &amp; compare with stack top
