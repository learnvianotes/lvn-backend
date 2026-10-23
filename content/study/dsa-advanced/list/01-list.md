---
id: e5ab50d0-03e9-7bf5-b941-eaf669f69efb
key: topic:dsa-advanced/list
subject: dsa-advanced
topic: list
title: List
slug: list
order: 1
---

A list (Python's dynamic array) is the input of most interview problems. These notes collect the classic array problems and the handful of patterns — running minimum, prefix sums, two pointers, sliding window, Kadane's running best, difference arrays, majority voting — that turn the obvious `O(n²)` double loop into a single `O(n)` pass.

> [!INFO]
>
> <strong>Array / list</strong> — a contiguous block of elements addressed by index. `arr[i]` costs `O(1)`; appending at the end is amortised `O(1)`; inserting or deleting anywhere else shifts everything after it — `O(n)`.

```text filename:Vocabulary%3A%20a%20*subarray*%20is%20contiguous%3B%20a%20*subsequence*%20keeps%20order%20but%20may%20skip
index:   0    1    2    3    4    5    6
       ┌────┬────┬────┬────┬────┬────┬────┐
arr:   │ 2  │ 3  │ 10 │ 6  │ 4  │ 8  │ 1  │     n = 7
       └────┴────┴────┴────┴────┴────┴────┘
subarray arr[2..4] = 10 6 4   (contiguous)      subsequence 2 10 1 (not contiguous)
```

# The patterns behind every solution

Almost every naive solution below fixes a left end `i` and scans every right end `j` — `n(n-1)/2` pairs, hence `O(n²)`. The efficient solution replaces the inner scan with something that is already known when we reach `j`: the minimum so far, a prefix sum, the best subarray ending here. One pass, `O(n)`.

| Pattern | What you carry while scanning | Problems |
| --- | --- | --- |
| Running min / max | The best `arr[i]` seen so far — the inner loop over `i < j` disappears | Maximum difference, trapping rain water |
| Greedy local steps | Add every upward step; the sum of steps equals the best transaction set | Stock buy and sell |
| Kadane (running best ending here) | `maxEnding = max(maxEnding + x, x)` — extend or restart | Maximum subarray sum, circular sum, even-odd subarray |
| Sliding window | The sum of the last `k` elements: add the new one, drop the old one | Max sum of `k` consecutive |
| Two pointers | A window `[s, i]` that grows at the right and shrinks at the left | Subarray with given sum |
| Prefix sum | `psum[i]` = sum of `arr[0..i]`, so any range sum is one subtraction | Range sum queries, equilibrium point |
| Difference array | `+1` at `left`, `-1` at `right+1`; a prefix sum turns it into counts | Maximum appearing element in ranges |
| Boyer–Moore voting | A candidate and a counter; every mismatch cancels one vote | Majority element |
| Reversal | Three reversals rotate in place | Left rotate by `d` |

# Left rotate by d places

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 3, 4, 5], d = 2`<br><strong>Output:</strong> `3 4 5 1 2`<br><strong>Input:</strong> `arr = [10, 20, 30], d = 1`<br><strong>Output:</strong> `20 30 10`

Python can do this in one line with slicing or `deque.rotate`, both `O(n)` but using `O(n)` extra space. Popping from the front `d` times is `O(n · d)` because every `pop(0)` shifts the whole list.

```python filename:Python
from collections import deque

l = [10, 20, 30, 40, 50]
d = 2
print(*(l[d:] + l[:d]))        # slicing: new list, O(n) space

dq = deque(l)
dq.rotate(-d)                  # negative = left rotation
print(*dq)

def left_rotate_slow(l, d):    # O(n * d): pop(0) shifts every element
    for _ in range(d):
        l.append(l.pop(0))
left_rotate_slow(l, d)
print(*l)
```

```text filename:Output
30 40 50 10 20
30 40 50 10 20
30 40 50 10 20
```

> [!NOTE] Idea
>
> <strong>Reversal algorithm.</strong> Reverse the first `d` elements, reverse the remaining `n-d`, then reverse the whole array. Each element is touched a constant number of times and nothing is copied: `O(n)` time, `O(1)` space.

```text filename:Three%20reversals%20rotate%20left%20by%20d
1 2 3 4 5     d = 2
2 1 | 3 4 5   reverse arr[0..d-1]
2 1 | 5 4 3   reverse arr[d..n-1]
3 4 5 1 2     reverse arr[0..n-1]
```

```python filename:Python
def reverse_range(arr, b, e):
    while b < e:
        arr[b], arr[e] = arr[e], arr[b]
        b += 1
        e -= 1

def left_rotate(arr, d):
    n = len(arr)
    d %= n                        # rotating by n is a no-op
    reverse_range(arr, 0, d - 1)  # 2 1 | 3 4 5
    reverse_range(arr, d, n - 1)  # 2 1 | 5 4 3
    reverse_range(arr, 0, n - 1)  # 3 4 5 1 2

for arr, d in (([1, 2, 3, 4, 5], 2), ([10, 20, 30], 1)):
    left_rotate(arr, d)
    print(*arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <utility>
using namespace std;

void reverseRange(vector<int>& arr, int b, int e) {
    while (b < e) swap(arr[b++], arr[e--]);
}

void leftRotate(vector<int>& arr, int d) {
    int n = arr.size();
    d %= n;                        // rotating by n is a no-op
    reverseRange(arr, 0, d - 1);   // 2 1 | 3 4 5
    reverseRange(arr, d, n - 1);   // 2 1 | 5 4 3
    reverseRange(arr, 0, n - 1);   // 3 4 5 1 2
}

int main() {
    vector<int> a = {1, 2, 3, 4, 5}, b = {10, 20, 30};
    leftRotate(a, 2);
    leftRotate(b, 1);
    for (int x : a) cout << x << " ";
    cout << "\n";
    for (int x : b) cout << x << " ";
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static void reverseRange(int[] arr, int b, int e) {
        while (b < e) { int t = arr[b]; arr[b] = arr[e]; arr[e] = t; b++; e--; }
    }

    static void leftRotate(int[] arr, int d) {
        int n = arr.length;
        d %= n;                        // rotating by n is a no-op
        reverseRange(arr, 0, d - 1);   // 2 1 | 3 4 5
        reverseRange(arr, d, n - 1);   // 2 1 | 5 4 3
        reverseRange(arr, 0, n - 1);   // 3 4 5 1 2
    }

    static void print(int[] arr) {
        StringBuilder sb = new StringBuilder();
        for (int x : arr) sb.append(x).append(' ');
        System.out.println(sb.toString().trim());
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4, 5}, b = {10, 20, 30};
        leftRotate(a, 2);
        leftRotate(b, 1);
        print(a);
        print(b);
    }
}
```

```javascript filename:JavaScript
function reverseRange(arr, b, e) {
    while (b < e) { [arr[b], arr[e]] = [arr[e], arr[b]]; b++; e--; }
}

function leftRotate(arr, d) {
    const n = arr.length;
    d %= n;                        // rotating by n is a no-op
    reverseRange(arr, 0, d - 1);   // 2 1 | 3 4 5
    reverseRange(arr, d, n - 1);   // 2 1 | 5 4 3
    reverseRange(arr, 0, n - 1);   // 3 4 5 1 2
}

for (const [arr, d] of [[[1, 2, 3, 4, 5], 2], [[10, 20, 30], 1]]) {
    leftRotate(arr, d);
    console.log(arr.join(" "));
}
```

```text filename:Output
3 4 5 1 2
20 30 10
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> A right rotation by `d` is a left rotation by `n - d`. Always reduce `d % n` first — `d` may be larger than `n`.

# Maximum difference

Find the maximum value of `arr[j] - arr[i]` with `i < j` (buy once, sell once later).

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 3, 10, 6, 4, 8, 1]`<br><strong>Output:</strong> `8`<br><strong>Input:</strong> `arr = [7, 9, 5, 6, 3, 2]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [30, 20, 10]`<br><strong>Output:</strong> `-10`

The naive solution tries every pair `(i, j)` — `O(n²)`:

```python filename:Python
def max_diff_naive(arr):
    n = len(arr)
    res = arr[1] - arr[0]
    for i in range(n - 1):
        for j in range(i + 1, n):          # every pair i < j
            res = max(res, arr[j] - arr[i])
    return res

print(max_diff_naive([2, 3, 10, 6, 4, 8, 1]))
```

```text filename:Output
8
```

> [!NOTE] Idea
>
> For a fixed `j`, the best `i` is simply the <strong>minimum element before </strong><strong>`j`</strong>. Carry that minimum while scanning left to right: at each `j` compute `arr[j] - minSoFar`, then update the minimum. The inner loop collapses into one variable.

```python filename:Python
def max_diff(arr):
    res = arr[1] - arr[0]
    min_val = arr[0]                     # smallest element before j
    for j in range(1, len(arr)):
        res = max(res, arr[j] - min_val)
        min_val = min(min_val, arr[j])   # update AFTER using it (i must be < j)
    return res

