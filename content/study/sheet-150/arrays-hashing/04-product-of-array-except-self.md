---
id: 9d4554ec-1be1-7d1c-b3e5-2ec70eb2f6ff
key: problem:sheet-150/lc-238
subject: sheet-150
topic: arrays-hashing
title: Product of Array Except Self
slug: product-of-array-except-self
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 238](https://leetcode.com/problems/product-of-array-except-self/)

# Problem

Return array where `answer[i]` = product of all elements except `nums[i]`. Must run O(n) <strong>without division</strong>.

# Examples

> [!NOTE]
>
> Example 1
>
> nums = \[1,2,3,4\]
>
> Output: \[24,12,8,6\]
>
> // 24=2\*3\*4, 12=1\*3\*4, 8=1\*2\*4, 6=1\*2\*3

# Intuition

`answer[i] = product_of_all_left × product_of_all_right`. Two passes: left to right (prefix), right to left (suffix). Combine into result in O(n) with O(1) extra space.

# Optimized Code — Prefix × Suffix

```python filename:Python
class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        n = len(nums)
        res = [1] * n
        prefix = 1
        for i in range(n):
            res[i] = prefix
            prefix *= nums[i]
        suffix = 1
        for i in range(n-1, -1, -1):
            res[i] *= suffix
            suffix *= nums[i]
        return res
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        int n = nums.size();
        vector<int> res(n, 1);
        int prefix = 1;
        for (int i = 0; i < n; i++) { res[i] = prefix; prefix *= nums[i]; }
        int suffix = 1;
        for (int i = n - 1; i >= 0; i--) { res[i] *= suffix; suffix *= nums[i]; }
        return res;
    }
};
```

```java filename:Java
class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        int prefix = 1;
        for (int i = 0; i < n; i++) { res[i] = prefix; prefix *= nums[i]; }
        int suffix = 1;
        for (int i = n - 1; i >= 0; i--) { res[i] *= suffix; suffix *= nums[i]; }
        return res;
    }
}
```

```javascript filename:JavaScript
var productExceptSelf = function(nums) {
    const n = nums.length, res = new Array(n).fill(1);
    let prefix = 1;
    for (let i = 0; i < n; i++) { res[i]=prefix; prefix*=nums[i]; }
    let suffix = 1;
    for (let i = n-1; i >= 0; i--) { res[i]*=suffix; suffix*=nums[i]; }
    return res;
};
```

<strong>Time: O(n) · Space: O(1)\*</strong>

# Takeaway

<strong>Pattern: Prefix/Suffix Accumulation</strong> — "Everything to the left × everything to the right." Applies to Trapping Rain Water, Max Product Subarray. Avoids division.
