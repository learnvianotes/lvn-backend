---
id: a70c2fa3-9b02-7118-9047-db1a7877e2d8
key: topic:dsa-basics/searching
subject: dsa-basics
topic: searching
title: Searching
slug: searching
order: 1
---

Searching is finding <strong>where</strong> (or whether) a value lives in a collection. Linear search works on anything in `O(n)`; binary search needs sorted data and answers in `O(log n)` — and the same halving trick solves a whole family of problems: first/last occurrence, counting, square roots, peaks.

> [!INFO]
>
> <strong>Searching</strong> — given a collection and a <em>key</em> `x`, return the index of an element equal to `x` (or `-1` / <em>not found</em>). The two fundamental strategies are <strong>linear search</strong> (look at every element) and <strong>binary search</strong> (halve a <em>sorted</em> range each step).

# Linear search vs binary search

|  | Linear search | Binary search |
| --- | --- | --- |
| Requirement | none — any order, any container | data <strong>sorted</strong> (and random access, e.g. an array) |
| Best case | `O(1)` — first element | `O(1)` — middle element |
| Average / worst | `O(n)` | `O(log n)` |
| Comparisons for n = 1,000,000 | up to 1,000,000 | at most 20 |
| Space | `O(1)` | `O(1)` iterative · `O(log n)` recursive (call stack) |
| Works on linked lists? | yes | no — no `O(1)` jump to the middle |
| Use when | data is unsorted or tiny, or you search once | data is sorted and searched many times |

> [!NOTE] Key point
>
> Sorting an unsorted array just to binary-search it <strong>once</strong> costs `O(n log n)` — more than the `O(n)` linear search. Binary search pays off when the array is already sorted or is queried repeatedly.

# Linear search

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40, 50], x = 30`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [10, 20, 30, 40, 50], x = 35`<br><strong>Output:</strong> `-1`

> [!NOTE] Idea
>
> Walk the array from left to right and stop at the first element equal to `x`. Nothing is assumed about the order, so this is the only option for unsorted data.

```python filename:Python
def linear_search(arr, x):
    for i in range(len(arr)):
        if arr[i] == x:          # first match wins
            return i
    return -1

arr = [10, 20, 30, 40, 50]
print("index of 30:", linear_search(arr, 30))
print("index of 35:", linear_search(arr, 35))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int linearSearch(const vector<int>& arr, int x) {
    int n = arr.size();
    for (int i = 0; i < n; i++)
        if (arr[i] == x) return i;   // first match wins
    return -1;
}

int main() {
    vector<int> arr = {10, 20, 30, 40, 50};
    cout << "index of 30: " << linearSearch(arr, 30) << "\n";
    cout << "index of 35: " << linearSearch(arr, 35) << "\n";
}
```

```java filename:Java
public class Main {
    static int linearSearch(int[] arr, int x) {
        for (int i = 0; i < arr.length; i++)
            if (arr[i] == x) return i;   // first match wins
        return -1;
    }

    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40, 50};
        System.out.println("index of 30: " + linearSearch(arr, 30));
        System.out.println("index of 35: " + linearSearch(arr, 35));
    }
}
```

```javascript filename:JavaScript
function linearSearch(arr, x) {
    for (let i = 0; i < arr.length; i++)
        if (arr[i] === x) return i;      // first match wins
    return -1;
}

const arr = [10, 20, 30, 40, 50];
console.log("index of 30:", linearSearch(arr, 30));
console.log("index of 35:", linearSearch(arr, 35));
```

```text filename:Output
index of 30: 2
index of 35: -1
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> Every language has this built in: Python `arr.index(x)` / `x in arr`, C++ `std::find`, Java `List.indexOf`, JavaScript `arr.indexOf(x)` / `arr.includes(x)`. They are all linear scans.

# Binary search

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40, 50, 60], x = 40`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `arr = [10, 20, 30, 40, 50, 60], x = 25`<br><strong>Output:</strong> `-1`

> [!NOTE] Idea
>
> Because the array is sorted, comparing `x` with the <strong>middle</strong> element tells you which half can contain it — the other half is discarded without looking at it. Each step halves the search range, so `n` elements need only about `log2 n` steps.

```text filename:Binary%20search%20for%2040%3A%20the%20range%20shrinks%206%20%E2%86%92%203%20%E2%86%92%201
x = 40          index:  0    1    2    3    4    5
                      [10,  20,  30,  40,  50,  60]
step 1  low=0 high=5    ^         mid=2 (30) < 40  →  low = mid + 1
step 2  low=3 high=5                   ^    mid=4 (50) > 40  →  high = mid - 1
step 3  low=3 high=3                   mid=3 (40) == 40  →  found at 3
```

1. <strong>Set the range</strong>

   `low = 0`, `high = n - 1` — the key, if present, is inside `arr[low..high]`.

2. <strong>Look at the middle</strong>

   `mid = low + (high - low) // 2`. If `arr[mid] == x` — done.

3. <strong>Discard a half</strong>

   `arr[mid] < x` → `x` can only be to the right: `low = mid + 1`. `arr[mid] > x` → `high = mid - 1`.

4. <strong>Stop when the range is empty</strong>

   `low > high` means no element can equal `x` → return `-1`.

```python filename:Python
def binary_search(arr, x):
    low, high = 0, len(arr) - 1
    while low <= high:                   # range arr[low..high] is non-empty
        mid = low + (high - low) // 2    # never overflows (matters in C++/Java)
        if arr[mid] == x:
            return mid
        elif arr[mid] < x:
            low = mid + 1                # x is in the right half
        else:
            high = mid - 1               # x is in the left half
    return -1

arr = [10, 20, 30, 40, 50, 60]
print("index of 40:", binary_search(arr, 40))
print("index of 25:", binary_search(arr, 25))
print("index of 10:", binary_search(arr, 10))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& arr, int x) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {                  // range arr[low..high] is non-empty
        int mid = low + (high - low) / 2;  // never overflows, unlike (low + high) / 2
        if (arr[mid] == x) return mid;
        else if (arr[mid] < x) low = mid + 1;    // x is in the right half
        else high = mid - 1;                     // x is in the left half
    }
    return -1;
}

int main() {
    vector<int> arr = {10, 20, 30, 40, 50, 60};
    cout << "index of 40: " << binarySearch(arr, 40) << "\n";
    cout << "index of 25: " << binarySearch(arr, 25) << "\n";
    cout << "index of 10: " << binarySearch(arr, 10) << "\n";
}
```

