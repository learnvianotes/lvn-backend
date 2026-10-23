---
id: 71a46aee-0bf8-729a-8f8c-66d517575621
key: problem:sheet-150/lc-125
subject: sheet-150
topic: two-pointers
title: Valid Palindrome
slug: valid-palindrome
order: 2
---

Difficulty: <strong>Easy</strong> · [LeetCode 125](https://leetcode.com/problems/valid-palindrome/)

# Problem

Determine if a string is a palindrome considering only alphanumeric characters and ignoring cases.

# Understanding the problem

Ignore spaces and punctuation; check if string equals its reverse.

# Intuition

Use two pointers converging inward from left and right ends, skipping non-alphanumeric characters in O(1) space.

# Approach

1. Initialize `left = 0`, `right = len(s) - 1`.
2. Advance `left` while not `s[left].isalnum()`.
3. Decrement `right` while not `s[right].isalnum()`.
4. Compare lowercased characters. If match, move both pointers inward.

# Naive Solution — Brute Force

Filter alphanumeric characters into a new string and reverse it.

```python filename:Python
class Solution:
    def isPalindrome(self, s):
        cleaned = ""

        for char in s:
            if char.isalnum():
                cleaned += char.lower()

        return cleaned == cleaned[::-1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isPalindrome(string s) {
        string cleaned;
        for (char c : s)
            if (isalnum((unsigned char)c)) cleaned += tolower((unsigned char)c);
        return cleaned == string(cleaned.rbegin(), cleaned.rend());
    }
};
```

```java filename:Java
class Solution {
    public boolean isPalindrome(String s) {
        StringBuilder cleaned = new StringBuilder();
        for (char c : s.toCharArray())
            if (Character.isLetterOrDigit(c)) cleaned.append(Character.toLowerCase(c));
        String str = cleaned.toString();
        return str.equals(cleaned.reverse().toString());
    }
}
```

```javascript filename:JavaScript
var isPalindrome = function(s) {
    let cleaned = "";
    for (const c of s)
        if (/[a-z0-9]/i.test(c)) cleaned += c.toLowerCase();
    return cleaned === cleaned.split("").reverse().join("");
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def isPalindrome(self, s):
        left = 0
        right = len(s) - 1

        while left < right:

            while left < right and not s[left].isalnum():
                left += 1

            while left < right and not s[right].isalnum():
                right -= 1

            if s[left].lower() != s[right].lower():
                return False

            left += 1
            right -= 1

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isPalindrome(string s) {
        int left = 0, right = s.size() - 1;
        while (left < right) {
            while (left < right && !isalnum((unsigned char)s[left])) left++;
            while (left < right && !isalnum((unsigned char)s[right])) right--;
            if (tolower((unsigned char)s[left]) != tolower((unsigned char)s[right]))
                return false;
            left++;
            right--;
        }
        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isPalindrome(String s) {
        int left = 0, right = s.length() - 1;
        while (left < right) {
            while (left < right && !Character.isLetterOrDigit(s.charAt(left))) left++;
            while (left < right && !Character.isLetterOrDigit(s.charAt(right))) right--;
            if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right)))
                return false;
            left++;
            right--;
        }
        return true;
    }
}
```

```javascript filename:JavaScript
var isPalindrome = function(s) {
    const isAlnum = c => /[a-z0-9]/i.test(c);
    let left = 0, right = s.length - 1;
    while (left < right) {
        while (left < right && !isAlnum(s[left])) left++;
        while (left < right && !isAlnum(s[right])) right--;
        if (s[left].toLowerCase() !== s[right].toLowerCase()) return false;
        left++;
        right--;
    }
    return true;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Inward converging Two Pointers
