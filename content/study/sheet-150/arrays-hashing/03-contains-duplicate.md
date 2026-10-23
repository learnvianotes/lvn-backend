---
id: 0251b8d0-9455-77ed-ba87-16410a27c71a
key: problem:sheet-150/lc-217
subject: sheet-150
topic: arrays-hashing
title: Contains Duplicate
slug: contains-duplicate
order: 3
---

Difficulty: <strong>Easy</strong> · [LeetCode 217](https://leetcode.com/problems/contains-duplicate/)

# Problem

Given an integer array `nums`, return `true` if any value appears <strong>at least twice</strong>, and `false` if every element is distinct.

# Examples

Input

`nums: int[]`<br>1 ≤ n ≤ 10<sup>5</sup>, -10<sup>9</sup> ≤ nums\[i\] ≤ 10<sup>9</sup>

Output

`boolean` — true if duplicate exists

> [!NOTE]
>
> Example 1
>
> nums = \[1,2,3,1\]
>
> Output: true
>
> // 1 appears at index 0 and 3

> [!NOTE]
>
> Example 2
>
> nums = \[1,2,3,4\]
>
> Output: false

# Constraints

- `1 ≤ nums.length ≤ 10`<sup>`5`</sup>
- `-10`<sup>`9`</sup>` ≤ nums[i] ≤ 10`<sup>`9`</sup>

# Understanding the problem

Brute force compares every pair — O(n²). Key insight: we only need to know "have I seen this before?" → Hash Set gives O(1) lookup, making one linear pass sufficient.

# Intuition

"Have I seen this before?" → <strong>Hash Set</strong>. Store each number as we go; check the set before inserting. O(1) average lookup replaces O(n) inner scan.

# Approach

1. Initialize empty set `seen`.
2. For each `num`: if `num in seen` → return `True`.
3. Else add `num` to `seen`.
4. End of loop → return `False`.

# Naive Solution — O(n²) Brute Force

Check every pair `(i, j)` with `i < j`. Return true on first match.

> [!TIP] Expected Output
>
> \[1,2,3,1\] → true | \[1,2,3,4\] → false

```python filename:Python
class Solution:
    def containsDuplicate(self, nums: list[int]) -> bool:
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] == nums[j]:
                    return True
        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        for (int i = 0; i < nums.size(); ++i)
            for (int j = i+1; j < nums.size(); ++j)
                if (nums[i] == nums[j]) return true;
        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean containsDuplicate(int[] nums) {
        for (int i = 0; i < nums.length; ++i)
            for (int j = i+1; j < nums.length; ++j)
                if (nums[i] == nums[j]) return true;
        return false;
    }
}
```

```javascript filename:JavaScript
var containsDuplicate = function(nums) {
    for (let i = 0; i < nums.length; i++)
        for (let j = i+1; j < nums.length; j++)
            if (nums[i] === nums[j]) return true;
    return false;
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code — Hash Set O(n)

> [!TIP] Expected Output
>
> \[1,2,3,1\] → true | \[1,2,3,4\] → false | \[1,1,1,3\] → true

```python filename:Python
class Solution:
    def containsDuplicate(self, nums: list[int]) -> bool:
        seen = set()
        for num in nums:
            if num in seen:
                return True
            seen.add(num)
        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        unordered_set<int> seen;
        for (int num : nums) {
            if (seen.count(num)) return true;
            seen.insert(num);
        }
        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int num : nums)
            if (!seen.add(num)) return true;
        return false;
    }
}
```

```javascript filename:JavaScript
var containsDuplicate = function(nums) {
    const seen = new Set();
    for (const num of nums) {
        if (seen.has(num)) return true;
        seen.add(num);
    }
    return false;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Variants

> [!NOTE]
>
> Method 1 — Hash Set · O(n) / O(n) ✓ Recommended
>
> Build a hash set on-the-fly. O(1) lookup with early exit.

> [!NOTE]
>
> Method 2 — Sorting · O(n log n) / O(1)
>
> Sort in-place, check adjacent elements. Better space, worse time.

> [!NOTE]
>
> Method 3 — Python One-liner · O(n) / O(n)
>
> `return len(nums) != len(set(nums))` — No early exit though.

# Takeaway

<strong>Pattern: Frequency Hashing</strong> — "Have I seen this before?" → <strong>Hash Set</strong>. This is the #1 most common array pattern, foundational to Two Sum, Group Anagrams, Longest Consecutive Sequence, and hundreds more problems.