```java filename:Java
public class Main {
    static int binarySearch(int[] arr, int x) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {                  // range arr[low..high] is non-empty
            int mid = low + (high - low) / 2;  // never overflows, unlike (low + high) / 2
            if (arr[mid] == x) return mid;
            else if (arr[mid] < x) low = mid + 1;    // x is in the right half
            else high = mid - 1;                     // x is in the left half
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40, 50, 60};
        System.out.println("index of 40: " + binarySearch(arr, 40));
        System.out.println("index of 25: " + binarySearch(arr, 25));
        System.out.println("index of 10: " + binarySearch(arr, 10));
    }
}
```

```javascript filename:JavaScript
function binarySearch(arr, x) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {                              // range arr[low..high] is non-empty
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] === x) return mid;
        else if (arr[mid] < x) low = mid + 1;          // x is in the right half
        else high = mid - 1;                           // x is in the left half
    }
    return -1;
}

const arr = [10, 20, 30, 40, 50, 60];
console.log("index of 40:", binarySearch(arr, 40));
console.log("index of 25:", binarySearch(arr, 25));
console.log("index of 10:", binarySearch(arr, 10));
```

```text filename:Output
index of 40: 3
index of 25: -1
index of 10: 0
```

Time O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> `mid = (low + high) / 2` overflows a 32-bit `int` in C++/Java when `low + high > 2^31 - 1` (arrays of a billion elements — this was a real bug in the JDK for nine years). Always write `low + (high - low) / 2`. In JavaScript use `Math.floor` — `/` gives a fractional index.

> [!WARNING] Pitfall
>
> Off-by-one loops. The loop condition is `low <= high` (not `<`), and the updates must be `mid + 1` / `mid - 1` — using `low = mid` can loop forever when `low == high - 1`.

# Binary search, recursive

The same algorithm expressed with recursion: the function searches `arr[low..high]` and calls itself on one half. It is <em>tail recursive</em> — the recursive call is the last thing done — so many compilers turn it into the loop above; Python does not, and it uses one stack frame per halving.

```python filename:Python
def binary_search(arr, x, low, high):
    if low > high:                        # empty range: not found
        return -1
    mid = low + (high - low) // 2
    if arr[mid] == x:
        return mid
    if arr[mid] < x:
        return binary_search(arr, x, mid + 1, high)   # right half
    return binary_search(arr, x, low, mid - 1)        # left half

arr = [10, 20, 30, 40, 50, 60]
n = len(arr)
print("index of 50:", binary_search(arr, 50, 0, n - 1))
print("index of 10:", binary_search(arr, 10, 0, n - 1))
print("index of 55:", binary_search(arr, 55, 0, n - 1))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& arr, int x, int low, int high) {
    if (low > high) return -1;            // empty range: not found
    int mid = low + (high - low) / 2;
    if (arr[mid] == x) return mid;
    if (arr[mid] < x) return binarySearch(arr, x, mid + 1, high);   // right half
    return binarySearch(arr, x, low, mid - 1);                      // left half
}

int main() {
    vector<int> arr = {10, 20, 30, 40, 50, 60};
    int n = arr.size();
    cout << "index of 50: " << binarySearch(arr, 50, 0, n - 1) << "\n";
    cout << "index of 10: " << binarySearch(arr, 10, 0, n - 1) << "\n";
    cout << "index of 55: " << binarySearch(arr, 55, 0, n - 1) << "\n";
}
```

```java filename:Java
public class Main {
    static int binarySearch(int[] arr, int x, int low, int high) {
        if (low > high) return -1;            // empty range: not found
        int mid = low + (high - low) / 2;
        if (arr[mid] == x) return mid;
        if (arr[mid] < x) return binarySearch(arr, x, mid + 1, high);   // right half
        return binarySearch(arr, x, low, mid - 1);                      // left half
    }

    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40, 50, 60};
        int n = arr.length;
        System.out.println("index of 50: " + binarySearch(arr, 50, 0, n - 1));
        System.out.println("index of 10: " + binarySearch(arr, 10, 0, n - 1));
        System.out.println("index of 55: " + binarySearch(arr, 55, 0, n - 1));
    }
}
```

```javascript filename:JavaScript
function binarySearch(arr, x, low, high) {
    if (low > high) return -1;                // empty range: not found
    const mid = low + Math.floor((high - low) / 2);
    if (arr[mid] === x) return mid;
    if (arr[mid] < x) return binarySearch(arr, x, mid + 1, high);   // right half
    return binarySearch(arr, x, low, mid - 1);                      // left half
}

const arr = [10, 20, 30, 40, 50, 60];
const n = arr.length;
console.log("index of 50:", binarySearch(arr, 50, 0, n - 1));
console.log("index of 10:", binarySearch(arr, 10, 0, n - 1));
console.log("index of 55:", binarySearch(arr, 55, 0, n - 1));
```

```text filename:Output
index of 50: 4
index of 10: 0
index of 55: -1
```

Time O(log n) · Space O(log n) call stack

# Analysis of binary search

After `k` halvings the range has at most `n / 2^k` elements. The search ends when the range is empty, i.e. when `n / 2^k < 1`, so `k ≤ log2 n + 1`. Every step does one comparison (two in the worst case), which gives the recurrence and the bound below.

`T(n) = T(n / 2) + Θ(1) ⇒ T(n) = Θ(log n)`

| Case | When | Time |
| --- | --- | --- |
| Best | `x` is the first middle element | `Θ(1)` |
| Average | `x` anywhere, or absent | `Θ(log n)` |
| Worst | `x` absent, or found on the last halving | `Θ(log n)` — ⌊log2 n⌋ + 1 iterations |
| Space (iterative) | three indices | `O(1)` |
| Space (recursive) | one frame per halving | `O(log n)` |

| n | 16 | 1,024 | 1,000,000 | 1,000,000,000 |
| --- | --- | --- | --- | --- |
| Max halvings (⌊log2 n⌋ + 1) | 5 | 11 | 20 | 30 |

> [!NOTE] Key point
>
> The halving idea is more general than <em>find x</em>. Whenever a predicate is <strong>monotonic</strong> over a range — `false false false true true true` — binary search finds the boundary in `O(log n)`. Every problem below is an instance of that: first/last occurrence, counting 1s, floor of a square root, peak element.

# Binary search on an unsorted list

