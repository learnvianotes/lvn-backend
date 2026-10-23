---
id: 314dd1b5-793d-7741-8882-d0d6d01a19b0
key: problem:sheet-150/lc-152
subject: sheet-150
topic: dp-1d
title: Maximum Product Subarray
slug: maximum-product-subarray
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 152](https://leetcode.com/problems/maximum-product-subarray/)

# Problem

Given an integer array `nums`, find contiguous non-empty subarray that has largest product.

# Understanding the problem

Multiplying a negative number by the smallest negative product can turn it into the largest positive product. Thus, track BOTH max and min products.

# Intuition

Track `current_max` and `current_min`. When `num < 0`, swap `current_max` and `current_min` before updating.

# Approach

1. Initialize `current_max = nums[0]`, `current_min = nums[0]`, `answer = nums[0]`.
2. For `num` in `nums[1:]`: if `num < 0`, swap `current_max, current_min`.
3. Update `current_max = max(num, current_max * num)` and `current_min = min(num, current_min * num)`.
4. Update `answer = max(answer, current_max)`. Return `answer`.

# Naive Solution — Brute Force

Calculate product of every subarray using nested loops.

```python filename:Python
class Solution:
    def maxProduct(self, nums):

        answer = nums[0]

        for i in range(len(nums)):
            product = 1

            for j in range(i, len(nums)):
                product *= nums[j]
                answer = max(answer, product)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProduct(vector<int>& nums) {
        long long answer = nums[0];

        for (int i = 0; i < (int)nums.size(); i++) {
            long long product = 1;

            for (int j = i; j < (int)nums.size(); j++) {
                product *= nums[j];
                answer = max(answer, product);
            }
        }

        return (int)answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxProduct(int[] nums) {
        long answer = nums[0];

        for (int i = 0; i < nums.length; i++) {
            long product = 1;

            for (int j = i; j < nums.length; j++) {
                product *= nums[j];
                answer = Math.max(answer, product);
            }
        }

        return (int) answer;
    }
}
```

```javascript filename:JavaScript
var maxProduct = function(nums) {
    let answer = nums[0];

    for (let i = 0; i < nums.length; i++) {
        let product = 1;

        for (let j = i; j < nums.length; j++) {
            product *= nums[j];
            answer = Math.max(answer, product);
        }
    }

    return answer;
};
```

<strong>Time: O(n²) · Aux Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def maxProduct(self, nums):

        current_max = nums[0]
        current_min = nums[0]
        answer = nums[0]

        for num in nums[1:]:

            if num < 0:
                current_max, current_min = (
                    current_min,
                    current_max
                )

            current_max = max(
                num,
                current_max * num
            )

            current_min = min(
                num,
                current_min * num
            )

            answer = max(answer, current_max)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int maxProduct(vector<int>& nums) {
        long long currentMax = nums[0];
        long long currentMin = nums[0];
        long long answer = nums[0];

        for (int i = 1; i < (int)nums.size(); i++) {
            long long num = nums[i];

            if (num < 0) swap(currentMax, currentMin);

            currentMax = max(num, currentMax * num);
            currentMin = min(num, currentMin * num);

            answer = max(answer, currentMax);
        }

        return (int)answer;
    }
};
```

```java filename:Java
class Solution {
    public int maxProduct(int[] nums) {
        long currentMax = nums[0];
        long currentMin = nums[0];
        long answer = nums[0];

        for (int i = 1; i < nums.length; i++) {
            long num = nums[i];

            if (num < 0) {
                long temp = currentMax;
                currentMax = currentMin;
                currentMin = temp;
            }

            currentMax = Math.max(num, currentMax * num);
            currentMin = Math.min(num, currentMin * num);

            answer = Math.max(answer, currentMax);
        }

        return (int) answer;
    }
}
```

```javascript filename:JavaScript
var maxProduct = function(nums) {
    let currentMax = nums[0];
    let currentMin = nums[0];
    let answer = nums[0];

    for (let i = 1; i < nums.length; i++) {
        const num = nums[i];

        if (num < 0) {
            [currentMax, currentMin] = [currentMin, currentMax];
        }

        currentMax = Math.max(num, currentMax * num);
        currentMin = Math.min(num, currentMin * num);

        answer = Math.max(answer, currentMax);
    }

    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>When the operation can flip states, track both max and min.</strong>
