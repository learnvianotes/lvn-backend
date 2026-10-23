---
id: a103f36f-0856-73a9-9fed-aa03371eddf3
key: problem:sheet-150/lc-17
subject: sheet-150
topic: backtracking
title: Letter Combinations of a Phone Number
slug: letter-combinations-of-a-phone-number
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 17](https://leetcode.com/problems/letter-combinations-of-a-phone-number/)

# Problem

Given digits 2–9, generate all possible letter combinations. Example for `"23"`: `ad, ae, af, bd, be, bf, cd, ce, cf`.

# Understanding the problem

Each digit gives at most 4 choices. For n digits, total combinations is O(4^n).

# Intuition

Use a list of mappings and construct the string directly with index offsets (`ord(digits[index]) - ord('0')`).

# Approach

1. Return `[]` if `digits` is empty.
2. Initialize array `phone` indexed from 0 to 9.
3. Define `backtrack(index, current)`.
4. If `index == len(digits)`, append `"".join(current)` to `result`.
5. Get mapped string using `phone[ord(digits[index]) - ord('0')]`.
6. Loop through characters, append, recurse `index + 1`, and pop.

# Naive Solution

Build all combinations using recursion with a dictionary lookup for key mapping.

```python filename:Python
class Solution:
    def letterCombinations(self, digits):
        if not digits:
            return []

        phone = {
            '2': 'abc',
            '3': 'def',
            '4': 'ghi',
            '5': 'jkl',
            '6': 'mno',
            '7': 'pqrs',
            '8': 'tuv',
            '9': 'wxyz'
        }

        result = []

        def backtrack(index, current):
            if index == len(digits):
                result.append("".join(current))
                return

            for char in phone[digits[index]]:
                current.append(char)
                backtrack(index + 1, current)
                current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> letterCombinations(string digits) {
        if (digits.empty()) return {};

        unordered_map<char, string> phone = {
            {'2', "abc"}, {'3', "def"}, {'4', "ghi"}, {'5', "jkl"},
            {'6', "mno"}, {'7', "pqrs"}, {'8', "tuv"}, {'9', "wxyz"}
        };

        vector<string> result;
        string current;
        backtrack(digits, 0, phone, current, result);
        return result;
    }

private:
    void backtrack(const string& digits, int index, unordered_map<char, string>& phone,
                   string& current, vector<string>& result) {
        if (index == (int)digits.size()) {
            result.push_back(current);
            return;
        }

        for (char ch : phone[digits[index]]) {
            current.push_back(ch);
            backtrack(digits, index + 1, phone, current, result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    public List<String> letterCombinations(String digits) {
        List<String> result = new ArrayList<>();
        if (digits.isEmpty()) return result;

        Map<Character, String> phone = Map.of(
            '2', "abc", '3', "def", '4', "ghi", '5', "jkl",
            '6', "mno", '7', "pqrs", '8', "tuv", '9', "wxyz"
        );

        backtrack(digits, 0, phone, new StringBuilder(), result);
        return result;
    }

    private void backtrack(String digits, int index, Map<Character, String> phone,
                           StringBuilder current, List<String> result) {
        if (index == digits.length()) {
            result.add(current.toString());
            return;
        }

        for (char ch : phone.get(digits.charAt(index)).toCharArray()) {
            current.append(ch);
            backtrack(digits, index + 1, phone, current, result);
            current.deleteCharAt(current.length() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var letterCombinations = function(digits) {
    if (!digits) return [];

    const phone = {
        '2': 'abc',
        '3': 'def',
        '4': 'ghi',
        '5': 'jkl',
        '6': 'mno',
        '7': 'pqrs',
        '8': 'tuv',
        '9': 'wxyz'
    };

    const result = [];

    const backtrack = (index, current) => {
        if (index === digits.length) {
            result.push(current.join(''));
            return;
        }

        for (const ch of phone[digits[index]]) {
            current.push(ch);
            backtrack(index + 1, current);
            current.pop();
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(4^n × n) · Aux Space: O(n) · Output Space: O(4^n × n)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def letterCombinations(self, digits):
        if not digits:
            return []

        phone = [
            "",
            "",
            "abc",
            "def",
            "ghi",
            "jkl",
            "mno",
            "pqrs",
            "tuv",
            "wxyz"
        ]

        result = []

        def backtrack(index, current):
            if index == len(digits):
                result.append("".join(current))
                return

            letters = phone[ord(digits[index]) - ord('0')]

            for char in letters:
                current.append(char)
                backtrack(index + 1, current)
                current.pop()

        backtrack(0, [])
        return result
```

```cpp filename:C%2B%2B
class Solution {
    const vector<string> phone = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"
    };

public:
    vector<string> letterCombinations(string digits) {
        if (digits.empty()) return {};

        vector<string> result;
        string current;
        backtrack(digits, 0, current, result);
        return result;
    }

private:
    void backtrack(const string& digits, int index, string& current, vector<string>& result) {
        if (index == (int)digits.size()) {
            result.push_back(current);
            return;
        }

        const string& letters = phone[digits[index] - '0'];

        for (char ch : letters) {
            current.push_back(ch);
            backtrack(digits, index + 1, current, result);
            current.pop_back();
        }
    }
};
```

```java filename:Java
class Solution {
    private static final String[] PHONE = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"
    };

    public List<String> letterCombinations(String digits) {
        List<String> result = new ArrayList<>();
        if (digits.isEmpty()) return result;

        backtrack(digits, 0, new StringBuilder(), result);
        return result;
    }

    private void backtrack(String digits, int index, StringBuilder current, List<String> result) {
        if (index == digits.length()) {
            result.add(current.toString());
            return;
        }

        String letters = PHONE[digits.charAt(index) - '0'];

        for (char ch : letters.toCharArray()) {
            current.append(ch);
            backtrack(digits, index + 1, current, result);
            current.deleteCharAt(current.length() - 1);
        }
    }
}
```

```javascript filename:JavaScript
var letterCombinations = function(digits) {
    if (!digits) return [];

    const phone = [
        "",
        "",
        "abc",
        "def",
        "ghi",
        "jkl",
        "mno",
        "pqrs",
        "tuv",
        "wxyz"
    ];

    const result = [];

    const backtrack = (index, current) => {
        if (index === digits.length) {
            result.push(current.join(''));
            return;
        }

        const letters = phone[digits.charCodeAt(index) - 48];  // '0' is char code 48

        for (const ch of letters) {
            current.push(ch);
            backtrack(index + 1, current);
            current.pop();
        }
    };

    backtrack(0, []);
    return result;
};
```

<strong>Time: O(4^n × n) · Aux Space: O(n) · Output Space: O(4^n × n)</strong>

# Takeaway

Again, the asymptotic complexity doesn't change much; the optimization is primarily cleaner/faster implementation.