Binary search is meaningless on unsorted data: discarding a half assumes the half cannot contain `x`. The only ways to use it are to <strong>sort first</strong> (and then search the sorted array — the indices refer to the sorted order) or to exploit some other structure, like the slope of a mountain array below.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 6, 1, 9, 4, 2], x = 3`<br><strong>Output:</strong> `sorted: 1 2 3 4 6 9 — index 2 in the sorted array`

```python filename:Python
def binary_search(arr, x):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] == x:
            return mid
        if arr[mid] < x:
            low = mid + 1
        else:
            high = mid - 1
    return -1

arr = [3, 6, 1, 9, 4, 2]
aux = sorted(arr)                      # O(n log n) copy; arr keeps its order
print("original:", *arr)
print("sorted copy:", *aux)
print("index of 3 in sorted copy:", binary_search(aux, 3))
print("index of 3 in original:", arr.index(3))      # linear search
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& arr, int x) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == x) return mid;
        if (arr[mid] < x) low = mid + 1; else high = mid - 1;
    }
    return -1;
}

void show(const char* label, const vector<int>& v) {
    cout << label;
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    vector<int> arr = {3, 6, 1, 9, 4, 2};
    vector<int> aux = arr;                 // copy, then sort the copy: O(n log n)
    sort(aux.begin(), aux.end());
    show("original:", arr);
    show("sorted copy:", aux);
    cout << "index of 3 in sorted copy: " << binarySearch(aux, 3) << "\n";
    int pos = find(arr.begin(), arr.end(), 3) - arr.begin();     // linear search
    cout << "index of 3 in original: " << pos << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int binarySearch(int[] arr, int x) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == x) return mid;
            if (arr[mid] < x) low = mid + 1; else high = mid - 1;
        }
        return -1;
    }

    static String join(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(' ').append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        int[] arr = {3, 6, 1, 9, 4, 2};
        int[] aux = arr.clone();               // copy, then sort the copy: O(n log n)
        Arrays.sort(aux);
        System.out.println("original:" + join(arr));
        System.out.println("sorted copy:" + join(aux));
        System.out.println("index of 3 in sorted copy: " + binarySearch(aux, 3));
        int pos = -1;                           // linear search
        for (int i = 0; i < arr.length; i++) if (arr[i] == 3) { pos = i; break; }
        System.out.println("index of 3 in original: " + pos);
    }
}
```

```javascript filename:JavaScript
function binarySearch(arr, x) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] === x) return mid;
        if (arr[mid] < x) low = mid + 1; else high = mid - 1;
    }
    return -1;
}

const arr = [3, 6, 1, 9, 4, 2];
const aux = [...arr].sort((a, b) => a - b);   // copy, then sort the copy (numeric comparator!)
console.log("original:", arr.join(" "));
console.log("sorted copy:", aux.join(" "));
console.log("index of 3 in sorted copy:", binarySearch(aux, 3));
console.log("index of 3 in original:", arr.indexOf(3));     // linear search
```

```text filename:Output
original: 3 6 1 9 4 2
sorted copy: 1 2 3 4 6 9
index of 3 in sorted copy: 2
index of 3 in original: 0
```

Time O(n log n) sort + O(log n) per query · Space O(n) for the copy

> [!WARNING] Pitfall
>
> The index returned is a position in the <strong>sorted</strong> array, not in the original. If the caller needs original positions, sort an array of `(value, index)` pairs, or sort the indices by value.

# Peak element in a mountain array

> [!TIP] Example
>
> <strong>Input:</strong> `nums = [1, 2, 1, 3, 5, 6, 4]`<br><strong>Output:</strong> `5 (nums[5] = 6 is greater than both neighbours)`<br><strong>Input:</strong> `nums = [1, 2, 3, 1]`<br><strong>Output:</strong> `2`

> [!NOTE] Idea
>
> A <strong>peak</strong> is an element not smaller than its neighbours. Binary search works without sorting because the slope at `mid` tells you where a peak must exist: if `nums[mid] < nums[mid + 1]` you are on an <em>ascending</em> slope, so a peak lies to the right (the array must come down eventually — or end, and the last element is then a peak). Otherwise a peak lies at `mid` or to its left.

```python filename:Python
def find_peak(nums):
    left, right = 0, len(nums) - 1
    while left < right:                     # stop when one candidate is left
        mid = left + (right - left) // 2
        if nums[mid] < nums[mid + 1]:
            left = mid + 1                  # ascending: a peak is to the right
        else:
            right = mid                     # mid may itself be the peak
    return left

for nums in ([1, 2, 1, 3, 5, 6, 4], [1, 2, 3, 1]):
    i = find_peak(nums)
    print(f"peak at index {i} (value {nums[i]})")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int findPeak(const vector<int>& nums) {
    int left = 0, right = (int)nums.size() - 1;
    while (left < right) {                   // stop when one candidate is left
        int mid = left + (right - left) / 2;
        if (nums[mid] < nums[mid + 1]) left = mid + 1;   // ascending: a peak is to the right
        else right = mid;                                // mid may itself be the peak
    }
    return left;
}

int main() {
    vector<vector<int>> tests = {{1, 2, 1, 3, 5, 6, 4}, {1, 2, 3, 1}};
    for (const auto& nums : tests) {
        int i = findPeak(nums);
        cout << "peak at index " << i << " (value " << nums[i] << ")\n";
    }
}
```

```java filename:Java
public class Main {
    static int findPeak(int[] nums) {
        int left = 0, right = nums.length - 1;
        while (left < right) {                   // stop when one candidate is left
            int mid = left + (right - left) / 2;
            if (nums[mid] < nums[mid + 1]) left = mid + 1;   // ascending: a peak is to the right
            else right = mid;                                // mid may itself be the peak
        }
        return left;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 2, 1, 3, 5, 6, 4}, {1, 2, 3, 1}};
        for (int[] nums : tests) {
            int i = findPeak(nums);
            System.out.println("peak at index " + i + " (value " + nums[i] + ")");
        }
    }
}
```

```javascript filename:JavaScript
function findPeak(nums) {
    let left = 0, right = nums.length - 1;
    while (left < right) {                       // stop when one candidate is left
        const mid = left + Math.floor((right - left) / 2);
        if (nums[mid] < nums[mid + 1]) left = mid + 1;   // ascending: a peak is to the right
        else right = mid;                                // mid may itself be the peak
    }
    return left;
}

