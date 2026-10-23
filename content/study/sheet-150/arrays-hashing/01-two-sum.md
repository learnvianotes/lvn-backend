---
id: 860703c1-1675-7df0-a463-73dc93baa06c
key: problem:sheet-150/lc-1
subject: sheet-150
topic: arrays-hashing
title: Two Sum
slug: two-sum
order: 1
---

Difficulty: <strong>Easy</strong> · [LeetCode 1](https://leetcode.com/problems/two-sum/)

# Problem

Given an array of integers `nums` and an integer `target`, return <em>indices</em> of the two numbers that add up to `target`. Exactly one solution exists. You may not use the same element twice.

# Examples

Input

`nums: int[]`, `target: int`<br>2 ≤ n ≤ 10<sup>4</sup>

Output

`int[2]` — indices \[i, j\] where nums\[i\]+nums\[j\]=target

> [!NOTE]
>
> Example 1
>
> nums=\[2,7,11,15\], target=9
>
> Output: \[0,1\]
>
> // 2+7=9

> [!NOTE]
>
> Example 2
>
> nums=\[3,2,4\], target=6
>
> Output: \[1,2\]

# Constraints

- `2 ≤ nums.length ≤ 10`<sup>`4`</sup>
- `-10`<sup>`9`</sup>` ≤ nums[i], target ≤ 10`<sup>`9`</sup>
- Only one valid answer exists

# Understanding the problem

For each element `x`, we need `target - x`. Brute force checks all pairs O(n²). Optimization: store each element in a map as we scan, look up the complement in O(1).

# Intuition

For each element x, we need `target - x`. Store visited elements in `{value: index}` map. Check if the complement exists before inserting current element.

# Approach

1. Init empty map `seen = {value: index}`.
2. For each index i: compute `complement = target - nums[i]`.
3. If `complement in seen` → return `[seen[complement], i]`.
4. Else store `seen[nums[i]] = i`.

# Naive Solution — O(n²)

Check all pairs (i, j) with i &lt; j.

> [!TIP] Expected Output
>
> \[2,7,11,15\],target=9 → \[0,1\]

```python filename:Python
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < nums.size(); i++)
            for (int j = i+1; j < nums.size(); j++)
                if (nums[i]+nums[j]==target) return {i,j};
        return {};
    }
};
```

```java filename:Java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i+1; j < nums.length; j++)
                if (nums[i]+nums[j]==target) return new int[]{i,j};
        return new int[]{};
    }
}
```

```javascript filename:JavaScript
var twoSum = function(nums, target) {
    for (let i = 0; i < nums.length; i++)
        for (let j = i+1; j < nums.length; j++)
            if (nums[i]+nums[j]===target) return [i,j];
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Optimized Code — One-pass HashMap

> [!TIP] Expected Output
>
> \[2,7,11,15\],9 → \[0,1\] | \[3,2,4\],6 → \[1,2\] | \[3,3\],6 → \[0,1\]

```python filename:Python
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int,int> seen;
        for (int i = 0; i < nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.count(comp)) return {seen[comp], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
```

```java filename:Java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer,Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (seen.containsKey(comp)) return new int[]{seen.get(comp),i};
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}
```

```javascript filename:JavaScript
var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (seen.has(comp)) return [seen.get(comp), i];
        seen.set(nums[i], i);
    }
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Variants

> [!NOTE]
>
> Method 1 — One-pass HashMap · O(n) / O(n) ✓
>
> Check complement before inserting. Handles \[3,3\] edge case correctly.

> [!NOTE]
>
> Method 2 — Two-pass HashMap · O(n) / O(n)
>
> Build full map, then scan for complement. Slightly simpler, same complexity.

> [!NOTE]
>
> Method 3 — Two Pointers (if sorted) · O(n log n) / O(1)
>
> Sort + two pointers. O(1) space but loses original indices.

# Takeaway

<strong>Pattern: Complement Lookup via HashMap</strong> — Store visited elements, check complement on each step. Canonical HashMap-in-arrays pattern. Generalizes to 3Sum (sort + fix + two-ptr) and 4Sum.
