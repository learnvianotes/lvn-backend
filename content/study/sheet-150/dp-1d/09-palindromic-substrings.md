---
id: 43a5082b-030f-71e1-a446-8c44876d3efc
key: problem:sheet-150/lc-647
subject: sheet-150
topic: dp-1d
title: Palindromic Substrings
slug: palindromic-substrings
order: 9
---

Difficulty: <strong>Medium</strong> · [LeetCode 647](https://leetcode.com/problems/palindromic-substrings/)

# Problem

Given a string `s`, return the number of palindromic substrings in it.

# Understanding the problem

Every palindrome expands outward around a center. Single characters and pairs of characters serve as centers.

# Intuition

Expand outward from each index `i` (odd) and pair `(i, i+1)` (even), incrementing count for each matching expansion.

# Approach

1. Helper `expand(left, right)` increments `count` while `s[left] == s[right]`.
2. For each index `i`, call `expand(i, i)` and `expand(i, i+1)`.
3. Return total `count`.

# Naive Solution — Brute Force

Check every substring to see if it is a palindrome.

```python filename:Python
class Solution:
    def countSubstrings(self, s):

        def is_palindrome(left, right):
            while left < right:
                if s[left] != s[right]:
                    return False

                left += 1
                right -= 1

            return True

        count = 0

        for i in range(len(s)):
            for j in range(i, len(s)):
                if is_palindrome(i, j):
                    count += 1

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int countSubstrings(string s) {
        int count = 0;

        for (int i = 0; i < (int)s.size(); i++) {
            for (int j = i; j < (int)s.size(); j++) {
                if (isPalindrome(s, i, j)) count++;
            }
        }

        return count;
    }

private:
    bool isPalindrome(const string& s, int left, int right) {
        while (left < right) {
            if (s[left] != s[right]) return false;
            left++;
            right--;
        }
        return true;
    }
};
```

```java filename:Java
class Solution {
    public int countSubstrings(String s) {
        int count = 0;

        for (int i = 0; i < s.length(); i++) {
            for (int j = i; j < s.length(); j++) {
                if (isPalindrome(s, i, j)) count++;
            }
        }

        return count;
    }

    private boolean isPalindrome(String s, int left, int right) {
        while (left < right) {
            if (s.charAt(left) != s.charAt(right)) return false;
            left++;
            right--;
        }
        return true;
    }
}
```

```javascript filename:JavaScript
var countSubstrings = function(s) {
    const isPalindrome = (left, right) => {
        while (left < right) {
            if (s[left] !== s[right]) return false;
            left++;
            right--;
        }
        return true;
    };

    let count = 0;

    for (let i = 0; i < s.length; i++) {
        for (let j = i; j < s.length; j++) {
            if (isPalindrome(i, j)) count++;
        }
    }

    return count;
};
```

<strong>Time: O(n³) · Aux Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def countSubstrings(self, s):

        count = 0

        def expand(left, right):
            nonlocal count

            while (
                left >= 0
                and right < len(s)
                and s[left] == s[right]
            ):
                count += 1
                left -= 1
                right += 1

        for i in range(len(s)):
            expand(i, i)
            expand(i, i + 1)

        return count
```

```cpp filename:C%2B%2B
class Solution {
public:
    int countSubstrings(string s) {
        int count = 0;

        for (int i = 0; i < (int)s.size(); i++) {
            expand(s, i, i, count);
            expand(s, i, i + 1, count);
        }

        return count;
    }

private:
    void expand(const string& s, int left, int right, int& count) {
        while (left >= 0 && right < (int)s.size() && s[left] == s[right]) {
            count++;
            left--;
            right++;
        }
    }
};
```

```java filename:Java
class Solution {
    private int count = 0;

    public int countSubstrings(String s) {
        count = 0;

        for (int i = 0; i < s.length(); i++) {
            expand(s, i, i);
            expand(s, i, i + 1);
        }

        return count;
    }

    private void expand(String s, int left, int right) {
        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
            count++;
            left--;
            right++;
        }
    }
}
```

```javascript filename:JavaScript
var countSubstrings = function(s) {
    let count = 0;

    const expand = (left, right) => {
        while (left >= 0 && right < s.length && s[left] === s[right]) {
            count++;
            left--;
            right++;
        }
    };

    for (let i = 0; i < s.length; i++) {
        expand(i, i);
        expand(i, i + 1);
    }

    return count;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>