for (const nums of [[1, 2, 1, 3, 5, 6, 4], [1, 2, 3, 1]]) {
    const i = findPeak(nums);
    console.log(`peak at index ${i} (value ${nums[i]})`);
}
```

```text filename:Output
peak at index 5 (value 6)
peak at index 2 (value 3)
```

Time O(log n) · Space O(1)

> [!NOTE] Key point
>
> `[1, 2, 1, 3, 5, 6, 4]` has two peaks (index 1 and index 5); binary search returns <em>a</em> peak, not necessarily the first one. Note the loop uses `left < right` and `right = mid` (not `mid - 1`) because `mid` itself may be the answer — and `mid + 1` is always in range since `mid < right`.

# Index of first occurrence in a sorted array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 10, 20, 30, 40, 40, 40, 40], x = 20`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [10, 10, 20, 30, 40, 40, 40, 40], x = 40`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `x = 25`<br><strong>Output:</strong> `-1`

The naive solution scans from the left and returns the first match — `O(n)`, and the only option when the array is unsorted.

```python filename:Python
def first_occurrence_naive(arr, x):
    for i in range(len(arr)):
        if arr[i] == x:
            return i          # the first match from the left
    return -1

arr = [1, 10, 20, 10, 20, 30, 30, 10]      # unsorted — only a scan works
print(first_occurrence_naive(arr, 20))
```

```text filename:Output
2
```

> [!NOTE] Idea
>
> Plain binary search stops at <em>any</em> `x`. To get the <strong>first</strong> one, when `arr[mid] == x` check whether it is the first: it is if `mid == 0` or `arr[mid - 1] < x` (equivalently `x > arr[mid - 1]`). Otherwise there are more copies to the left — keep searching the left half (`high = mid - 1`). The other two cases are unchanged.

1. <strong>`arr[mid] < x`</strong>

   Search right: `low = mid + 1`.

2. <strong>`arr[mid] > x`</strong>

   Search left: `high = mid - 1`.

3. <strong>`arr[mid] == x`</strong><strong> and (</strong><strong>`mid == 0`</strong><strong> or </strong><strong>`arr[mid - 1] != x`</strong><strong>)</strong>

   This is the first occurrence → return `mid`.

4. <strong>`arr[mid] == x`</strong><strong> otherwise</strong>

   A copy exists to the left → `high = mid - 1`.

```python filename:Python
def first_rec(arr, low, high, x):
    if low > high:
        return -1
    mid = low + (high - low) // 2
    if arr[mid] < x:
        return first_rec(arr, mid + 1, high, x)
    if arr[mid] > x:
        return first_rec(arr, low, mid - 1, x)
    if mid == 0 or arr[mid - 1] != x:        # arr[mid] == x and nothing equal before it
        return mid
    return first_rec(arr, low, mid - 1, x)   # more copies to the left

def first_iter(arr, x):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] < x:
            low = mid + 1
        elif arr[mid] > x:
            high = mid - 1
        elif mid == 0 or arr[mid - 1] != x:
            return mid
        else:
            high = mid - 1                   # more copies to the left
    return -1

arr = [10, 10, 20, 30, 40, 40, 40, 40]
for x in (20, 40, 25):
    print(f"first {x}: recursive {first_rec(arr, 0, len(arr) - 1, x)}, iterative {first_iter(arr, x)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int firstRec(const vector<int>& arr, int low, int high, int x) {
    if (low > high) return -1;
    int mid = low + (high - low) / 2;
    if (arr[mid] < x) return firstRec(arr, mid + 1, high, x);
    if (arr[mid] > x) return firstRec(arr, low, mid - 1, x);
    if (mid == 0 || arr[mid - 1] != x) return mid;   // arr[mid] == x and nothing equal before it
    return firstRec(arr, low, mid - 1, x);           // more copies to the left
}

int firstIter(const vector<int>& arr, int x) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else if (mid == 0 || arr[mid - 1] != x) return mid;
        else high = mid - 1;                         // more copies to the left
    }
    return -1;
}

int main() {
    vector<int> arr = {10, 10, 20, 30, 40, 40, 40, 40};
    int n = arr.size();
    for (int x : {20, 40, 25})
        cout << "first " << x << ": recursive " << firstRec(arr, 0, n - 1, x)
             << ", iterative " << firstIter(arr, x) << "\n";
}
```

```java filename:Java
public class Main {
    static int firstRec(int[] arr, int low, int high, int x) {
        if (low > high) return -1;
        int mid = low + (high - low) / 2;
        if (arr[mid] < x) return firstRec(arr, mid + 1, high, x);
        if (arr[mid] > x) return firstRec(arr, low, mid - 1, x);
        if (mid == 0 || arr[mid - 1] != x) return mid;   // arr[mid] == x and nothing equal before it
        return firstRec(arr, low, mid - 1, x);           // more copies to the left
    }

    static int firstIter(int[] arr, int x) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] < x) low = mid + 1;
            else if (arr[mid] > x) high = mid - 1;
            else if (mid == 0 || arr[mid - 1] != x) return mid;
            else high = mid - 1;                         // more copies to the left
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] arr = {10, 10, 20, 30, 40, 40, 40, 40};
        for (int x : new int[]{20, 40, 25})
            System.out.println("first " + x + ": recursive " + firstRec(arr, 0, arr.length - 1, x)
                               + ", iterative " + firstIter(arr, x));
    }
}
```

```javascript filename:JavaScript
function firstRec(arr, low, high, x) {
    if (low > high) return -1;
    const mid = low + Math.floor((high - low) / 2);
    if (arr[mid] < x) return firstRec(arr, mid + 1, high, x);
    if (arr[mid] > x) return firstRec(arr, low, mid - 1, x);
    if (mid === 0 || arr[mid - 1] !== x) return mid;   // arr[mid] == x and nothing equal before it
    return firstRec(arr, low, mid - 1, x);             // more copies to the left
}

function firstIter(arr, x) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else if (mid === 0 || arr[mid - 1] !== x) return mid;
        else high = mid - 1;                           // more copies to the left
    }
    return -1;
}

const arr = [10, 10, 20, 30, 40, 40, 40, 40];
for (const x of [20, 40, 25])
    console.log(`first ${x}: recursive ${firstRec(arr, 0, arr.length - 1, x)}, iterative ${firstIter(arr, x)}`);
```

```text filename:Output
first 20: recursive 2, iterative 2
first 40: recursive 4, iterative 4
first 25: recursive -1, iterative -1
```

Time O(log n) · Space O(1) iterative · O(log n) recursive

> [!NOTE] Key point
>
> This is exactly what `bisect_left` (Python) and `lower_bound` (C++) compute — the first position whose value is `≥ x` — except that they return the insertion point instead of `-1` when `x` is absent.

# Index of last occurrence in a sorted array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8], x = 8`<br><strong>Output:</strong> `9`<br><strong>Input:</strong> `arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8], x = 2`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `x = 5`<br><strong>Output:</strong> `-1`