for arr in ([2, 3, 10, 6, 4, 8, 1], [7, 9, 5, 6, 3, 2], [30, 20, 10]):
    print(max_diff(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxDiff(const vector<int>& arr) {
    int n = arr.size();
    int res = arr[1] - arr[0];
    int minVal = arr[0];                     // smallest element before j
    for (int j = 1; j < n; j++) {
        res = max(res, arr[j] - minVal);
        minVal = min(minVal, arr[j]);        // update AFTER using it (i must be < j)
    }
    return res;
}

int main() {
    vector<vector<int>> tests = {{2, 3, 10, 6, 4, 8, 1}, {7, 9, 5, 6, 3, 2}, {30, 20, 10}};
    for (auto& arr : tests) cout << maxDiff(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxDiff(int[] arr) {
        int res = arr[1] - arr[0];
        int minVal = arr[0];                     // smallest element before j
        for (int j = 1; j < arr.length; j++) {
            res = Math.max(res, arr[j] - minVal);
            minVal = Math.min(minVal, arr[j]);   // update AFTER using it (i must be < j)
        }
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{2, 3, 10, 6, 4, 8, 1}, {7, 9, 5, 6, 3, 2}, {30, 20, 10}};
        for (int[] arr : tests) System.out.println(maxDiff(arr));
    }
}
```

```javascript filename:JavaScript
function maxDiff(arr) {
    let res = arr[1] - arr[0];
    let minVal = arr[0];                     // smallest element before j
    for (let j = 1; j < arr.length; j++) {
        res = Math.max(res, arr[j] - minVal);
        minVal = Math.min(minVal, arr[j]);   // update AFTER using it (i must be < j)
    }
    return res;
}

for (const arr of [[2, 3, 10, 6, 4, 8, 1], [7, 9, 5, 6, 3, 2], [30, 20, 10]])
    console.log(maxDiff(arr));
```

```text filename:Output
8
2
-10
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Initialise `res` with `arr[1] - arr[0]`, not `0` — for a strictly decreasing array the answer is negative. Also update `min_val` <em>after</em> computing the difference, or you allow `i == j`.

# Stock buy and sell

Given daily prices, buy and sell any number of times (one share at a time, sell before buying again). Maximise the total profit.

> [!TIP] Example
>
> <strong>Input:</strong> `price = [1, 5, 3, 8, 12]`<br><strong>Output:</strong> `13`<br><strong>Input:</strong> `price = [30, 20, 10]`<br><strong>Output:</strong> `0`<br><strong>Input:</strong> `price = [1, 2, 3, 4]`<br><strong>Output:</strong> `3`

The naive idea considers every pair `(i, j)` with `price[j] > price[i]` as one transaction and recurses on both sides: `profit = (price[j] - price[i]) + maxProfit(0, i-1) + maxProfit(j+1, n-1)`. For `[1, 5, 3, 8, 12]` the pair `(1, 5)` gives `4 + 0 + 9 = 13`. It is exponential.

```python filename:Python
def max_profit_naive(price, b, e):
    if e <= b:
        return 0
    res = 0
    for i in range(b, e):
        for j in range(i + 1, e + 1):
            if price[j] > price[i]:
                curr = (price[j] - price[i]
                        + max_profit_naive(price, b, i - 1)
                        + max_profit_naive(price, j + 1, e))
                res = max(res, curr)
    return res

print(max_profit_naive([1, 5, 3, 8, 12], 0, 4))
```

```text filename:Output
13
```

> [!NOTE] Idea
>
> Every rise `price[i] > price[i-1]` can be collected on its own: buying at the bottom and selling at the top of a rising run equals the sum of its daily rises. So just <strong>add every positive day-to-day difference</strong> — a greedy one-pass solution.

```text filename:Local%20rises%20sum%20to%20the%20optimal%20profit
price:  1   5   3   8   12
rises:   +4  -2  +5  +4        collect the rises: 4 + 5 + 4 = 13
```

```python filename:Python
def max_profit(price):
    profit = 0
    for i in range(1, len(price)):
        if price[i] > price[i - 1]:          # a rise: buy yesterday, sell today
            profit += price[i] - price[i - 1]
    return profit

for price in ([1, 5, 3, 8, 12], [30, 20, 10], [1, 2, 3, 4]):
    print(max_profit(price))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int maxProfit(const vector<int>& price) {
    int n = price.size();
    int profit = 0;
    for (int i = 1; i < n; i++)
        if (price[i] > price[i - 1])             // a rise: buy yesterday, sell today
            profit += price[i] - price[i - 1];
    return profit;
}

int main() {
    vector<vector<int>> tests = {{1, 5, 3, 8, 12}, {30, 20, 10}, {1, 2, 3, 4}};
    for (auto& price : tests) cout << maxProfit(price) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxProfit(int[] price) {
        int profit = 0;
        for (int i = 1; i < price.length; i++)
            if (price[i] > price[i - 1])             // a rise: buy yesterday, sell today
                profit += price[i] - price[i - 1];
        return profit;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 5, 3, 8, 12}, {30, 20, 10}, {1, 2, 3, 4}};
        for (int[] price : tests) System.out.println(maxProfit(price));
    }
}
```

```javascript filename:JavaScript
function maxProfit(price) {
    let profit = 0;
    for (let i = 1; i < price.length; i++)
        if (price[i] > price[i - 1])             // a rise: buy yesterday, sell today
            profit += price[i] - price[i - 1];
    return profit;
}

for (const price of [[1, 5, 3, 8, 12], [30, 20, 10], [1, 2, 3, 4]])
    console.log(maxProfit(price));
```

```text filename:Output
13
0
3
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> With <strong>one</strong> transaction only, the problem becomes <em>maximum difference</em> above (clamped at 0). With at most `k` transactions it needs dynamic programming.

# Trapping rain water

`arr[i]` is the height of bar `i`. How much water is trapped between the bars after rain?

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 0, 1, 2, 5]`<br><strong>Output:</strong> `6`<br><strong>Input:</strong> `arr = [2, 0, 2]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [1, 2, 3]`<br><strong>Output:</strong> `0`<br><strong>Input:</strong> `arr = [3, 2, 1]`<br><strong>Output:</strong> `0`

```text filename:Each%20column%20holds%20water%20up%20to%20the%20lower%20of%20its%20two%20surrounding%20maxima
            █
            █
█     ~  ~  █          water over bar i = min(highest bar on the left,
█  ~  ~  █  █                                 highest bar on the right) - arr[i]
█  ~  █  █  █
3  0  1  2  5          3 + 2 + 1 = 6
```

The water above bar `i` is `min(lmax, rmax) - arr[i]`, where `lmax` is the tallest bar at or left of `i` and `rmax` the tallest at or right of it. The naive solution recomputes both maxima for every `i` — `O(n²)`:

```python filename:Python
def get_water_naive(arr):
    n, res = len(arr), 0
    for i in range(1, n - 1):
        lmax = max(arr[:i + 1])           # O(n) scan to the left
        rmax = max(arr[i:])               # O(n) scan to the right
        res += min(lmax, rmax) - arr[i]
    return res

print(get_water_naive([3, 0, 1, 2, 5]))
```

```text filename:Output
6
```

> [!NOTE] Idea
>
> Precompute `lmax[i]` (prefix maximum) in one left-to-right pass and `rmax[i]` (suffix maximum) in one right-to-left pass. Then every `min(lmax[i], rmax[i]) - arr[i]` is `O(1)`: three passes, `O(n)` time, `O(n)` space.

```python filename:Python
def get_water(arr):
    n = len(arr)
    if n < 3:
        return 0
    lmax = [0] * n                       # lmax[i] = max(arr[0..i])
    rmax = [0] * n                       # rmax[i] = max(arr[i..n-1])
    lmax[0] = arr[0]
    for i in range(1, n):
        lmax[i] = max(lmax[i - 1], arr[i])
    rmax[n - 1] = arr[n - 1]
    for i in range(n - 2, -1, -1):
        rmax[i] = max(rmax[i + 1], arr[i])
    res = 0
    for i in range(1, n - 1):            # the two end bars never hold water
        res += min(lmax[i], rmax[i]) - arr[i]
    return res

for arr in ([3, 0, 1, 2, 5], [2, 0, 2], [1, 2, 3], [3, 2, 1]):
    print(get_water(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int getWater(const vector<int>& arr) {
    int n = arr.size();
    if (n < 3) return 0;
    vector<int> lmax(n), rmax(n);           // prefix max / suffix max
    lmax[0] = arr[0];
    for (int i = 1; i < n; i++) lmax[i] = max(lmax[i - 1], arr[i]);
    rmax[n - 1] = arr[n - 1];
    for (int i = n - 2; i >= 0; i--) rmax[i] = max(rmax[i + 1], arr[i]);
    int res = 0;
    for (int i = 1; i < n - 1; i++)         // the two end bars never hold water
        res += min(lmax[i], rmax[i]) - arr[i];
    return res;
}

int main() {
    vector<vector<int>> tests = {{3, 0, 1, 2, 5}, {2, 0, 2}, {1, 2, 3}, {3, 2, 1}};
    for (auto& arr : tests) cout << getWater(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int getWater(int[] arr) {
        int n = arr.length;
        if (n < 3) return 0;
        int[] lmax = new int[n], rmax = new int[n];   // prefix max / suffix max
        lmax[0] = arr[0];
        for (int i = 1; i < n; i++) lmax[i] = Math.max(lmax[i - 1], arr[i]);
        rmax[n - 1] = arr[n - 1];
        for (int i = n - 2; i >= 0; i--) rmax[i] = Math.max(rmax[i + 1], arr[i]);
        int res = 0;
        for (int i = 1; i < n - 1; i++)                // the two end bars never hold water
            res += Math.min(lmax[i], rmax[i]) - arr[i];
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 0, 1, 2, 5}, {2, 0, 2}, {1, 2, 3}, {3, 2, 1}};
        for (int[] arr : tests) System.out.println(getWater(arr));
    }
}
```

```javascript filename:JavaScript
function getWater(arr) {
    const n = arr.length;
    if (n < 3) return 0;
    const lmax = new Array(n), rmax = new Array(n);   // prefix max / suffix max
    lmax[0] = arr[0];
    for (let i = 1; i < n; i++) lmax[i] = Math.max(lmax[i - 1], arr[i]);
    rmax[n - 1] = arr[n - 1];
    for (let i = n - 2; i >= 0; i--) rmax[i] = Math.max(rmax[i + 1], arr[i]);
    let res = 0;
    for (let i = 1; i < n - 1; i++)                    // the two end bars never hold water
        res += Math.min(lmax[i], rmax[i]) - arr[i];
    return res;
}

for (const arr of [[3, 0, 1, 2, 5], [2, 0, 2], [1, 2, 3], [3, 2, 1]])
    console.log(getWater(arr));
```

```text filename:Output
6
2
0
0
```

Time O(n) · Space O(n)

<strong>Two-pointer refinement, </strong><strong>`O(1)`</strong><strong> space.</strong> Walk `l` and `r` inwards from both ends. If `arr[l] < arr[r]`, the water above `l` is decided by `lmax` alone (there is certainly a bar at least as tall as `arr[r] > arr[l]` on the right), so settle `l` and move it; otherwise settle `r`.

```python filename:Python
def get_water(arr):
    l, r = 0, len(arr) - 1
    lmax = rmax = 0
    res = 0
    while l < r:
        if arr[l] < arr[r]:              # right side is tall enough: lmax decides
            lmax = max(lmax, arr[l])
            res += lmax - arr[l]
            l += 1
        else:                            # left side is tall enough: rmax decides
            rmax = max(rmax, arr[r])
            res += rmax - arr[r]
            r -= 1
    return res

for arr in ([3, 0, 1, 2, 5], [2, 0, 2], [1, 2, 3], [3, 2, 1]):
    print(get_water(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int getWater(const vector<int>& arr) {
    int l = 0, r = (int)arr.size() - 1;
    int lmax = 0, rmax = 0, res = 0;
    while (l < r) {
        if (arr[l] < arr[r]) {               // right side is tall enough: lmax decides
            lmax = max(lmax, arr[l]);
            res += lmax - arr[l];
            l++;
        } else {                             // left side is tall enough: rmax decides
            rmax = max(rmax, arr[r]);
            res += rmax - arr[r];
            r--;
        }
    }
    return res;
}

int main() {
    vector<vector<int>> tests = {{3, 0, 1, 2, 5}, {2, 0, 2}, {1, 2, 3}, {3, 2, 1}};
    for (auto& arr : tests) cout << getWater(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int getWater(int[] arr) {
        int l = 0, r = arr.length - 1;
        int lmax = 0, rmax = 0, res = 0;
        while (l < r) {
            if (arr[l] < arr[r]) {               // right side is tall enough: lmax decides
                lmax = Math.max(lmax, arr[l]);
                res += lmax - arr[l];
                l++;
            } else {                             // left side is tall enough: rmax decides
                rmax = Math.max(rmax, arr[r]);
                res += rmax - arr[r];
                r--;
            }
        }
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 0, 1, 2, 5}, {2, 0, 2}, {1, 2, 3}, {3, 2, 1}};
        for (int[] arr : tests) System.out.println(getWater(arr));
    }
}
```

```javascript filename:JavaScript
function getWater(arr) {
    let l = 0, r = arr.length - 1;
    let lmax = 0, rmax = 0, res = 0;
    while (l < r) {
        if (arr[l] < arr[r]) {               // right side is tall enough: lmax decides
            lmax = Math.max(lmax, arr[l]);
            res += lmax - arr[l];
            l++;
        } else {                             // left side is tall enough: rmax decides
            rmax = Math.max(rmax, arr[r]);
            res += rmax - arr[r];
            r--;
        }
    }
    return res;
}

for (const arr of [[3, 0, 1, 2, 5], [2, 0, 2], [1, 2, 3], [3, 2, 1]])
    console.log(getWater(arr));
```

```text filename:Output
6
2
0
0
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> The original naive version re-used the loop variable `j` for `rmax = arr[j]` after the first inner loop ended — it happened to equal `arr[i-1]`, which is wrong. Start `rmax` at `arr[i]`, or better, use the prefix/suffix maxima above.

# Maximum subarray sum (Kadane's algorithm)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 3, -8, 7, -1, 2, 3]`<br><strong>Output:</strong> `11`<br><strong>Input:</strong> `arr = [5, 8, 3]`<br><strong>Output:</strong> `16`<br><strong>Input:</strong> `arr = [-6, -1, -8]`<br><strong>Output:</strong> `-1`

The naive solution fixes a start `i`, extends the end `j` and keeps a running `curr` sum — `O(n²)` because every start is scanned separately:

```python filename:Python
def max_sum_naive(arr):
    res = arr[0]
    for i in range(len(arr)):
        curr = 0
        for j in range(i, len(arr)):       # every subarray starting at i
            curr += arr[j]
            res = max(res, curr)
    return res

print(max_sum_naive([2, 3, -8, 7, -1, 2, 3]))
```

```text filename:Output
11
```

> [!NOTE] Idea
>
> Let `maxEnding` be the best sum of a subarray that <strong>ends at </strong><strong>`i`</strong>. It is either the previous best extended by `arr[i]`, or `arr[i]` alone if the previous best had become negative (a negative prefix never helps): `maxEnding = max(maxEnding + arr[i], arr[i])`. The answer is the largest `maxEnding` seen.

```text filename:Kadane's%20running%20values
arr:        2   3  -8   7  -1   2   3
maxEnding:  2   5  -3   7   6   8  11     ← restart at 7 because -3 + 7 < 7
res:        2   5   5   7   7   8  11
```

```python filename:Python
def max_sum(arr):
    res = arr[0]
    max_ending = arr[0]                  # best subarray ending at the current index
    for i in range(1, len(arr)):
        max_ending = max(max_ending + arr[i], arr[i])   # extend or restart
        res = max(res, max_ending)
    return res

for arr in ([2, 3, -8, 7, -1, 2, 3], [5, 8, 3], [-6, -1, -8]):
    print(max_sum(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxSum(const vector<int>& arr) {
    int n = arr.size();
    int res = arr[0], maxEnding = arr[0];    // best subarray ending at the current index
    for (int i = 1; i < n; i++) {
        maxEnding = max(maxEnding + arr[i], arr[i]);   // extend or restart
        res = max(res, maxEnding);
    }
    return res;
}

int main() {
    vector<vector<int>> tests = {{2, 3, -8, 7, -1, 2, 3}, {5, 8, 3}, {-6, -1, -8}};
    for (auto& arr : tests) cout << maxSum(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxSum(int[] arr) {
        int res = arr[0], maxEnding = arr[0];    // best subarray ending at the current index
        for (int i = 1; i < arr.length; i++) {
            maxEnding = Math.max(maxEnding + arr[i], arr[i]);   // extend or restart
            res = Math.max(res, maxEnding);
        }
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{2, 3, -8, 7, -1, 2, 3}, {5, 8, 3}, {-6, -1, -8}};
        for (int[] arr : tests) System.out.println(maxSum(arr));
    }
}
```

```javascript filename:JavaScript
function maxSum(arr) {
    let res = arr[0], maxEnding = arr[0];    // best subarray ending at the current index
    for (let i = 1; i < arr.length; i++) {
        maxEnding = Math.max(maxEnding + arr[i], arr[i]);   // extend or restart
        res = Math.max(res, maxEnding);
    }
    return res;
}

for (const arr of [[2, 3, -8, 7, -1, 2, 3], [5, 8, 3], [-6, -1, -8]])
    console.log(maxSum(arr));
```

```text filename:Output
11
16
-1
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Initialising `res = 0` returns `0` for an all-negative array instead of `-1`. Start both `res` and `maxEnding` at `arr[0]` — a subarray must contain at least one element.

# Maximum length even-odd subarray

Find the longest subarray in which consecutive elements alternate between even and odd.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 12, 14, 7, 8]`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `arr = [7, 10, 13, 14]`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `arr = [10, 12, 8, 4]`<br><strong>Output:</strong> `1`

Naively, start at every `i` and extend while the parity keeps alternating — `O(n²)` in the worst case (a fully alternating array).

> [!NOTE] Idea
>
> Same shape as Kadane: `curr` is the length of the alternating run <strong>ending at </strong><strong>`i`</strong>. If `arr[i]` and `arr[i-1]` have different parity, `curr += 1`; otherwise the run breaks and `curr = 1`. Two parities differ exactly when `(arr[i] + arr[i-1]) % 2 == 1`, which also works for negative numbers.

```python filename:Python
def max_even_odd(arr):
    res = curr = 1
    for i in range(1, len(arr)):
        if (arr[i] + arr[i - 1]) % 2 == 1:   # parities differ → run continues
            curr += 1
            res = max(res, curr)
        else:
            curr = 1                         # run breaks
    return res

for arr in ([10, 12, 14, 7, 8], [7, 10, 13, 14], [10, 12, 8, 4]):
    print(max_even_odd(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxEvenOdd(const vector<int>& arr) {
    int n = arr.size();
    int res = 1, curr = 1;
    for (int i = 1; i < n; i++) {
        if ((arr[i] + arr[i - 1]) % 2 != 0) {    // parities differ → run continues
            curr++;
            res = max(res, curr);
        } else {
            curr = 1;                            // run breaks
        }
    }
    return res;
}

int main() {
    vector<vector<int>> tests = {{10, 12, 14, 7, 8}, {7, 10, 13, 14}, {10, 12, 8, 4}};
    for (auto& arr : tests) cout << maxEvenOdd(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxEvenOdd(int[] arr) {
        int res = 1, curr = 1;
        for (int i = 1; i < arr.length; i++) {
            if ((arr[i] + arr[i - 1]) % 2 != 0) {    // parities differ → run continues
                curr++;
                res = Math.max(res, curr);
            } else {
                curr = 1;                            // run breaks
            }
        }
        return res;
    }

    public static void main(String[] args) {
        int[][] tests = {{10, 12, 14, 7, 8}, {7, 10, 13, 14}, {10, 12, 8, 4}};
        for (int[] arr : tests) System.out.println(maxEvenOdd(arr));
    }
}
```

```javascript filename:JavaScript
function maxEvenOdd(arr) {
    let res = 1, curr = 1;
    for (let i = 1; i < arr.length; i++) {
        if ((arr[i] + arr[i - 1]) % 2 !== 0) {    // parities differ → run continues
            curr++;
            res = Math.max(res, curr);
        } else {
            curr = 1;                             // run breaks
        }
    }
    return res;
}

for (const arr of [[10, 12, 14, 7, 8], [7, 10, 13, 14], [10, 12, 8, 4]])
    console.log(maxEvenOdd(arr));
```

```text filename:Output
3
4
1
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> In C++, Java and JavaScript `-7 % 2` is `-1`, so testing `arr[i] % 2 == 1` misses negative odd numbers. Compare `% 2 != 0`, or test the parity of the sum as above.

# Maximum circular subarray sum

The array is circular: a subarray may wrap around from the last element to the first. For `[10, 5, -5]` the circular subarrays include `{-5, 10}` and `{5, -5, 10}` as well as the normal ones.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [5, -2, 3, 4]`<br><strong>Output:</strong> `12`<br><strong>Input:</strong> `arr = [10, 5, -5]`<br><strong>Output:</strong> `15`<br><strong>Input:</strong> `arr = [-3, -2, -1]`<br><strong>Output:</strong> `-1`

Naively start at every `i` and extend `n-1` times with the index `(i + j) % n` — `O(n²)`:

```python filename:Python
def max_circular_naive(arr):
    n = len(arr)
    res = arr[0]
    for i in range(n):
        curr_sum = arr[i]
        curr_max = arr[i]
        for j in range(1, n):
            curr_sum += arr[(i + j) % n]      # wrap around with modulo
            curr_max = max(curr_max, curr_sum)
        res = max(res, curr_max)
    return res

print(max_circular_naive([5, -2, 3, 4]))
```

```text filename:Output
12
```

> [!NOTE] Idea
>
> The answer is either a <strong>normal</strong> subarray (plain Kadane) or a <strong>wrapping</strong> one. A wrapping subarray is the whole array minus some normal subarray in the middle, so its sum is `total - minSubarraySum`. The minimum subarray sum is Kadane on the negated array (`-maxSum(-arr)`), which is why the original notes flip every sign. If every element is negative, the normal answer is the only valid one.

```text filename:A%20wrapping%20subarray%20is%20the%20complement%20of%20a%20middle%20subarray
arr:   5  -2   3   4         total = 10
         └──┘               minimum subarray  = -2
wrap:  5 ...... 3   4       10 - (-2) = 12 = sum of {3, 4, 5}
```

```python filename:Python
def kadane(arr):
    res = max_ending = arr[0]
    for i in range(1, len(arr)):
        max_ending = max(max_ending + arr[i], arr[i])
        res = max(res, max_ending)
    return res

def max_circular(arr):
    max_normal = kadane(arr)
    if max_normal < 0:                        # all negative: wrapping cannot help
        return max_normal
    total = sum(arr)
    min_sub = -kadane([-x for x in arr])      # min subarray = -(max subarray of negated)
    max_wrap = total - min_sub
    return max(max_normal, max_wrap)

for arr in ([5, -2, 3, 4], [10, 5, -5], [-3, -2, -1]):
    print(max_circular(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int kadane(const vector<int>& arr) {
    int n = arr.size();
    int res = arr[0], maxEnding = arr[0];
    for (int i = 1; i < n; i++) {
        maxEnding = max(maxEnding + arr[i], arr[i]);
        res = max(res, maxEnding);
    }
    return res;
}

int maxCircular(const vector<int>& arr) {
    int maxNormal = kadane(arr);
    if (maxNormal < 0) return maxNormal;        // all negative: wrapping cannot help
    int total = 0;
    vector<int> neg;
    for (int x : arr) { total += x; neg.push_back(-x); }
    int minSub = -kadane(neg);                  // min subarray = -(max subarray of negated)
    return max(maxNormal, total - minSub);
}

int main() {
    vector<vector<int>> tests = {{5, -2, 3, 4}, {10, 5, -5}, {-3, -2, -1}};
    for (auto& arr : tests) cout << maxCircular(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int kadane(int[] arr) {
        int res = arr[0], maxEnding = arr[0];
        for (int i = 1; i < arr.length; i++) {
            maxEnding = Math.max(maxEnding + arr[i], arr[i]);
            res = Math.max(res, maxEnding);
        }
        return res;
    }

    static int maxCircular(int[] arr) {
        int maxNormal = kadane(arr);
        if (maxNormal < 0) return maxNormal;        // all negative: wrapping cannot help
        int total = 0;
        int[] neg = new int[arr.length];
        for (int i = 0; i < arr.length; i++) { total += arr[i]; neg[i] = -arr[i]; }
        int minSub = -kadane(neg);                  // min subarray = -(max subarray of negated)
        return Math.max(maxNormal, total - minSub);
    }

    public static void main(String[] args) {
        int[][] tests = {{5, -2, 3, 4}, {10, 5, -5}, {-3, -2, -1}};
        for (int[] arr : tests) System.out.println(maxCircular(arr));
    }
}
```

```javascript filename:JavaScript
function kadane(arr) {
    let res = arr[0], maxEnding = arr[0];
    for (let i = 1; i < arr.length; i++) {
        maxEnding = Math.max(maxEnding + arr[i], arr[i]);
        res = Math.max(res, maxEnding);
    }
    return res;
}

function maxCircular(arr) {
    const maxNormal = kadane(arr);
    if (maxNormal < 0) return maxNormal;        // all negative: wrapping cannot help
    const total = arr.reduce((a, b) => a + b, 0);
    const minSub = -kadane(arr.map(x => -x));   // min subarray = -(max subarray of negated)
    return Math.max(maxNormal, total - minSub);
}

for (const arr of [[5, -2, 3, 4], [10, 5, -5], [-3, -2, -1]])
    console.log(maxCircular(arr));
```

```text filename:Output
12
15
-1
```

Time O(n) · Space O(n) for the negated copy — O(1) if you run a min-Kadane instead

> [!WARNING] Pitfall
>
> Without the all-negative check, `total - minSub` would be `0` (the empty complement) for `[-3, -2, -1]` and beat the correct `-1`.

# Majority element (Boyer–Moore voting)

A majority element appears <strong>more than </strong><strong>`n/2`</strong> times. Return it, or report that there is none.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [8, 3, 4, 8, 8]`<br><strong>Output:</strong> `8`<br><strong>Input:</strong> `arr = [3, 7, 4, 7, 7, 5]`<br><strong>Output:</strong> `none`<br><strong>Input:</strong> `arr = [2, 2, 1, 1, 1, 2, 2]`<br><strong>Output:</strong> `2`

Naively count every element with an inner loop — `O(n²)`. A hash map of counts gives `O(n)` time but `O(n)` space. Boyer–Moore does it in `O(1)` space.

> [!NOTE] Idea
>
> Keep a `candidate` and a `count`. Each equal element adds a vote, each different element cancels one; when the count reaches `0`, the next element becomes the candidate. A true majority has more votes than everything else combined, so it can never be cancelled out completely — it must be the final candidate. The candidate is only a <em>possibility</em> when no majority exists, so a second pass <strong>verifies</strong> its count.

```text filename:Voting%20on%20%5B8%2C%203%2C%204%2C%208%2C%208%5D
arr:        8   3   4   8   8
candidate:  8   8   4   4   8      count hits 0 after 3, 4 takes over, hits 0 after 8
count:      1   0   1   0   1
verify: 8 appears 3 times > 5/2 → majority
```

```python filename:Python
def majority(arr):
    n = len(arr)
    cand, count = arr[0], 1
    for i in range(1, n):                 # pass 1: find the only possible candidate
        if arr[i] == cand:
            count += 1
        else:
            count -= 1
        if count == 0:
            cand, count = arr[i], 1
    if arr.count(cand) > n // 2:          # pass 2: verify
        return str(cand)
    return "none"

for arr in ([8, 3, 4, 8, 8], [3, 7, 4, 7, 7, 5], [2, 2, 1, 1, 1, 2, 2]):
    print(majority(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <string>
using namespace std;

string majority(const vector<int>& arr) {
    int n = arr.size();
    int cand = arr[0], count = 1;
    for (int i = 1; i < n; i++) {                 // pass 1: find the only possible candidate
        if (arr[i] == cand) count++;
        else count--;
        if (count == 0) { cand = arr[i]; count = 1; }
    }
    int freq = 0;
    for (int x : arr) if (x == cand) freq++;      // pass 2: verify
    return freq > n / 2 ? to_string(cand) : "none";
}

int main() {
    vector<vector<int>> tests = {{8, 3, 4, 8, 8}, {3, 7, 4, 7, 7, 5}, {2, 2, 1, 1, 1, 2, 2}};
    for (auto& arr : tests) cout << majority(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static String majority(int[] arr) {
        int n = arr.length;
        int cand = arr[0], count = 1;
        for (int i = 1; i < n; i++) {                 // pass 1: find the only possible candidate
            if (arr[i] == cand) count++;
            else count--;
            if (count == 0) { cand = arr[i]; count = 1; }
        }
        int freq = 0;
        for (int x : arr) if (x == cand) freq++;      // pass 2: verify
        return freq > n / 2 ? String.valueOf(cand) : "none";
    }

    public static void main(String[] args) {
        int[][] tests = {{8, 3, 4, 8, 8}, {3, 7, 4, 7, 7, 5}, {2, 2, 1, 1, 1, 2, 2}};
        for (int[] arr : tests) System.out.println(majority(arr));
    }
}
```

```javascript filename:JavaScript
function majority(arr) {
    const n = arr.length;
    let cand = arr[0], count = 1;
    for (let i = 1; i < n; i++) {                 // pass 1: find the only possible candidate
        if (arr[i] === cand) count++;
        else count--;
        if (count === 0) { cand = arr[i]; count = 1; }
    }
    let freq = 0;
    for (const x of arr) if (x === cand) freq++;  // pass 2: verify
    return freq > Math.floor(n / 2) ? String(cand) : "none";
}

for (const arr of [[8, 3, 4, 8, 8], [3, 7, 4, 7, 7, 5], [2, 2, 1, 1, 1, 2, 2]])
    console.log(majority(arr));
```

```text filename:Output
8
none
2
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Skipping the verification pass returns a wrong answer for `[3, 7, 4, 7, 7, 5]` — the first pass ends with candidate `5`, which is not a majority. The original notes returned an <em>index</em> of the majority element; any index holding the value is acceptable, so these notes return the value.

# Minimum group flips to make a binary array uniform

A binary array has alternating <em>groups</em> of equal bits. Flip the fewest groups so that every element becomes the same, and print the groups to flip.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 1, 0, 0, 0, 1]`<br><strong>Output:</strong> `From 2 to 4`<br><strong>Input:</strong> `arr = [1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1]`<br><strong>Output:</strong> `From 1 to 3; From 5 to 6`<br><strong>Input:</strong> `arr = [1, 1, 1]`<br><strong>Output:</strong> `nothing to flip`<br><strong>Input:</strong> `arr = [0, 1]`<br><strong>Output:</strong> `From 1 to 1`

> [!NOTE] Idea
>
> Groups alternate `0,1,0,1,…`, so the number of `0`-groups and `1`-groups differ by at most one — and when they differ, the kind of the <strong>first</strong> group is the more frequent one. Therefore flipping every group that differs from `arr[0]` is always optimal, and it needs one pass: a group of the other kind starts when `arr[i] != arr[i-1]` and `arr[i] != arr[0]`, and ends just before the next change.

```text filename:Flip%20the%20groups%20that%20differ%20from%20the%20first%20element
index: 0 1 2 3 4 5 6 7 8 9 10
arr:   1 0 0 0 1 0 0 1 1 1 1
       ─ ───── ─ ─── ───────
groups:1   0   1  0     1        groups ≠ arr[0]: [1..3] and [5..6] → 2 flips
```

```python filename:Python
def group_flips(arr):
    n = len(arr)
    groups = []
    start = 0
    for i in range(1, n):
        if arr[i] != arr[i - 1]:               # a group boundary
            if arr[i] != arr[0]:
                start = i                      # a group of the other kind begins
            else:
                groups.append(f"From {start} to {i - 1}")   # ... and ends
    if arr[n - 1] != arr[0]:                   # last group was never closed
        groups.append(f"From {start} to {n - 1}")
    return "; ".join(groups) if groups else "nothing to flip"

for arr in ([1, 1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1], [1, 1, 1], [0, 1]):
    print(*arr, "->", group_flips(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <string>
using namespace std;

string groupFlips(const vector<int>& arr) {
    int n = arr.size();
    string res;
    int start = 0;
    auto add = [&](int a, int b) {
        if (!res.empty()) res += "; ";
        res += "From " + to_string(a) + " to " + to_string(b);
    };
    for (int i = 1; i < n; i++) {
        if (arr[i] != arr[i - 1]) {                // a group boundary
            if (arr[i] != arr[0]) start = i;       // a group of the other kind begins
            else add(start, i - 1);                // ... and ends
        }
    }
    if (arr[n - 1] != arr[0]) add(start, n - 1);   // last group was never closed
    return res.empty() ? "nothing to flip" : res;
}

int main() {
    vector<vector<int>> tests = {{1, 1, 0, 0, 0, 1}, {1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1}, {1, 1, 1}, {0, 1}};
    for (auto& arr : tests) {
        for (int x : arr) cout << x << " ";
        cout << "-> " << groupFlips(arr) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static String groupFlips(int[] arr) {
        int n = arr.length;
        StringBuilder res = new StringBuilder();
        int start = 0;
        for (int i = 1; i < n; i++) {
            if (arr[i] != arr[i - 1]) {                // a group boundary
                if (arr[i] != arr[0]) start = i;       // a group of the other kind begins
                else add(res, start, i - 1);           // ... and ends
            }
        }
        if (arr[n - 1] != arr[0]) add(res, start, n - 1);   // last group was never closed
        return res.length() == 0 ? "nothing to flip" : res.toString();
    }

    static void add(StringBuilder res, int a, int b) {
        if (res.length() > 0) res.append("; ");
        res.append("From ").append(a).append(" to ").append(b);
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 1, 0, 0, 0, 1}, {1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1}, {1, 1, 1}, {0, 1}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int x : arr) sb.append(x).append(' ');
            System.out.println(sb + "-> " + groupFlips(arr));
        }
    }
}
```

```javascript filename:JavaScript
function groupFlips(arr) {
    const n = arr.length;
    const groups = [];
    let start = 0;
    for (let i = 1; i < n; i++) {
        if (arr[i] !== arr[i - 1]) {               // a group boundary
            if (arr[i] !== arr[0]) start = i;      // a group of the other kind begins
            else groups.push(`From ${start} to ${i - 1}`);   // ... and ends
        }
    }
    if (arr[n - 1] !== arr[0]) groups.push(`From ${start} to ${n - 1}`);   // never closed
    return groups.length ? groups.join("; ") : "nothing to flip";
}

for (const arr of [[1, 1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1], [1, 1, 1], [0, 1]])
    console.log(arr.join(" ") + " -> " + groupFlips(arr));
```

```text filename:Output
1 1 0 0 0 1 -> From 2 to 4
1 0 0 0 1 0 0 1 1 1 1 -> From 1 to 3; From 5 to 6
1 1 1 -> nothing to flip
0 1 -> From 1 to 1
```

Time O(n) · Space O(1) besides the output

> [!WARNING] Pitfall
>
> Do not forget the check after the loop: when the array ends inside a group of the other kind (`[1, 1, 0, 0, 0]`) that group has no closing boundary. The original notes listed `From 0 to 0; From 1 to 1` for `[0, 1]` — flipping both groups is not minimal; one flip (`From 1 to 1`) suffices.

# Sliding window: maximum sum of k consecutive elements

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 8, 30, -5, 20, 7], k = 3`<br><strong>Output:</strong> `45`<br><strong>Input:</strong> `arr = [5, -10, 6, 90, 3], k = 2`<br><strong>Output:</strong> `96`

Naively sum each of the `n - k + 1` windows from scratch — `O(n · k)`:

```python filename:Python
def max_k_sum_naive(arr, k):
    res = float("-inf")
    for i in range(len(arr) - k + 1):
        curr = sum(arr[i:i + k])          # O(k) per window
        res = max(res, curr)
    return res

print(max_k_sum_naive([1, 8, 30, -5, 20, 7], 3))
```

```text filename:Output
45
```

> [!NOTE] Idea
>
> Consecutive windows overlap in `k - 1` elements. Sliding the window one step right <strong>adds </strong><strong>`arr[i]`</strong><strong> and removes </strong><strong>`arr[i-k]`</strong> — `O(1)` per step instead of `O(k)`.

```text filename:Each%20slide%20adds%20the%20entering%20element%20and%20subtracts%20the%20leaving%20one
arr:   1   8  30  -5  20   7      k = 3
      [1   8  30]                 39
          [8  30  -5]             39 + (-5) - 1  = 33
             [30  -5  20]         33 + 20  - 8  = 45  ← max
                 [-5  20   7]     45 + 7   - 30 = 22
```

```python filename:Python
def max_k_sum(arr, k):
    curr = sum(arr[:k])                  # first window
    res = curr
    for i in range(k, len(arr)):
        curr += arr[i] - arr[i - k]      # slide: add entering, drop leaving
        res = max(res, curr)
    return res

print(max_k_sum([1, 8, 30, -5, 20, 7], 3))
print(max_k_sum([5, -10, 6, 90, 3], 2))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxKSum(const vector<int>& arr, int k) {
    int n = arr.size();
    int curr = 0;
    for (int i = 0; i < k; i++) curr += arr[i];     // first window
    int res = curr;
    for (int i = k; i < n; i++) {
        curr += arr[i] - arr[i - k];                // slide: add entering, drop leaving
        res = max(res, curr);
    }
    return res;
}

int main() {
    cout << maxKSum({1, 8, 30, -5, 20, 7}, 3) << "\n";
    cout << maxKSum({5, -10, 6, 90, 3}, 2) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxKSum(int[] arr, int k) {
        int curr = 0;
        for (int i = 0; i < k; i++) curr += arr[i];     // first window
        int res = curr;
        for (int i = k; i < arr.length; i++) {
            curr += arr[i] - arr[i - k];                // slide: add entering, drop leaving
            res = Math.max(res, curr);
        }
        return res;
    }

    public static void main(String[] args) {
        System.out.println(maxKSum(new int[]{1, 8, 30, -5, 20, 7}, 3));
        System.out.println(maxKSum(new int[]{5, -10, 6, 90, 3}, 2));
    }
}
```

```javascript filename:JavaScript
function maxKSum(arr, k) {
    let curr = 0;
    for (let i = 0; i < k; i++) curr += arr[i];     // first window
    let res = curr;
    for (let i = k; i < arr.length; i++) {
        curr += arr[i] - arr[i - k];                // slide: add entering, drop leaving
        res = Math.max(res, curr);
    }
    return res;
}

console.log(maxKSum([1, 8, 30, -5, 20, 7], 3));
console.log(maxKSum([5, -10, 6, 90, 3], 2));
```

```text filename:Output
45
96
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> Fixed-size windows work for any associative, invertible aggregate (sum, count, XOR). For <em>maximum</em> in a window you need a monotonic deque instead — subtraction cannot undo a max.

# Subarray with given sum

Does a contiguous subarray of a <strong>non-negative</strong> array sum to exactly `target`?

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 4, 20, 3, 10, 15], target = 33`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `arr = [2, 4], target = 3`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `arr = [1, 4, 0, 0, 3, 10, 5], target = 7`<br><strong>Output:</strong> `Yes`

Naively try every start and extend — `O(n²)`:

```python filename:Python
def has_sum_naive(arr, target):
    for i in range(len(arr)):
        curr = 0
        for j in range(i, len(arr)):
            curr += arr[j]
            if curr == target:
                return True
    return False

print("Yes" if has_sum_naive([1, 4, 20, 3, 10, 15], 33) else "No")
```

```text filename:Output
Yes
```

> [!NOTE] Idea
>
> <strong>Variable-size sliding window (two pointers).</strong> Keep a window `[s, i]` and its sum. Extend `i` every step; while the sum exceeds `target`, shrink from the left by advancing `s`. Because the elements are non-negative, shrinking only ever decreases the sum, so no candidate is skipped. Both pointers move only forward: `O(n)`.

```python filename:Python
def has_sum(arr, target):
    s = 0
    curr = 0
    for i in range(len(arr)):
        curr += arr[i]                   # grow at the right
        while curr > target and s < i:   # shrink at the left while too big
            curr -= arr[s]
            s += 1
        if curr == target:
            return True
    return False

for arr, target in (([1, 4, 20, 3, 10, 15], 33), ([2, 4], 3), ([1, 4, 0, 0, 3, 10, 5], 7)):
    print("Yes" if has_sum(arr, target) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool hasSum(const vector<int>& arr, int target) {
    int n = arr.size();
    int s = 0, curr = 0;
    for (int i = 0; i < n; i++) {
        curr += arr[i];                          // grow at the right
        while (curr > target && s < i) {         // shrink at the left while too big
            curr -= arr[s];
            s++;
        }
        if (curr == target) return true;
    }
    return false;
}

int main() {
    cout << (hasSum({1, 4, 20, 3, 10, 15}, 33) ? "Yes" : "No") << "\n";
    cout << (hasSum({2, 4}, 3) ? "Yes" : "No") << "\n";
    cout << (hasSum({1, 4, 0, 0, 3, 10, 5}, 7) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean hasSum(int[] arr, int target) {
        int s = 0, curr = 0;
        for (int i = 0; i < arr.length; i++) {
            curr += arr[i];                          // grow at the right
            while (curr > target && s < i) {         // shrink at the left while too big
                curr -= arr[s];
                s++;
            }
            if (curr == target) return true;
        }
        return false;
    }

    public static void main(String[] args) {
        System.out.println(hasSum(new int[]{1, 4, 20, 3, 10, 15}, 33) ? "Yes" : "No");
        System.out.println(hasSum(new int[]{2, 4}, 3) ? "Yes" : "No");
        System.out.println(hasSum(new int[]{1, 4, 0, 0, 3, 10, 5}, 7) ? "Yes" : "No");
    }
}
```

```javascript filename:JavaScript
function hasSum(arr, target) {
    let s = 0, curr = 0;
    for (let i = 0; i < arr.length; i++) {
        curr += arr[i];                          // grow at the right
        while (curr > target && s < i) {         // shrink at the left while too big
            curr -= arr[s];
            s++;
        }
        if (curr === target) return true;
    }
    return false;
}

console.log(hasSum([1, 4, 20, 3, 10, 15], 33) ? "Yes" : "No");
console.log(hasSum([2, 4], 3) ? "Yes" : "No");
console.log(hasSum([1, 4, 0, 0, 3, 10, 5], 7) ? "Yes" : "No");
```

```text filename:Output
Yes
No
Yes
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Two pointers rely on <strong>non-negative</strong> elements. With negatives, shrinking the window can increase the sum and the window can skip a valid answer. Use prefix sums with a hash set instead: a subarray ending at `i` sums to `target` exactly when `prefix[i] - target` was an earlier prefix sum.

```python filename:Python
def has_sum(arr, target):
    seen = {0}                           # prefix sums seen so far (empty prefix = 0)
    curr = 0
    for x in arr:
        curr += x
        if curr - target in seen:        # some earlier prefix leaves exactly target
            return True
        seen.add(curr)
    return False

for arr, target in (([1, 4, 20, 3, 10, 15], 33), ([2, 4], 3),
                    ([1, 4, 0, 0, 3, 10, 5], 7), ([10, 2, -2, -20, 10], -10)):
    print("Yes" if has_sum(arr, target) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <unordered_set>
using namespace std;

bool hasSum(const vector<int>& arr, int target) {
    unordered_set<int> seen = {0};           // prefix sums seen so far (empty prefix = 0)
    int curr = 0;
    for (int x : arr) {
        curr += x;
        if (seen.count(curr - target)) return true;   // an earlier prefix leaves exactly target
        seen.insert(curr);
    }
    return false;
}

int main() {
    cout << (hasSum({1, 4, 20, 3, 10, 15}, 33) ? "Yes" : "No") << "\n";
    cout << (hasSum({2, 4}, 3) ? "Yes" : "No") << "\n";
    cout << (hasSum({1, 4, 0, 0, 3, 10, 5}, 7) ? "Yes" : "No") << "\n";
    cout << (hasSum({10, 2, -2, -20, 10}, -10) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static boolean hasSum(int[] arr, int target) {
        Set<Integer> seen = new HashSet<>();     // prefix sums seen so far
        seen.add(0);                             // the empty prefix
        int curr = 0;
        for (int x : arr) {
            curr += x;
            if (seen.contains(curr - target)) return true;   // an earlier prefix leaves exactly target
            seen.add(curr);
        }
        return false;
    }

    public static void main(String[] args) {
        System.out.println(hasSum(new int[]{1, 4, 20, 3, 10, 15}, 33) ? "Yes" : "No");
        System.out.println(hasSum(new int[]{2, 4}, 3) ? "Yes" : "No");
        System.out.println(hasSum(new int[]{1, 4, 0, 0, 3, 10, 5}, 7) ? "Yes" : "No");
        System.out.println(hasSum(new int[]{10, 2, -2, -20, 10}, -10) ? "Yes" : "No");
    }
}
```

```javascript filename:JavaScript
function hasSum(arr, target) {
    const seen = new Set([0]);               // prefix sums seen so far (empty prefix = 0)
    let curr = 0;
    for (const x of arr) {
        curr += x;
        if (seen.has(curr - target)) return true;   // an earlier prefix leaves exactly target
        seen.add(curr);
    }
    return false;
}

console.log(hasSum([1, 4, 20, 3, 10, 15], 33) ? "Yes" : "No");
console.log(hasSum([2, 4], 3) ? "Yes" : "No");
console.log(hasSum([1, 4, 0, 0, 3, 10, 5], 7) ? "Yes" : "No");
console.log(hasSum([10, 2, -2, -20, 10], -10) ? "Yes" : "No");
```

```text filename:Output
Yes
No
Yes
Yes
```

Time O(n) · Space O(n)

# Prefix sum technique: range sum queries

Given a fixed array and <strong>many</strong> queries `getSum(l, r)`, answer each in `O(1)` after a one-time `O(n)` preprocessing.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 8, 3, 9, 6, 5, 4]; getSum(0, 2), getSum(1, 3), getSum(2, 6)`<br><strong>Output:</strong> `13 20 27`

Answering each query by adding `arr[l..r]` costs `O(r - l + 1)` — `O(n)` per query, `O(n · q)` for `q` queries.

> [!NOTE] Idea
>
> Precompute `psum[i] = arr[0] + … + arr[i]`. Then `sum(l..r) = psum[r] - psum[l-1]`, with `psum[r]` alone when `l == 0`. Storing one extra leading zero (`psum[i]` = sum of the first `i` elements) removes that special case: `sum(l..r) = psum[r+1] - psum[l]`.

```text filename:Prefix%20sums%3A%20a%20range%20sum%20is%20one%20subtraction
index:   0   1   2   3   4   5   6
arr:     2   8   3   9   6   5   4
psum:    2  10  13  22  28  33  37        getSum(2, 6) = psum[6] - psum[1] = 37 - 10 = 27
```

```python filename:Python
def build_prefix(arr):
    psum = [0] * (len(arr) + 1)          # psum[i] = sum of arr[0..i-1]
    for i, x in enumerate(arr):
        psum[i + 1] = psum[i] + x
    return psum

def get_sum(psum, l, r):                 # inclusive l..r
    return psum[r + 1] - psum[l]

psum = build_prefix([2, 8, 3, 9, 6, 5, 4])
for l, r in ((0, 2), (1, 3), (2, 6)):
    print(get_sum(psum, l, r))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> buildPrefix(const vector<int>& arr) {
    int n = arr.size();
    vector<int> psum(n + 1, 0);              // psum[i] = sum of arr[0..i-1]
    for (int i = 0; i < n; i++) psum[i + 1] = psum[i] + arr[i];
    return psum;
}

int getSum(const vector<int>& psum, int l, int r) {   // inclusive l..r
    return psum[r + 1] - psum[l];
}

int main() {
    vector<int> psum = buildPrefix({2, 8, 3, 9, 6, 5, 4});
    cout << getSum(psum, 0, 2) << "\n";
    cout << getSum(psum, 1, 3) << "\n";
    cout << getSum(psum, 2, 6) << "\n";
}
```

```java filename:Java
public class Main {
    static int[] buildPrefix(int[] arr) {
        int[] psum = new int[arr.length + 1];     // psum[i] = sum of arr[0..i-1]
        for (int i = 0; i < arr.length; i++) psum[i + 1] = psum[i] + arr[i];
        return psum;
    }

    static int getSum(int[] psum, int l, int r) {    // inclusive l..r
        return psum[r + 1] - psum[l];
    }

    public static void main(String[] args) {
        int[] psum = buildPrefix(new int[]{2, 8, 3, 9, 6, 5, 4});
        System.out.println(getSum(psum, 0, 2));
        System.out.println(getSum(psum, 1, 3));
        System.out.println(getSum(psum, 2, 6));
    }
}
```

```javascript filename:JavaScript
function buildPrefix(arr) {
    const psum = new Array(arr.length + 1).fill(0);   // psum[i] = sum of arr[0..i-1]
    for (let i = 0; i < arr.length; i++) psum[i + 1] = psum[i] + arr[i];
    return psum;
}

function getSum(psum, l, r) {                        // inclusive l..r
    return psum[r + 1] - psum[l];
}

const psum = buildPrefix([2, 8, 3, 9, 6, 5, 4]);
console.log(getSum(psum, 0, 2));
console.log(getSum(psum, 1, 3));
console.log(getSum(psum, 2, 6));
```

```text filename:Output
13
20
27
```

Time O(n) preprocessing, O(1) per query · Space O(n)

<strong>Weighted range sum.</strong> The same trick answers `sum of (i - l) · arr[i]` for `i` in `l..r` — each element weighted by its offset inside the range. Keep a second prefix array `W[i] = sum of i · arr[i]`; then `sum(i · arr[i]) - l · sum(arr[i])` over the range is two subtractions.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 3, 4, 5]; weighted(0, 2) = 0·1 + 1·2 + 2·3`<br><strong>Output:</strong> `8`<br><strong>Input:</strong> `weighted(1, 3) = 0·2 + 1·3 + 2·4`<br><strong>Output:</strong> `11`

```python filename:Python
def preprocess(arr):
    n = len(arr)
    P = [0] * (n + 1)                    # P[i] = sum of arr[0..i-1]
    W = [0] * (n + 1)                    # W[i] = sum of k * arr[k] for k < i
    for i, x in enumerate(arr):
        P[i + 1] = P[i] + x
        W[i + 1] = W[i] + i * x
    return P, W

def weighted_sum(P, W, l, r):            # sum of (i - l) * arr[i], i in l..r
    return (W[r + 1] - W[l]) - l * (P[r + 1] - P[l])

P, W = preprocess([1, 2, 3, 4, 5])
print(weighted_sum(P, W, 0, 2))
print(weighted_sum(P, W, 1, 3))
```

```text filename:Output
8
11
```

Time O(n) preprocessing, O(1) per query · Space O(n)

> [!WARNING] Pitfall
>
> Prefix sums overflow 32-bit integers quickly (`10⁵` elements of `10⁵` already exceed `2³¹`). Use `long long` / `long` in C++ and Java; Python and JavaScript numbers are safe up to `2⁵³` in JS and unbounded in Python.

# Equilibrium point

An index `i` is an equilibrium point when the sum of elements before it equals the sum after it. Return the first such index, or `-1`.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 4, 8, -9, 20, 6]`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `arr = [4, 2, -2]`<br><strong>Output:</strong> `0`<br><strong>Input:</strong> `arr = [4, 2, 2]`<br><strong>Output:</strong> `-1`

Naively compute left and right sums for every `i` — `O(n²)`:

```python filename:Python
def equilibrium_naive(arr):
    n = len(arr)
    for i in range(n):
        if sum(arr[:i]) == sum(arr[i + 1:]):   # two O(n) sums per index
            return i
    return -1

print(equilibrium_naive([3, 4, 8, -9, 20, 6]))
```

```text filename:Output
4
```

> [!NOTE] Idea
>
> `rightSum = total - leftSum - arr[i]`, so one running `leftSum` is enough: compute `total` once, then walk left to right subtracting the current element from the right sum and adding it to the left sum. A prefix sum without storing the array.

```python filename:Python
def equilibrium(arr):
    right = sum(arr)                     # everything is to the right at first
    left = 0
    for i, x in enumerate(arr):
        right -= x                       # arr[i] leaves the right side
        if left == right:
            return i
        left += x                        # ... and joins the left side
    return -1

for arr in ([3, 4, 8, -9, 20, 6], [4, 2, -2], [4, 2, 2]):
    print(equilibrium(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int equilibrium(const vector<int>& arr) {
    int n = arr.size();
    int right = 0, left = 0;
    for (int x : arr) right += x;            // everything is to the right at first
    for (int i = 0; i < n; i++) {
        right -= arr[i];                     // arr[i] leaves the right side
        if (left == right) return i;
        left += arr[i];                      // ... and joins the left side
    }
    return -1;
}

int main() {
    vector<vector<int>> tests = {{3, 4, 8, -9, 20, 6}, {4, 2, -2}, {4, 2, 2}};
    for (auto& arr : tests) cout << equilibrium(arr) << "\n";
}
```

```java filename:Java
public class Main {
    static int equilibrium(int[] arr) {
        int right = 0, left = 0;
        for (int x : arr) right += x;            // everything is to the right at first
        for (int i = 0; i < arr.length; i++) {
            right -= arr[i];                     // arr[i] leaves the right side
            if (left == right) return i;
            left += arr[i];                      // ... and joins the left side
        }
        return -1;
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 4, 8, -9, 20, 6}, {4, 2, -2}, {4, 2, 2}};
        for (int[] arr : tests) System.out.println(equilibrium(arr));
    }
}
```

```javascript filename:JavaScript
function equilibrium(arr) {
    let right = arr.reduce((a, b) => a + b, 0);  // everything is to the right at first
    let left = 0;
    for (let i = 0; i < arr.length; i++) {
        right -= arr[i];                         // arr[i] leaves the right side
        if (left === right) return i;
        left += arr[i];                          // ... and joins the left side
    }
    return -1;
}

for (const arr of [[3, 4, 8, -9, 20, 6], [4, 2, -2], [4, 2, 2]])
    console.log(equilibrium(arr));
```

```text filename:Output
4
0
-1
```

Time O(n) · Space O(1)

<strong>Variant: partition into three parts with equal sum.</strong> If `total % 3 != 0` it is impossible. Otherwise scan once, accumulating a running sum and cutting a part whenever it reaches `total / 3`; three or more cuts mean a valid partition (extra cuts happen only when `total / 3 == 0`, and then merging the extra parts keeps every sum equal).

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 3, 0, 3]`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `arr = [0, 2, 1, -6, 6, -7, 9, 1, 2, 0, 1]`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `arr = [1, 2, 3]`<br><strong>Output:</strong> `false`

```python filename:Python
def three_equal_parts(arr):
    total = sum(arr)
    if total % 3 != 0:
        return False
    target = total // 3
    curr = parts = 0
    for x in arr:
        curr += x
        if curr == target:               # close a part, start the next one
            parts += 1
            curr = 0
    return parts >= 3

for arr in ([1, 2, 3, 0, 3], [0, 2, 1, -6, 6, -7, 9, 1, 2, 0, 1], [1, 2, 3]):
    print("true" if three_equal_parts(arr) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool threeEqualParts(const vector<int>& arr) {
    int total = 0;
    for (int x : arr) total += x;
    if (total % 3 != 0) return false;
    int target = total / 3, curr = 0, parts = 0;
    for (int x : arr) {
        curr += x;
        if (curr == target) { parts++; curr = 0; }   // close a part, start the next one
    }
    return parts >= 3;
}

int main() {
    vector<vector<int>> tests = {{1, 2, 3, 0, 3}, {0, 2, 1, -6, 6, -7, 9, 1, 2, 0, 1}, {1, 2, 3}};
    for (auto& arr : tests) cout << (threeEqualParts(arr) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean threeEqualParts(int[] arr) {
        int total = 0;
        for (int x : arr) total += x;
        if (total % 3 != 0) return false;
        int target = total / 3, curr = 0, parts = 0;
        for (int x : arr) {
            curr += x;
            if (curr == target) { parts++; curr = 0; }   // close a part, start the next one
        }
        return parts >= 3;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 2, 3, 0, 3}, {0, 2, 1, -6, 6, -7, 9, 1, 2, 0, 1}, {1, 2, 3}};
        for (int[] arr : tests) System.out.println(threeEqualParts(arr));
    }
}
```

```javascript filename:JavaScript
function threeEqualParts(arr) {
    const total = arr.reduce((a, b) => a + b, 0);
    if (total % 3 !== 0) return false;
    const target = total / 3;
    let curr = 0, parts = 0;
    for (const x of arr) {
        curr += x;
        if (curr === target) { parts++; curr = 0; }   // close a part, start the next one
    }
    return parts >= 3;
}

for (const arr of [[1, 2, 3, 0, 3], [0, 2, 1, -6, 6, -7, 9, 1, 2, 0, 1], [1, 2, 3]])
    console.log(threeEqualParts(arr));
```

```text filename:Output
true
true
false
```

Time O(n) · Space O(1)

# Maximum appearing element in ranges

Given `left[i]..right[i]` ranges over small integers (`0 ≤ left[i] ≤ right[i] < 100`), find the number that lies in the most ranges.

> [!TIP] Example
>
> <strong>Input:</strong> `left = [1, 2, 5, 15], right = [5, 8, 7, 18]`<br><strong>Output:</strong> `5`<br><strong>Input:</strong> `left = [1, 4, 3, 1], right = [15, 8, 5, 4]`<br><strong>Output:</strong> `4`

Naively walk every range and increment a frequency counter for each number inside it — `O(n · range length)`, up to `O(100 · n)`:

```python filename:Python
def max_appearing_naive(left, right):
    freq = [0] * 100
    for l, r in zip(left, right):
        for x in range(l, r + 1):            # touch every number in the range
            freq[x] += 1
    return freq.index(max(freq))

print(max_appearing_naive([1, 2, 5, 15], [5, 8, 7, 18]))
```

```text filename:Output
5
```

> [!NOTE] Idea
>
> <strong>Difference array.</strong> Mark only the two ends of each range: `freq[left] += 1` and `freq[right + 1] -= 1`. A prefix sum over `freq` then yields, for every number, how many ranges contain it — each range costs `O(1)` instead of `O(length)`.

```text filename:Difference%20array%20%2B%20prefix%20sum%20%3D%20coverage%20count
ranges:  [1..5]  [2..8]  [5..7]  [15..18]
index:    0  1  2  3  4  5  6  7  8  9 ... 15 16 17 18 19
marks:    0 +1 +1  0  0 +1 -1  0 -1 -1 ... +1  0  0  0 -1
prefix:   0  1  2  2  2  3  2  2  1  0 ...  1  1  1  1  0      ← max 3 at index 5
```

```python filename:Python
def max_appearing(left, right):
    freq = [0] * 101                         # one extra slot for right + 1
    for l, r in zip(left, right):
        freq[l] += 1                         # range starts here
        freq[r + 1] -= 1                     # ... and stops after r
    best, res = freq[0], 0
    for i in range(1, 100):
        freq[i] += freq[i - 1]               # prefix sum → coverage count
        if freq[i] > best:
            best, res = freq[i], i
    return res

print(max_appearing([1, 2, 5, 15], [5, 8, 7, 18]))
print(max_appearing([1, 4, 3, 1], [15, 8, 5, 4]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int maxAppearing(const vector<int>& left, const vector<int>& right) {
    int n = left.size();
    vector<int> freq(101, 0);                    // one extra slot for right + 1
    for (int i = 0; i < n; i++) {
        freq[left[i]]++;                         // range starts here
        freq[right[i] + 1]--;                    // ... and stops after right
    }
    int best = freq[0], res = 0;
    for (int i = 1; i < 100; i++) {
        freq[i] += freq[i - 1];                  // prefix sum → coverage count
        if (freq[i] > best) { best = freq[i]; res = i; }
    }
    return res;
}

int main() {
    cout << maxAppearing({1, 2, 5, 15}, {5, 8, 7, 18}) << "\n";
    cout << maxAppearing({1, 4, 3, 1}, {15, 8, 5, 4}) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxAppearing(int[] left, int[] right) {
        int[] freq = new int[101];                   // one extra slot for right + 1
        for (int i = 0; i < left.length; i++) {
            freq[left[i]]++;                         // range starts here
            freq[right[i] + 1]--;                    // ... and stops after right
        }
        int best = freq[0], res = 0;
        for (int i = 1; i < 100; i++) {
            freq[i] += freq[i - 1];                  // prefix sum → coverage count
            if (freq[i] > best) { best = freq[i]; res = i; }
        }
        return res;
    }

    public static void main(String[] args) {
        System.out.println(maxAppearing(new int[]{1, 2, 5, 15}, new int[]{5, 8, 7, 18}));
        System.out.println(maxAppearing(new int[]{1, 4, 3, 1}, new int[]{15, 8, 5, 4}));
    }
}
```

```javascript filename:JavaScript
function maxAppearing(left, right) {
    const freq = new Array(101).fill(0);         // one extra slot for right + 1
    for (let i = 0; i < left.length; i++) {
        freq[left[i]]++;                         // range starts here
        freq[right[i] + 1]--;                    // ... and stops after right
    }
    let best = freq[0], res = 0;
    for (let i = 1; i < 100; i++) {
        freq[i] += freq[i - 1];                  // prefix sum → coverage count
        if (freq[i] > best) { best = freq[i]; res = i; }
    }
    return res;
}

console.log(maxAppearing([1, 2, 5, 15], [5, 8, 7, 18]));
console.log(maxAppearing([1, 4, 3, 1], [15, 8, 5, 4]));
```

```text filename:Output
5
4
```

Time O(n + 100) · Space O(100)

> [!NOTE] Key point
>
> The difference array is the inverse of the prefix sum: a prefix sum turns point marks into range counts, so a `+1 / -1` pair applies `+1` to a whole range for `O(1)`. It handles `q` range <em>updates</em> followed by one read-out in `O(n + q)`.

# Interview Q&amp;A

```question
Why are so many array problems O(n²) naively, and what do the efficient versions have in common?

---

The naive solutions enumerate pairs `(i, j)` or restart a scan from every index. The efficient versions carry a summary of the prefix already seen — the running minimum (maximum difference), the best subarray ending here (Kadane), the prefix sum (range queries, equilibrium), the window sum (sliding window) — so each new element is processed in `O(1)` using that summary.
```

```question
Explain Kadane's algorithm and why restarting at a negative running sum is safe.

---

`maxEnding[i] = max(maxEnding[i-1] + arr[i], arr[i])`. If `maxEnding[i-1]` is negative, prepending it to any subarray starting at `i` can only lower the sum, so the best subarray ending at `i` is `arr[i]` alone. The overall answer is `max` over all `maxEnding[i]`. Initialise with `arr[0]`, not `0`, so an all-negative array returns its largest element.
```

```question
When do two pointers / sliding window fail, and what replaces them?

---

They need monotonic behaviour: growing the window must never decrease the quantity and shrinking must never increase it. Non-negative sums have that property; arrays with negatives do not. Replace with prefix sums plus a hash set/map (`prefix[i] - target` seen before?), which also counts the subarrays in `O(n)`.
```

```question
How does Boyer–Moore voting find the majority in O(1) space, and why is the second pass needed?

---

Pair every candidate element with a different element and cancel both. A majority element has more copies than all other elements together, so after all cancellations some copies of it remain — it is the surviving candidate. If no majority exists, the survivor is arbitrary, so a second pass counts the candidate and rejects it unless its count exceeds `n/2`.
```

```question
What is a difference array and when would you use one?

---

An array `d` where `d[l] += v` and `d[r+1] -= v` encodes 'add `v` to every element of `l..r`'. One prefix sum over `d` materialises all updates. It turns `q` range updates with one final read into `O(n + q)` instead of `O(n · q)` — the maximum-appearing-element problem is exactly this with `v = 1`.
```

```question
How do you rotate an array in place in O(n) time?

---

The reversal algorithm: reverse `arr[0..d-1]`, reverse `arr[d..n-1]`, reverse the whole array. Each element moves a constant number of times and no extra array is needed. Alternatives: the juggling algorithm (move elements in `gcd(n, d)` cycles), or in Python `collections.deque.rotate` — simple but `O(n)` extra space.
```
