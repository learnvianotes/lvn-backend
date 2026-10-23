---
id: c61ac535-1fb6-7f75-ad71-704732098496
key: problem:sheet-150/lc-4
subject: sheet-150
topic: binary-search
title: Median of Two Sorted Arrays
slug: median-of-two-sorted-arrays
order: 3
---

Difficulty: <strong>Hard</strong> · [LeetCode 4](https://leetcode.com/problems/median-of-two-sorted-arrays/)

# Problem

Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays in $O(\\log(m+n))$ time.

# Understanding the problem

Partition both arrays into equal left and right halves such that $\\max(\\text{left}\_1, \\text{left}\_2) \\le \\min(\\text{right}\_1, \\text{right}\_2)$.

# Intuition

Binary search partition on the smaller array `nums1`. Calculate partition indices in both arrays so total left elements equals total right elements.

# Approach

1. Ensure `len(nums1) <= len(nums2)` (swap if necessary).
2. Set `left = 0`, `right = len(nums1)`.
3. Calculate `partition1 = (left + right) // 2` and `partition2 = (m + n + 1) // 2 - partition1`.
4. Determine `left1, right1, left2, right2` boundary values.
5. If `left1 <= right2` and `left2 <= right1`: partition is valid!
6. Return $\\max(\\text{left}\_1, \\text{left}\_2)$ (if odd total length) or average of max left and min right (if even).
7. If `left1 > right2`: move partition left `right = partition1 - 1`; else move right `left = partition1 + 1`.

# Naive Solution — Brute Force

Merge both sorted arrays into a combined array of size $m+n$ and pick median.

```python filename:Python
class Solution:
    def findMedianSortedArrays(self, nums1, nums2):

        merged = []

        i = 0
        j = 0

        while i < len(nums1) and j < len(nums2):

            if nums1[i] <= nums2[j]:
                merged.append(nums1[i])
                i += 1
            else:
                merged.append(nums2[j])
                j += 1

        merged.extend(nums1[i:])
        merged.extend(nums2[j:])

        n = len(merged)

        if n % 2:
            return merged[n // 2]

        return (
            merged[n // 2 - 1]
            + merged[n // 2]
        ) / 2
```

```cpp filename:C%2B%2B
class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        vector<int> merged;

        int i = 0;
        int j = 0;

        while (i < nums1.size() && j < nums2.size()) {
            if (nums1[i] <= nums2[j]) {
                merged.push_back(nums1[i++]);
            } else {
                merged.push_back(nums2[j++]);
            }
        }

        merged.insert(merged.end(), nums1.begin() + i, nums1.end());
        merged.insert(merged.end(), nums2.begin() + j, nums2.end());

        int n = merged.size();

        if (n % 2) {
            return merged[n / 2];
        }

        return (merged[n / 2 - 1] + (double) merged[n / 2]) / 2;
    }
};
```

```java filename:Java
class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        int[] merged = new int[nums1.length + nums2.length];

        int i = 0;
        int j = 0;
        int k = 0;

        while (i < nums1.length && j < nums2.length) {
            if (nums1[i] <= nums2[j]) {
                merged[k++] = nums1[i++];
            } else {
                merged[k++] = nums2[j++];
            }
        }

        while (i < nums1.length) merged[k++] = nums1[i++];
        while (j < nums2.length) merged[k++] = nums2[j++];

        int n = merged.length;

        if (n % 2 == 1) {
            return merged[n / 2];
        }

        return ((double) merged[n / 2 - 1] + merged[n / 2]) / 2;
    }
}
```

```javascript filename:JavaScript
var findMedianSortedArrays = function(nums1, nums2) {
    const merged = [];

    let i = 0;
    let j = 0;

    while (i < nums1.length && j < nums2.length) {
        if (nums1[i] <= nums2[j]) {
            merged.push(nums1[i++]);
        } else {
            merged.push(nums2[j++]);
        }
    }

    merged.push(...nums1.slice(i), ...nums2.slice(j));

    const n = merged.length;

    if (n % 2) {
        return merged[Math.floor(n / 2)];
    }

    return (merged[n / 2 - 1] + merged[n / 2]) / 2;
};
```

<strong>Time: O(m + n) · Space: O(m + n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def findMedianSortedArrays(self, nums1, nums2):

        if len(nums1) > len(nums2):
            nums1, nums2 = nums2, nums1

        m = len(nums1)
        n = len(nums2)

        left = 0
        right = m

        half = (m + n + 1) // 2

        while left <= right:

            partition1 = (
                left + right
            ) // 2

            partition2 = (
                half - partition1
            )

            left1 = (
                nums1[partition1 - 1]
                if partition1 > 0
                else float("-inf")
            )

            right1 = (
                nums1[partition1]
                if partition1 < m
                else float("inf")
            )

            left2 = (
                nums2[partition2 - 1]
                if partition2 > 0
                else float("-inf")
            )

            right2 = (
                nums2[partition2]
                if partition2 < n
                else float("inf")
            )

            # Correct partition
            if left1 <= right2 and left2 <= right1:

                if (m + n) % 2:
                    return max(left1, left2)

                return (
                    max(left1, left2)
                    + min(right1, right2)
                ) / 2

            # Partition1 is too far right
            elif left1 > right2:
                right = partition1 - 1

            # Partition1 is too far left
            else:
                left = partition1 + 1
```

```cpp filename:C%2B%2B
class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        if (nums1.size() > nums2.size()) {
            return findMedianSortedArrays(nums2, nums1);
        }

        int m = nums1.size();
        int n = nums2.size();

        int left = 0;
        int right = m;

        int half = (m + n + 1) / 2;

        while (left <= right) {
            int partition1 = (left + right) / 2;
            int partition2 = half - partition1;

            int left1 = partition1 > 0 ? nums1[partition1 - 1] : INT_MIN;
            int right1 = partition1 < m ? nums1[partition1] : INT_MAX;
            int left2 = partition2 > 0 ? nums2[partition2 - 1] : INT_MIN;
            int right2 = partition2 < n ? nums2[partition2] : INT_MAX;

            // Correct partition
            if (left1 <= right2 && left2 <= right1) {
                if ((m + n) % 2) {
                    return max(left1, left2);
                }

                return ((double) max(left1, left2) + min(right1, right2)) / 2;
            }
            // Partition1 is too far right
            else if (left1 > right2) {
                right = partition1 - 1;
            }
            // Partition1 is too far left
            else {
                left = partition1 + 1;
            }
        }

        return 0;
    }
};
```

```java filename:Java
class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) {
            return findMedianSortedArrays(nums2, nums1);
        }

        int m = nums1.length;
        int n = nums2.length;

        int left = 0;
        int right = m;

        int half = (m + n + 1) / 2;

        while (left <= right) {
            int partition1 = (left + right) / 2;
            int partition2 = half - partition1;

            int left1 = partition1 > 0 ? nums1[partition1 - 1] : Integer.MIN_VALUE;
            int right1 = partition1 < m ? nums1[partition1] : Integer.MAX_VALUE;
            int left2 = partition2 > 0 ? nums2[partition2 - 1] : Integer.MIN_VALUE;
            int right2 = partition2 < n ? nums2[partition2] : Integer.MAX_VALUE;

            // Correct partition
            if (left1 <= right2 && left2 <= right1) {
                if ((m + n) % 2 == 1) {
                    return Math.max(left1, left2);
                }

                return ((double) Math.max(left1, left2) + Math.min(right1, right2)) / 2;
            }
            // Partition1 is too far right
            else if (left1 > right2) {
                right = partition1 - 1;
            }
            // Partition1 is too far left
            else {
                left = partition1 + 1;
            }
        }

        return 0;
    }
}
```

```javascript filename:JavaScript
var findMedianSortedArrays = function(nums1, nums2) {
    if (nums1.length > nums2.length) {
        [nums1, nums2] = [nums2, nums1];
    }

    const m = nums1.length;
    const n = nums2.length;

    let left = 0;
    let right = m;

    const half = Math.floor((m + n + 1) / 2);

    while (left <= right) {
        const partition1 = Math.floor((left + right) / 2);
        const partition2 = half - partition1;

        const left1 = partition1 > 0 ? nums1[partition1 - 1] : -Infinity;
        const right1 = partition1 < m ? nums1[partition1] : Infinity;
        const left2 = partition2 > 0 ? nums2[partition2 - 1] : -Infinity;
        const right2 = partition2 < n ? nums2[partition2] : Infinity;

        // Correct partition
        if (left1 <= right2 && left2 <= right1) {
            if ((m + n) % 2) {
                return Math.max(left1, left2);
            }

            return (Math.max(left1, left2) + Math.min(right1, right2)) / 2;
        }
        // Partition1 is too far right
        else if (left1 > right2) {
            right = partition1 - 1;
        }
        // Partition1 is too far left
        else {
            left = partition1 + 1;
        }
    }
};
```

<strong>Time: O(log(min(m, n))) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Binary search partition on smaller array