Naive: scan the whole array and remember the last index where `arr[i] == x` (or scan from the right and stop at the first match) — `O(n)`, works unsorted.

```python filename:Python
def last_occurrence_naive(arr, x):
    last = -1
    for i in range(len(arr)):
        if arr[i] == x:
            last = i              # keep overwriting: the final value is the last match
    return last

arr = [10, 20, 30, 20, 30, 40, 40, 40]
print(last_occurrence_naive(arr, 30))
print(last_occurrence_naive(arr, 50))
```

```text filename:Output
4
-1
```

> [!NOTE] Idea
>
> Mirror image of first occurrence: when `arr[mid] == x`, it is the last one if `mid == n - 1` or `arr[mid + 1] != x`; otherwise more copies lie to the right, so continue with `low = mid + 1`.

```python filename:Python
def last_rec(arr, low, high, x):
    if low > high:
        return -1
    mid = low + (high - low) // 2
    if arr[mid] < x:
        return last_rec(arr, mid + 1, high, x)
    if arr[mid] > x:
        return last_rec(arr, low, mid - 1, x)
    if mid == len(arr) - 1 or arr[mid + 1] != x:   # nothing equal after it
        return mid
    return last_rec(arr, mid + 1, high, x)         # more copies to the right

def last_iter(arr, x):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] < x:
            low = mid + 1
        elif arr[mid] > x:
            high = mid - 1
        elif mid == len(arr) - 1 or arr[mid + 1] != x:
            return mid
        else:
            low = mid + 1                          # more copies to the right
    return -1

arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8]
for x in (8, 2, 5):
    print(f"last {x}: recursive {last_rec(arr, 0, len(arr) - 1, x)}, iterative {last_iter(arr, x)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int lastRec(const vector<int>& arr, int low, int high, int x) {
    if (low > high) return -1;
    int mid = low + (high - low) / 2;
    if (arr[mid] < x) return lastRec(arr, mid + 1, high, x);
    if (arr[mid] > x) return lastRec(arr, low, mid - 1, x);
    if (mid == (int)arr.size() - 1 || arr[mid + 1] != x) return mid;   // nothing equal after it
    return lastRec(arr, mid + 1, high, x);                             // more copies to the right
}

int lastIter(const vector<int>& arr, int x) {
    int n = arr.size(), low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else if (mid == n - 1 || arr[mid + 1] != x) return mid;
        else low = mid + 1;                                            // more copies to the right
    }
    return -1;
}

int main() {
    vector<int> arr = {1, 2, 2, 2, 2, 3, 4, 7, 8, 8};
    int n = arr.size();
    for (int x : {8, 2, 5})
        cout << "last " << x << ": recursive " << lastRec(arr, 0, n - 1, x)
             << ", iterative " << lastIter(arr, x) << "\n";
}
```

```java filename:Java
public class Main {
    static int lastRec(int[] arr, int low, int high, int x) {
        if (low > high) return -1;
        int mid = low + (high - low) / 2;
        if (arr[mid] < x) return lastRec(arr, mid + 1, high, x);
        if (arr[mid] > x) return lastRec(arr, low, mid - 1, x);
        if (mid == arr.length - 1 || arr[mid + 1] != x) return mid;   // nothing equal after it
        return lastRec(arr, mid + 1, high, x);                        // more copies to the right
    }

    static int lastIter(int[] arr, int x) {
        int n = arr.length, low = 0, high = n - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] < x) low = mid + 1;
            else if (arr[mid] > x) high = mid - 1;
            else if (mid == n - 1 || arr[mid + 1] != x) return mid;
            else low = mid + 1;                                       // more copies to the right
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] arr = {1, 2, 2, 2, 2, 3, 4, 7, 8, 8};
        for (int x : new int[]{8, 2, 5})
            System.out.println("last " + x + ": recursive " + lastRec(arr, 0, arr.length - 1, x)
                               + ", iterative " + lastIter(arr, x));
    }
}
```

```javascript filename:JavaScript
function lastRec(arr, low, high, x) {
    if (low > high) return -1;
    const mid = low + Math.floor((high - low) / 2);
    if (arr[mid] < x) return lastRec(arr, mid + 1, high, x);
    if (arr[mid] > x) return lastRec(arr, low, mid - 1, x);
    if (mid === arr.length - 1 || arr[mid + 1] !== x) return mid;   // nothing equal after it
    return lastRec(arr, mid + 1, high, x);                          // more copies to the right
}

function lastIter(arr, x) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else if (mid === arr.length - 1 || arr[mid + 1] !== x) return mid;
        else low = mid + 1;                                         // more copies to the right
    }
    return -1;
}

const arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8];
for (const x of [8, 2, 5])
    console.log(`last ${x}: recursive ${lastRec(arr, 0, arr.length - 1, x)}, iterative ${lastIter(arr, x)}`);
```

```text filename:Output
last 8: recursive 9, iterative 9
last 2: recursive 4, iterative 4
last 5: recursive -1, iterative -1
```

Time O(log n) · Space O(1) iterative · O(log n) recursive

> [!WARNING] Pitfall
>
> Checking `arr[mid + 1]` before `mid == n - 1` reads past the end of the array (undefined behaviour in C++, an exception in Java, `undefined` in JavaScript). Keep the bounds test <strong>first</strong> in the `or` — short-circuit evaluation then skips the access.

# Count occurrences in a sorted array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8], x = 2`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `arr = [10, 20, 20, 20, 30, 30], x = 20`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `x = 25`<br><strong>Output:</strong> `0`

| Approach | How | Time |
| --- | --- | --- |
| Naive | Linear scan, count matches | `O(n)` |
| Better | One binary search to find any `x`, then expand left and right over the copies | `O(log n + k)` for `k` copies — `O(n)` when every element is `x` |
| Efficient | Two binary searches: `last − first + 1` | `O(log n)` |

> [!NOTE] Idea
>
> Copies of `x` sit in one contiguous block of a sorted array. Find the block's two ends with the first-occurrence and last-occurrence searches above; the count is `last − first + 1`, or `0` when `first` is `-1`. One parameterised search (`find_first = true/false`) does both jobs: on a match it records the index and keeps going left or right.

```python filename:Python
def bound(arr, x, find_first):
    answer, low, high = -1, 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] < x:
            low = mid + 1
        elif arr[mid] > x:
            high = mid - 1
        else:
            answer = mid                 # a match — remember it, then keep looking ...
            if find_first:
                high = mid - 1           # ... further left
            else:
                low = mid + 1            # ... further right
    return answer

def count_occurrences(arr, x):
    first = bound(arr, x, True)
    if first == -1:
        return 0
    return bound(arr, x, False) - first + 1

arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8]
for x in (2, 8, 5):
    print(f"count of {x}:", count_occurrences(arr, x))
print("count of 20 in [10 20 20 20 30 30]:", count_occurrences([10, 20, 20, 20, 30, 30], 20))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int bound(const vector<int>& arr, int x, bool findFirst) {
    int answer = -1, low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else {
            answer = mid;                            // a match — remember it, then keep looking ...
            if (findFirst) high = mid - 1;           // ... further left
            else low = mid + 1;                      // ... further right
        }
    }
    return answer;
}

int countOccurrences(const vector<int>& arr, int x) {
    int first = bound(arr, x, true);
    if (first == -1) return 0;
    return bound(arr, x, false) - first + 1;
}

int main() {
    vector<int> arr = {1, 2, 2, 2, 2, 3, 4, 7, 8, 8};
    for (int x : {2, 8, 5}) cout << "count of " << x << ": " << countOccurrences(arr, x) << "\n";
    cout << "count of 20 in [10 20 20 20 30 30]: " << countOccurrences({10, 20, 20, 20, 30, 30}, 20) << "\n";
}
```

```java filename:Java
public class Main {
    static int bound(int[] arr, int x, boolean findFirst) {
        int answer = -1, low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] < x) low = mid + 1;
            else if (arr[mid] > x) high = mid - 1;
            else {
                answer = mid;                            // a match — remember it, then keep looking ...
                if (findFirst) high = mid - 1;           // ... further left
                else low = mid + 1;                      // ... further right
            }
        }
        return answer;
    }

    static int countOccurrences(int[] arr, int x) {
        int first = bound(arr, x, true);
        if (first == -1) return 0;
        return bound(arr, x, false) - first + 1;
    }

    public static void main(String[] args) {
        int[] arr = {1, 2, 2, 2, 2, 3, 4, 7, 8, 8};
        for (int x : new int[]{2, 8, 5}) System.out.println("count of " + x + ": " + countOccurrences(arr, x));
        System.out.println("count of 20 in [10 20 20 20 30 30]: " + countOccurrences(new int[]{10, 20, 20, 20, 30, 30}, 20));
    }
}
```

```javascript filename:JavaScript
function bound(arr, x, findFirst) {
    let answer = -1, low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] < x) low = mid + 1;
        else if (arr[mid] > x) high = mid - 1;
        else {
            answer = mid;                            // a match — remember it, then keep looking ...
            if (findFirst) high = mid - 1;           // ... further left
            else low = mid + 1;                      // ... further right
        }
    }
    return answer;
}

function countOccurrences(arr, x) {
    const first = bound(arr, x, true);
    if (first === -1) return 0;
    return bound(arr, x, false) - first + 1;
}

const arr = [1, 2, 2, 2, 2, 3, 4, 7, 8, 8];
for (const x of [2, 8, 5]) console.log(`count of ${x}:`, countOccurrences(arr, x));
console.log("count of 20 in [10 20 20 20 30 30]:", countOccurrences([10, 20, 20, 20, 30, 30], 20));
```

```text filename:Output
count of 2: 4
count of 8: 2
count of 5: 0
count of 20 in [10 20 20 20 30 30]: 3
```

Time O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> The original notes labelled a version with two <strong>linear</strong> scans (first from the left, last from the right) as <em>efficient</em>. It gives the right answer but is `O(n)` — no better than counting directly. Only the two binary searches reach `O(log n)`.

# Count 1's in a sorted binary array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 1, 0, 0, 0, 0, 0]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [1, 1, 1, 1, 1, 1, 1]`<br><strong>Output:</strong> `7`<br><strong>Input:</strong> `arr = [0, 0, 0, 0, 0, 0, 0]`<br><strong>Output:</strong> `0`

The array is sorted in <em>descending</em> order — all the 1s come first, then all the 0s. The naive solution walks from the left and stops at the first 0.

```python filename:Python
def count_ones_naive(arr):
    count = 0
    for v in arr:
        if v == 0:
            break             # sorted: no more 1s after the first 0
        count += 1
    return count

print(count_ones_naive([1, 1, 1, 1, 0, 0, 0]))
```

```text filename:Output
4
```

> [!NOTE] Idea
>
> This is <em>index of last occurrence</em> of `1`, plus one. At `mid`: if `arr[mid] == 1` and (`mid` is the last index or `arr[mid + 1] == 0`) it is the last 1 → answer `mid + 1`. If `arr[mid] == 1` otherwise, the boundary is to the right; if `arr[mid] == 0` it is to the left.

<strong>Recursive version</strong> — one call per halving:

```python filename:Python
def count_ones(arr, low, high):
    if low > high:
        return 0                              # no 1 at all
    mid = low + (high - low) // 2
    if arr[mid] == 1 and (mid == high or arr[mid + 1] == 0):
        return mid + 1                        # mid is the last 1
    if arr[mid] == 1:
        return count_ones(arr, mid + 1, high)   # last 1 is further right
    return count_ones(arr, low, mid - 1)        # arr[mid] == 0: look left

tests = [[1, 1, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0]]
for arr in tests:
    print(*arr, "->", count_ones(arr, 0, len(arr) - 1))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int countOnes(const vector<int>& arr, int low, int high) {
    if (low > high) return 0;                            // no 1 at all
    int mid = low + (high - low) / 2;
    if (arr[mid] == 1 && (mid == high || arr[mid + 1] == 0))
        return mid + 1;                                  // mid is the last 1
    if (arr[mid] == 1) return countOnes(arr, mid + 1, high);   // last 1 is further right
    return countOnes(arr, low, mid - 1);                       // arr[mid] == 0: look left
}

int main() {
    vector<vector<int>> tests = {{1, 1, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 1, 1, 1}, {0, 0, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 0, 0, 0}};
    for (const auto& arr : tests) {
        for (int v : arr) cout << v << " ";
        cout << "-> " << countOnes(arr, 0, (int)arr.size() - 1) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int countOnes(int[] arr, int low, int high) {
        if (low > high) return 0;                            // no 1 at all
        int mid = low + (high - low) / 2;
        if (arr[mid] == 1 && (mid == high || arr[mid + 1] == 0))
            return mid + 1;                                  // mid is the last 1
        if (arr[mid] == 1) return countOnes(arr, mid + 1, high);   // last 1 is further right
        return countOnes(arr, low, mid - 1);                       // arr[mid] == 0: look left
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 1, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 1, 1, 1}, {0, 0, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 0, 0, 0}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int v : arr) sb.append(v).append(' ');
            System.out.println(sb + "-> " + countOnes(arr, 0, arr.length - 1));
        }
    }
}
```

```javascript filename:JavaScript
function countOnes(arr, low, high) {
    if (low > high) return 0;                                // no 1 at all
    const mid = low + Math.floor((high - low) / 2);
    if (arr[mid] === 1 && (mid === high || arr[mid + 1] === 0))
        return mid + 1;                                      // mid is the last 1
    if (arr[mid] === 1) return countOnes(arr, mid + 1, high);   // last 1 is further right
    return countOnes(arr, low, mid - 1);                        // arr[mid] == 0: look left
}

const tests = [[1, 1, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0]];
for (const arr of tests)
    console.log(arr.join(" "), "->", countOnes(arr, 0, arr.length - 1));
```

```text filename:Output
1 1 0 0 0 0 0 -> 2
1 1 1 1 1 1 1 -> 7
0 0 0 0 0 0 0 -> 0
1 1 1 1 0 0 0 -> 4
```

Time O(log n) · Space O(log n) call stack

<strong>Iterative version</strong> — same decisions in a loop, `O(1)` space:

```python filename:Python
def count_ones(arr):
    n = len(arr)
    low, high = 0, n - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] == 0:
            high = mid - 1                    # the boundary is to the left
        elif mid == n - 1 or arr[mid + 1] == 0:
            return mid + 1                    # mid is the last 1
        else:
            low = mid + 1                     # the boundary is to the right
    return 0

tests = [[1, 1, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0]]
for arr in tests:
    print(*arr, "->", count_ones(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int countOnes(const vector<int>& arr) {
    int n = arr.size(), low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == 0) high = mid - 1;                     // the boundary is to the left
        else if (mid == n - 1 || arr[mid + 1] == 0) return mid + 1;   // mid is the last 1
        else low = mid + 1;                                    // the boundary is to the right
    }
    return 0;
}

int main() {
    vector<vector<int>> tests = {{1, 1, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 1, 1, 1}, {0, 0, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 0, 0, 0}};
    for (const auto& arr : tests) {
        for (int v : arr) cout << v << " ";
        cout << "-> " << countOnes(arr) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int countOnes(int[] arr) {
        int n = arr.length, low = 0, high = n - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == 0) high = mid - 1;                     // the boundary is to the left
            else if (mid == n - 1 || arr[mid + 1] == 0) return mid + 1;   // mid is the last 1
            else low = mid + 1;                                    // the boundary is to the right
        }
        return 0;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 1, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 1, 1, 1}, {0, 0, 0, 0, 0, 0, 0}, {1, 1, 1, 1, 0, 0, 0}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int v : arr) sb.append(v).append(' ');
            System.out.println(sb + "-> " + countOnes(arr));
        }
    }
}
```

```javascript filename:JavaScript
function countOnes(arr) {
    const n = arr.length;
    let low = 0, high = n - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] === 0) high = mid - 1;                        // the boundary is to the left
        else if (mid === n - 1 || arr[mid + 1] === 0) return mid + 1;   // mid is the last 1
        else low = mid + 1;                                        // the boundary is to the right
    }
    return 0;
}

const tests = [[1, 1, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0]];
for (const arr of tests)
    console.log(arr.join(" "), "->", countOnes(arr));
```

```text filename:Output
1 1 0 0 0 0 0 -> 2
1 1 1 1 1 1 1 -> 7
0 0 0 0 0 0 0 -> 0
1 1 1 1 0 0 0 -> 4
```

Time O(log n) · Space O(1)

> [!NOTE] Key point
>
> If the array were sorted <em>ascending</em> (`0 0 0 1 1`), the count of 1s is `n − (index of the first 1)` — the first-occurrence search. Either way it is a boundary search on a monotonic sequence.

# Square root (floor) by binary search

> [!TIP] Example
>
> <strong>Input:</strong> `x = 4`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `x = 10`<br><strong>Output:</strong> `3 (3² = 9 ≤ 10 < 16 = 4²)`<br><strong>Input:</strong> `x = 1000000`<br><strong>Output:</strong> `1000`

`floor(sqrt(x))` is the largest integer `i` with `i² ≤ x`. The naive solution counts up from 1 until `i² > x` — `O(√x)` iterations.

```python filename:Python
def floor_sqrt_naive(x):
    i = 1
    while i * i <= x:
        i += 1
    return i - 1              # the last i whose square did not exceed x

print(floor_sqrt_naive(4), floor_sqrt_naive(10), floor_sqrt_naive(1000000))
```

```text filename:Output
2 3 1000
```

> [!NOTE] Idea
>
> The predicate `mid² ≤ x` is `true` for small `mid` and `false` for large `mid` — monotonic, so binary search over `1..x` finds the boundary. Whenever `mid² ≤ x`, `mid` is a candidate answer: remember it and move right; otherwise move left.

```python filename:Python
def floor_sqrt(x):
    low, high, ans = 1, x, 0           # ans = 0 handles x == 0
    while low <= high:
        mid = low + (high - low) // 2
        sq = mid * mid
        if sq == x:
            return mid
        if sq < x:
            ans = mid                  # mid works — maybe a bigger one does too
            low = mid + 1
        else:
            high = mid - 1
    return ans

for x in (4, 10, 1, 0, 1000000, 2147395599):
    print(f"sqrt({x}) = {floor_sqrt(x)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long floorSqrt(long long x) {
    long long low = 1, high = x, ans = 0;   // ans = 0 handles x == 0
    while (low <= high) {
        long long mid = low + (high - low) / 2;
        long long sq = mid * mid;             // long long: mid * mid overflows int for x > 2^31
        if (sq == x) return mid;
        if (sq < x) { ans = mid; low = mid + 1; }   // mid works — maybe a bigger one does too
        else high = mid - 1;
    }
    return ans;
}

int main() {
    for (long long x : {4LL, 10LL, 1LL, 0LL, 1000000LL, 2147395599LL})
        cout << "sqrt(" << x << ") = " << floorSqrt(x) << "\n";
}
```

```java filename:Java
public class Main {
    static long floorSqrt(long x) {
        long low = 1, high = x, ans = 0;      // ans = 0 handles x == 0
        while (low <= high) {
            long mid = low + (high - low) / 2;
            long sq = mid * mid;              // long: mid * mid overflows int for x > 2^31
            if (sq == x) return mid;
            if (sq < x) { ans = mid; low = mid + 1; }   // mid works — maybe a bigger one does too
            else high = mid - 1;
        }
        return ans;
    }

    public static void main(String[] args) {
        for (long x : new long[]{4, 10, 1, 0, 1000000, 2147395599L})
            System.out.println("sqrt(" + x + ") = " + floorSqrt(x));
    }
}
```

```javascript filename:JavaScript
function floorSqrt(x) {
    let low = 1, high = x, ans = 0;           // ans = 0 handles x == 0
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        const sq = mid * mid;                 // exact up to 2^53 in JavaScript
        if (sq === x) return mid;
        if (sq < x) { ans = mid; low = mid + 1; }   // mid works — maybe a bigger one does too
        else high = mid - 1;
    }
    return ans;
}

for (const x of [4, 10, 1, 0, 1000000, 2147395599])
    console.log(`sqrt(${x}) = ${floorSqrt(x)}`);
```

```text filename:Output
sqrt(4) = 2
sqrt(10) = 3
sqrt(1) = 1
sqrt(0) = 0
sqrt(1000000) = 1000
sqrt(2147395599) = 46339
```

Time O(log x) · Space O(1)

> [!WARNING] Pitfall
>
> `mid * mid` overflows a 32-bit `int` once `mid > 46340`. Use `long long` / `long`, or compare `mid <= x / mid` instead of squaring. Also set `high = x / 2` for `x ≥ 2` if you like — the root never exceeds half of `x` there — but the plain `high = x` is correct too.

# Built-in search functions

| Language | Linear | Binary (sorted input) | Notes |
| --- | --- | --- | --- |
| Python | `x in arr`, `arr.index(x)` | `bisect.bisect_left(arr, x)`, `bisect_right` | `bisect_left` returns the insertion point — check `arr[i] == x` yourself |
| C++ | `std::find(b, e, x)` | `std::binary_search` (bool), `std::lower_bound`, `std::upper_bound` | `lower_bound` = first element `≥ x`; `upper_bound` = first `> x`; `equal_range` gives both |
| Java | `list.indexOf(x)`, `list.contains(x)` | `Arrays.binarySearch(arr, x)`, `Collections.binarySearch` | returns `-(insertionPoint) - 1` when absent; <strong>any</strong> index among duplicates |
| JavaScript | `arr.indexOf(x)`, `arr.includes(x)`, `arr.find(fn)` | <em>none</em> — write your own | `indexOf` uses `===`, so `NaN` is never found (`includes` handles `NaN`) |

```python filename:Python
from bisect import bisect_left

def search(arr, x):
    i = bisect_left(arr, x)                  # first position with arr[i] >= x
    return i if i < len(arr) and arr[i] == x else -1

arr = [10, 10, 20, 30, 40, 40, 40, 40]
print("index of 20:", search(arr, 20))
print("index of 25:", search(arr, 25))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int search(const vector<int>& arr, int x) {
    auto it = lower_bound(arr.begin(), arr.end(), x);   // first element >= x
    return (it != arr.end() && *it == x) ? (int)(it - arr.begin()) : -1;
}

int main() {
    vector<int> arr = {10, 10, 20, 30, 40, 40, 40, 40};
    cout << "index of 20: " << search(arr, 20) << "\n";
    cout << "index of 25: " << search(arr, 25) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int search(int[] arr, int x) {
        int i = Arrays.binarySearch(arr, x);      // negative when absent: -(insertion point) - 1
        return i >= 0 ? i : -1;
    }

    public static void main(String[] args) {
        int[] arr = {10, 10, 20, 30, 40, 40, 40, 40};
        System.out.println("index of 20: " + search(arr, 20));
        System.out.println("index of 25: " + search(arr, 25));
    }
}
```

```javascript filename:JavaScript
// No binary search in the standard library — indexOf is a linear scan
const arr = [10, 10, 20, 30, 40, 40, 40, 40];
console.log("index of 20:", arr.indexOf(20));
console.log("index of 25:", arr.indexOf(25));
```

```text filename:Output
index of 20: 2
index of 25: -1
```

> [!WARNING] Pitfall
>
> `Arrays.binarySearch` on `[10, 10, 20, 30, 40, 40, 40, 40]` with `x = 40` may return 4, 5, 6 or 7 — the contract only promises <em>some</em> matching index. For the first or last occurrence, use the hand-written searches above (or `lower_bound` / `bisect_left`, which do guarantee the first position).

# Interview Q&amp;A

```question
Why write mid = low + (high - low) / 2 instead of (low + high) / 2?

---

Both give the same value mathematically, but `low + high` can exceed the maximum `int` (2³¹ − 1) for very large arrays and wrap to a negative number, producing a negative index. `low + (high - low) / 2` never computes a value larger than `high`. (Python integers do not overflow, but the habit is worth keeping.)
```

```question
Can you binary-search a linked list?

---

Not usefully. The algorithm needs `O(1)` access to the middle element; in a linked list reaching the middle costs `O(n)`, so the total is `O(n)` — no better than a linear scan. Skip lists and balanced BSTs are the pointer-based structures that give `O(log n)` search.
```

```question
When is linear search the better choice?

---

When the data is unsorted and searched only once (sorting costs `O(n log n)`), when `n` is tiny (a dozen elements — the constant factors and cache behaviour favour the scan), or when the container has no random access (linked list, stream).
```

```question
How do first-occurrence and lower\_bound differ?

---

`lower_bound(x)` / `bisect_left(x)` returns the first index whose value is <strong>≥ x</strong> — if `x` is absent that is the position where it would be inserted. First-occurrence returns the same index when `x` is present and `-1` otherwise. `upper_bound(x)` returns the first index with value <strong>&gt; x</strong>, so `upper_bound − lower_bound` is the count of `x`.
```

```question
What problems can binary search solve besides finding a value?

---

Anything where a yes/no predicate is monotonic over a range: first/last occurrence, counting 1s in a sorted binary array, floor of a square root (`mid² ≤ x`), peak in a mountain array, the smallest capacity that ships packages within `d` days, the minimum page limit in <em>allocate books</em> — "binary search on the answer". Each step evaluates the predicate once, so the cost is `O(log range × cost of predicate)`.
```

```question
What is the worst-case number of comparisons of binary search on 1,000,000 elements?

---

About 20: ⌊log2 1,000,000⌋ + 1 = 20 halvings, each with at most two comparisons. Linear search needs up to 1,000,000.
```
