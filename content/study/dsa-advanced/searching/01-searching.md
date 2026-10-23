---
id: 148175ca-4931-7611-bac1-fb16d8dad96c
key: topic:dsa-advanced/searching
subject: dsa-advanced
topic: searching
title: Searching
slug: searching
order: 1
---

Advanced searching is rarely “find `x` in a sorted array”. It is recognising that a problem has a <strong>monotone structure</strong> — an index range that can be halved, an answer range that can be halved, or two ends that can be walked inwards — and then applying binary search or two pointers to it.

> [!INFO]
>
> <strong>Binary search (general form)</strong> — given a predicate that is `false` for a prefix of the search space and `true` for the rest, find the boundary in `O(log n)` probes. Searching for a value in a sorted array is just the special case `arr[i] >= x`.

# The four patterns in this topic

> [!NOTE] Binary search on an index
>
> The array is sorted, or <em>piecewise</em> sorted (rotated, bitonic). Decide in `O(1)` which half can contain the answer and discard the other.

> [!NOTE] Binary search on the answer
>
> The array is not sorted, but the <em>answer</em> is a number and “is `ans` feasible?” is monotone. Binary search over the answer range, checking feasibility in `O(n)`.

> [!NOTE] Two pointers
>
> One pointer at each end of a sorted array; the sum tells you which pointer to move. Pair / triplet with a given sum.

> [!NOTE] Cycle detection on indices
>
> Treat `i → arr[i]` as a linked list. Floyd's tortoise-and-hare finds the repeated value in `O(n)` time and `O(1)` space without touching the array.

| Problem | Pattern | Time | Extra space |
| --- | --- | --- | --- |
| Search in an infinite sorted array | doubling + binary search | `O(log p)` (`p` = position) | `O(1)` |
| Search in a sorted rotated array | binary search with a sorted-half test | `O(log n)` | `O(1)` |
| Find a peak element | binary search towards the rising side | `O(log n)` | `O(1)` |
| Pair with given sum (sorted) | two pointers | `O(n)` | `O(1)` |
| Triplet with given sum (sorted) | fix one + two pointers | `O(n²)` | `O(1)` |
| Median of two sorted arrays | binary search on a partition | `O(log min(n1, n2))` | `O(1)` |
| Repeating element | Floyd's cycle detection | `O(n)` | `O(1)` |
| Allocate minimum pages | binary search on the answer | `O(n log S)` | `O(1)` |

> [!NOTE] Key point
>
> Every solution below uses the same loop skeleton: `while low <= high: mid = low + (high - low) // 2 …` with `low = mid + 1` or `high = mid - 1`. Writing `low + (high - low) / 2` instead of `(low + high) / 2` avoids integer overflow in C++ and Java when `low + high` exceeds `2³¹ - 1`.

# Search in an infinite sorted array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 15, 20, 40, 80, 80, 90, 100, 120, …], x = 100`<br><strong>Output:</strong> `7`<br><strong>Input:</strong> `arr = [10, 15, 20, 40, 80, 80, 90, 100, 120, …], x = 50`<br><strong>Output:</strong> `-1`

The array has no known size (think of a stream, a file, or an API that returns elements by index), so `high = n - 1` is unavailable. A linear scan is `O(p)` where `p` is the position of `x`. We can do better: find a bracket around `x` first.

> [!NOTE] Idea
>
> <strong>Double the index</strong> until `arr[i] >= x`: probe `1, 2, 4, 8, …`. After `O(log p)` probes we know `x` lies in `(i/2, i]`, a range of size `i/2`. One binary search on that range finds it in another `O(log p)` steps.

1. <strong>Check index 0</strong>

   If `arr[0] == x` return 0.

2. <strong>Gallop</strong>

   Start at `i = 1`; while `arr[i] < x` set `i = 2i`. Stop when `arr[i] >= x` (or we have overshot into values larger than `x`).

3. <strong>Binary search</strong>

   Search for `x` in `[i/2 + 1, i]` — every index below `i/2 + 1` was already seen to be `< x`.

```python filename:Python
# Naive: scan until we pass x — O(p) probes
def search(arr, x):
    i = 0
    while True:
        if arr[i] == x:
            return i
        if arr[i] > x:      # sorted, so x cannot appear later
            return -1
        i += 1

arr = [10, 15, 20, 40, 80, 80, 90, 100, 120]
print(search(arr, 100))
print(search(arr, 50))
```

```text filename:Output
7
-1
```

The efficient version only needs `at(i)` — a way to read the element at position `i`. The demo below models the infinite array with a function that returns a very large value beyond the data we actually have, which is exactly how a real stream would look (“everything further out is bigger than anything we are searching for”).

```python filename:Python
INF = 10**9
data = [10, 15, 20, 40, 80, 80, 90, 100, 120]

def at(i):                      # the "infinite" array: beyond our data everything is huge
    return data[i] if i < len(data) else INF

def binary_search(low, high, x):
    while low <= high:
        mid = low + (high - low) // 2
        if at(mid) == x:
            return mid
        if at(mid) < x:
            low = mid + 1
        else:
            high = mid - 1
    return -1

def search(x):
    if at(0) == x:
        return 0
    i = 1
    while at(i) < x:            # gallop: 1, 2, 4, 8, ...
        i *= 2
    if at(i) == x:
        return i
    return binary_search(i // 2 + 1, i - 1, x)

for x in (100, 50, 40):
    print(f"x = {x} → {search(x)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

const int INF = 1000000000;
vector<int> arr = {10, 15, 20, 40, 80, 80, 90, 100, 120};

int at(int i) {                  // the "infinite" array: beyond our data everything is huge
    return i < (int)arr.size() ? arr[i] : INF;
}

int binarySearch(int low, int high, int x) {
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (at(mid) == x) return mid;
        if (at(mid) < x) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

int search(int x) {
    if (at(0) == x) return 0;
    int i = 1;
    while (at(i) < x) i *= 2;    // gallop: 1, 2, 4, 8, ...
    if (at(i) == x) return i;
    return binarySearch(i / 2 + 1, i - 1, x);
}

int main() {
    for (int x : {100, 50, 40})
        cout << "x = " << x << " → " << search(x) << "\n";
}
```

```java filename:Java
public class Main {
    static final int INF = 1_000_000_000;
    static int[] data = {10, 15, 20, 40, 80, 80, 90, 100, 120};

    static int at(int i) {       // the "infinite" array: beyond our data everything is huge
        return i < data.length ? data[i] : INF;
    }

    static int binarySearch(int low, int high, int x) {
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (at(mid) == x) return mid;
            if (at(mid) < x) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    static int search(int x) {
        if (at(0) == x) return 0;
        int i = 1;
        while (at(i) < x) i *= 2;   // gallop: 1, 2, 4, 8, ...
        if (at(i) == x) return i;
        return binarySearch(i / 2 + 1, i - 1, x);
    }

    public static void main(String[] args) {
        for (int x : new int[]{100, 50, 40})
            System.out.println("x = " + x + " → " + search(x));
    }
}
```

```javascript filename:JavaScript
const INF = 1e9;
const data = [10, 15, 20, 40, 80, 80, 90, 100, 120];

const at = (i) => (i < data.length ? data[i] : INF);   // the "infinite" array

function binarySearch(low, high, x) {
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (at(mid) === x) return mid;
        if (at(mid) < x) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

function search(x) {
    if (at(0) === x) return 0;
    let i = 1;
    while (at(i) < x) i *= 2;       // gallop: 1, 2, 4, 8, ...
    if (at(i) === x) return i;
    return binarySearch(Math.floor(i / 2) + 1, i - 1, x);
}

for (const x of [100, 50, 40]) console.log(`x = ${x} → ${search(x)}`);
```

```text filename:Output
x = 100 → 7
x = 50 → -1
x = 40 → 3
```

Time O(log p) · Space O(1)

> [!NOTE] Key point
>
> `p` is the position of `x`, not the (unknown) array size. The same “gallop then binary search” trick is <strong>exponential search</strong>; Timsort uses it to merge runs of very different lengths.

# Search in a sorted rotated array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40, 50, 8, 9], x = 30`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [100, 200, 300, 10, 20], x = 40`<br><strong>Output:</strong> `-1`

A sorted array rotated by some unknown amount consists of two sorted runs, with the second run entirely smaller than the first. Plain binary search fails because `arr[mid] < x` no longer tells you which side `x` is on.

```text filename:Whichever%20half%20contains%20mid's%20boundary%2C%20the%20other%20half%20is%20always%20a%20plain%20sorted%20run
index:   0   1   2   3   4   5   6
value:  10  20  30  40  50   8   9
        └─── sorted run 1 ────┘ └ run 2 ┘
         mid = 3 → arr[low]=10 < arr[mid]=40, so [0..3] is sorted
```

> [!NOTE] Idea
>
> At every step <strong>one of the two halves is sorted</strong> — if `arr[low] < arr[mid]` the left half is, otherwise the right half is. Check whether `x` lies inside the sorted half (a simple range test); if yes, search there, otherwise search the other half. Each step still discards half the array.

```python filename:Python
def search_rotated(arr, x):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] == x:
            return mid
        if arr[low] <= arr[mid]:                 # left half [low..mid] is sorted
            if arr[low] <= x < arr[mid]:
                high = mid - 1
            else:
                low = mid + 1
        else:                                    # right half [mid..high] is sorted
            if arr[mid] < x <= arr[high]:
                low = mid + 1
            else:
                high = mid - 1
    return -1

a = [10, 20, 30, 40, 50, 8, 9]
print("x = 30 →", search_rotated(a, 30))
print("x = 8 →", search_rotated(a, 8))
print("x = 40 →", search_rotated([100, 200, 300, 10, 20], 40))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int searchRotated(const vector<int>& arr, int x) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == x) return mid;
        if (arr[low] <= arr[mid]) {              // left half [low..mid] is sorted
            if (arr[low] <= x && x < arr[mid]) high = mid - 1;
            else low = mid + 1;
        } else {                                 // right half [mid..high] is sorted
            if (arr[mid] < x && x <= arr[high]) low = mid + 1;
            else high = mid - 1;
        }
    }
    return -1;
}

int main() {
    vector<int> a = {10, 20, 30, 40, 50, 8, 9};
    cout << "x = 30 → " << searchRotated(a, 30) << "\n";
    cout << "x = 8 → " << searchRotated(a, 8) << "\n";
    cout << "x = 40 → " << searchRotated({100, 200, 300, 10, 20}, 40) << "\n";
}
```

```java filename:Java
public class Main {
    static int searchRotated(int[] arr, int x) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == x) return mid;
            if (arr[low] <= arr[mid]) {          // left half [low..mid] is sorted
                if (arr[low] <= x && x < arr[mid]) high = mid - 1;
                else low = mid + 1;
            } else {                             // right half [mid..high] is sorted
                if (arr[mid] < x && x <= arr[high]) low = mid + 1;
                else high = mid - 1;
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] a = {10, 20, 30, 40, 50, 8, 9};
        System.out.println("x = 30 → " + searchRotated(a, 30));
        System.out.println("x = 8 → " + searchRotated(a, 8));
        System.out.println("x = 40 → " + searchRotated(new int[]{100, 200, 300, 10, 20}, 40));
    }
}
```

```javascript filename:JavaScript
function searchRotated(arr, x) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] === x) return mid;
        if (arr[low] <= arr[mid]) {              // left half [low..mid] is sorted
            if (arr[low] <= x && x < arr[mid]) high = mid - 1;
            else low = mid + 1;
        } else {                                 // right half [mid..high] is sorted
            if (arr[mid] < x && x <= arr[high]) low = mid + 1;
            else high = mid - 1;
        }
    }
    return -1;
}

const a = [10, 20, 30, 40, 50, 8, 9];
console.log("x = 30 →", searchRotated(a, 30));
console.log("x = 8 →", searchRotated(a, 8));
console.log("x = 40 →", searchRotated([100, 200, 300, 10, 20], 40));
```

```text filename:Output
x = 30 → 2
x = 8 → 5
x = 40 → -1
```

Time O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> Use `arr[low] <= arr[mid]` (not `<`) so that a two-element window like `[8, 9]` with `mid == low` is classified as “left half sorted”. The original notes used `<`, which sends `x = 8` the wrong way in such windows. With <strong>duplicates</strong> (`[3, 1, 3, 3, 3]`) neither half can be identified and the worst case degrades to `O(n)`.

# Find a peak element

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [5, 10, 20, 15, 7]`<br><strong>Output:</strong> `20`<br><strong>Input:</strong> `arr = [10, 20, 15, 5, 23, 90, 67]`<br><strong>Output:</strong> `20 (90 is also a valid answer)`

A <strong>peak</strong> is an element that is not smaller than its neighbours (the ends only have one neighbour). Every array has at least one peak — the maximum is always one — but we only need <em>any</em> peak, which is what makes `O(log n)` possible.

> [!NOTE] Idea
>
> Look at `mid`. If it is a peak, done. If its <strong>left</strong> neighbour is bigger, the left half must contain a peak: walking left along rising values must eventually stop, either at a local maximum or at index 0 — both are peaks. Symmetrically, if the right neighbour is bigger, go right.

```text filename:Binary%20search%20follows%20the%20rising%20side%3B%20it%20never%20needs%20the%20global%20maximum
10  20  15   5  23  90  67
 0   1   2   3   4   5   6
             ↑ mid=3: arr[2]=15 > 5 → a peak exists on the left
     ↑ mid=1: 10 ≤ 20 ≥ 15 → peak = 20
```

```python filename:Python
# Naive: check every element against its neighbours — O(n)
def get_peak(arr):
    n = len(arr)
    for i in range(n):
        left_ok = i == 0 or arr[i - 1] <= arr[i]
        right_ok = i == n - 1 or arr[i + 1] <= arr[i]
        if left_ok and right_ok:
            return arr[i]

print(get_peak([5, 10, 20, 15, 7]))
print(get_peak([10, 20, 15, 5, 23, 90, 67]))
```

```text filename:Output
20
20
```

```python filename:Python
def get_peak(arr):
    n = len(arr)
    low, high = 0, n - 1
    while low <= high:
        mid = low + (high - low) // 2
        left_ok = mid == 0 or arr[mid - 1] <= arr[mid]
        right_ok = mid == n - 1 or arr[mid + 1] <= arr[mid]
        if left_ok and right_ok:
            return arr[mid]                # mid is a peak
        if mid > 0 and arr[mid - 1] > arr[mid]:
            high = mid - 1                 # rising towards the left → peak there
        else:
            low = mid + 1                  # rising towards the right
    return -1

print(get_peak([5, 10, 20, 15, 7]))
print(get_peak([10, 20, 15, 5, 23, 90, 67]))
print(get_peak([1, 2, 3]))
print(get_peak([7]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int getPeak(const vector<int>& arr) {
    int n = arr.size();
    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        bool leftOk = mid == 0 || arr[mid - 1] <= arr[mid];
        bool rightOk = mid == n - 1 || arr[mid + 1] <= arr[mid];
        if (leftOk && rightOk) return arr[mid];          // mid is a peak
        if (mid > 0 && arr[mid - 1] > arr[mid]) high = mid - 1;   // rising to the left
        else low = mid + 1;                                       // rising to the right
    }
    return -1;
}

int main() {
    cout << getPeak({5, 10, 20, 15, 7}) << "\n";
    cout << getPeak({10, 20, 15, 5, 23, 90, 67}) << "\n";
    cout << getPeak({1, 2, 3}) << "\n";
    cout << getPeak({7}) << "\n";
}
```

```java filename:Java
public class Main {
    static int getPeak(int[] arr) {
        int n = arr.length;
        int low = 0, high = n - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            boolean leftOk = mid == 0 || arr[mid - 1] <= arr[mid];
            boolean rightOk = mid == n - 1 || arr[mid + 1] <= arr[mid];
            if (leftOk && rightOk) return arr[mid];      // mid is a peak
            if (mid > 0 && arr[mid - 1] > arr[mid]) high = mid - 1;   // rising to the left
            else low = mid + 1;                                       // rising to the right
        }
        return -1;
    }

    public static void main(String[] args) {
        System.out.println(getPeak(new int[]{5, 10, 20, 15, 7}));
        System.out.println(getPeak(new int[]{10, 20, 15, 5, 23, 90, 67}));
        System.out.println(getPeak(new int[]{1, 2, 3}));
        System.out.println(getPeak(new int[]{7}));
    }
}
```

```javascript filename:JavaScript
function getPeak(arr) {
    const n = arr.length;
    let low = 0, high = n - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        const leftOk = mid === 0 || arr[mid - 1] <= arr[mid];
        const rightOk = mid === n - 1 || arr[mid + 1] <= arr[mid];
        if (leftOk && rightOk) return arr[mid];          // mid is a peak
        if (mid > 0 && arr[mid - 1] > arr[mid]) high = mid - 1;   // rising to the left
        else low = mid + 1;                                       // rising to the right
    }
    return -1;
}

console.log(getPeak([5, 10, 20, 15, 7]));
console.log(getPeak([10, 20, 15, 5, 23, 90, 67]));
console.log(getPeak([1, 2, 3]));
console.log(getPeak([7]));
```

```text filename:Output
20
20
3
7
```

Time O(log n) · Space O(1)

> [!NOTE] Key point
>
> The array is <strong>not sorted</strong> here — binary search works because the predicate “a peak exists in this half” can be decided from `mid` and one neighbour. The same reasoning finds the maximum of a <em>bitonic</em> array (strictly increasing then strictly decreasing).

# Two-pointer approach: pair with a given sum

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 5, 8, 12, 30], x = 17`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `arr = [3, 8, 13, 18], x = 14`<br><strong>Output:</strong> `false`

Given a <strong>sorted</strong> array, is there a pair whose sum is `x`? The brute force tries all `n(n-1)/2` pairs.

```python filename:Python
# Naive: every pair — O(n²)
def has_pair(arr, x):
    n = len(arr)
    for i in range(n - 1):
        for j in range(i + 1, n):
            if arr[i] + arr[j] == x:
                return True
    return False

print("true" if has_pair([2, 5, 8, 12, 30], 17) else "false")
print("true" if has_pair([3, 8, 13, 18], 14) else "false")
```

```text filename:Output
true
false
```

> [!NOTE] Idea
>
> Put `i` at the start and `j` at the end. If `arr[i] + arr[j] < x` the sum must grow — only moving `i` right can do that (every pair with this `i` and a smaller `j` is even smaller, so `i` is finished). If the sum is too large, move `j` left. Each step retires one index, so at most `n` steps.

```python filename:Python
def has_pair(arr, x):
    i, j = 0, len(arr) - 1
    while i < j:
        s = arr[i] + arr[j]
        if s == x:
            return True
        if s < x:
            i += 1          # need a bigger sum
        else:
            j -= 1          # need a smaller sum
    return False

print("[2, 5, 8, 12, 30] x=17 →", "true" if has_pair([2, 5, 8, 12, 30], 17) else "false")
print("[3, 8, 13, 18] x=14 →", "true" if has_pair([3, 8, 13, 18], 14) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool hasPair(const vector<int>& arr, int x) {
    int i = 0, j = (int)arr.size() - 1;
    while (i < j) {
        int s = arr[i] + arr[j];
        if (s == x) return true;
        if (s < x) i++;       // need a bigger sum
        else j--;             // need a smaller sum
    }
    return false;
}

int main() {
    cout << "[2, 5, 8, 12, 30] x=17 → " << (hasPair({2, 5, 8, 12, 30}, 17) ? "true" : "false") << "\n";
    cout << "[3, 8, 13, 18] x=14 → " << (hasPair({3, 8, 13, 18}, 14) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean hasPair(int[] arr, int x) {
        int i = 0, j = arr.length - 1;
        while (i < j) {
            int s = arr[i] + arr[j];
            if (s == x) return true;
            if (s < x) i++;   // need a bigger sum
            else j--;         // need a smaller sum
        }
        return false;
    }

    public static void main(String[] args) {
        System.out.println("[2, 5, 8, 12, 30] x=17 → " + hasPair(new int[]{2, 5, 8, 12, 30}, 17));
        System.out.println("[3, 8, 13, 18] x=14 → " + hasPair(new int[]{3, 8, 13, 18}, 14));
    }
}
```

```javascript filename:JavaScript
function hasPair(arr, x) {
    let i = 0, j = arr.length - 1;
    while (i < j) {
        const s = arr[i] + arr[j];
        if (s === x) return true;
        if (s < x) i++;       // need a bigger sum
        else j--;             // need a smaller sum
    }
    return false;
}

console.log("[2, 5, 8, 12, 30] x=17 →", hasPair([2, 5, 8, 12, 30], 17));
console.log("[3, 8, 13, 18] x=14 →", hasPair([3, 8, 13, 18], 14));
```

```text filename:Output
[2, 5, 8, 12, 30] x=17 → true
[3, 8, 13, 18] x=14 → false
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> If the array is <strong>not</strong> sorted, two pointers need an `O(n log n)` sort first; a hash set gives `O(n)` time with `O(n)` space instead (see Hashing). Two pointers win when the input is already sorted or when `O(1)` extra space is required.

# Triplet in a sorted array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 3, 4, 8, 9, 20, 40], x = 32`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `arr = [1, 2, 5, 6], x = 14`<br><strong>Output:</strong> `false`

> [!NOTE] Idea
>
> Fix the smallest element `arr[i]` of the triplet, then ask the two-pointer routine for a <strong>pair with sum </strong><strong>`x - arr[i]`</strong> in the suffix `arr[i+1..]`. Searching only to the right avoids reusing `arr[i]` and avoids counting the same triplet three times. `n` fixes × `O(n)` pair search = `O(n²)`, down from the `O(n³)` triple loop.

```python filename:Python
def has_pair_from(arr, start, x):
    i, j = start, len(arr) - 1
    while i < j:
        s = arr[i] + arr[j]
        if s == x:
            return True
        if s < x:
            i += 1
        else:
            j -= 1
    return False

def has_triplet(arr, x):
    for i in range(len(arr) - 2):              # fix the smallest element
        if has_pair_from(arr, i + 1, x - arr[i]):
            return True
    return False

print("[2, 3, 4, 8, 9, 20, 40] x=32 →", "true" if has_triplet([2, 3, 4, 8, 9, 20, 40], 32) else "false")
print("[1, 2, 5, 6] x=14 →", "true" if has_triplet([1, 2, 5, 6], 14) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool hasPairFrom(const vector<int>& arr, int start, int x) {
    int i = start, j = (int)arr.size() - 1;
    while (i < j) {
        int s = arr[i] + arr[j];
        if (s == x) return true;
        if (s < x) i++; else j--;
    }
    return false;
}

bool hasTriplet(const vector<int>& arr, int x) {
    int n = arr.size();
    for (int i = 0; i < n - 2; i++)                 // fix the smallest element
        if (hasPairFrom(arr, i + 1, x - arr[i])) return true;
    return false;
}

int main() {
    cout << "[2, 3, 4, 8, 9, 20, 40] x=32 → " << (hasTriplet({2, 3, 4, 8, 9, 20, 40}, 32) ? "true" : "false") << "\n";
    cout << "[1, 2, 5, 6] x=14 → " << (hasTriplet({1, 2, 5, 6}, 14) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean hasPairFrom(int[] arr, int start, int x) {
        int i = start, j = arr.length - 1;
        while (i < j) {
            int s = arr[i] + arr[j];
            if (s == x) return true;
            if (s < x) i++; else j--;
        }
        return false;
    }

    static boolean hasTriplet(int[] arr, int x) {
        for (int i = 0; i < arr.length - 2; i++)    // fix the smallest element
            if (hasPairFrom(arr, i + 1, x - arr[i])) return true;
        return false;
    }

    public static void main(String[] args) {
        System.out.println("[2, 3, 4, 8, 9, 20, 40] x=32 → " + hasTriplet(new int[]{2, 3, 4, 8, 9, 20, 40}, 32));
        System.out.println("[1, 2, 5, 6] x=14 → " + hasTriplet(new int[]{1, 2, 5, 6}, 14));
    }
}
```

```javascript filename:JavaScript
function hasPairFrom(arr, start, x) {
    let i = start, j = arr.length - 1;
    while (i < j) {
        const s = arr[i] + arr[j];
        if (s === x) return true;
        if (s < x) i++; else j--;
    }
    return false;
}

function hasTriplet(arr, x) {
    for (let i = 0; i < arr.length - 2; i++)         // fix the smallest element
        if (hasPairFrom(arr, i + 1, x - arr[i])) return true;
    return false;
}

console.log("[2, 3, 4, 8, 9, 20, 40] x=32 →", hasTriplet([2, 3, 4, 8, 9, 20, 40], 32));
console.log("[1, 2, 5, 6] x=14 →", hasTriplet([1, 2, 5, 6], 14));
```

```text filename:Output
[2, 3, 4, 8, 9, 20, 40] x=32 → true
[1, 2, 5, 6] x=14 → false
```

Time O(n²) · Space O(1)

> [!NOTE] Key point
>
> This is the standard <strong>3-Sum</strong> technique. To <em>list</em> all distinct triplets instead of answering yes/no, skip over equal values after each move of `i`, `j` and the fixed index so duplicates are not reported twice.

# Median of two sorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a1 = [10, 20, 30, 40, 50], a2 = [5, 15, 25, 35, 45]`<br><strong>Output:</strong> `27.5`<br><strong>Input:</strong> `a1 = [1, 2, 3], a2 = [4, 5, 6]`<br><strong>Output:</strong> `3.5`<br><strong>Input:</strong> `a1 = [1, 3, 5], a2 = [2, 4, 6, 8, 10]`<br><strong>Output:</strong> `4.5`

The median of the merged array is wanted, <strong>without merging</strong>. Merging takes `O(n1 + n2)` time and space; the target is `O(log min(n1, n2))`.

```python filename:Python
# Naive: merge (like merge sort's merge step), then pick the middle — O(n1 + n2)
def median_by_merge(a1, a2):
    merged, i, j = [], 0, 0
    while i < len(a1) and j < len(a2):
        if a1[i] <= a2[j]:
            merged.append(a1[i]); i += 1
        else:
            merged.append(a2[j]); j += 1
    merged += a1[i:] + a2[j:]
    n = len(merged)
    if n % 2 == 1:
        return merged[n // 2]
    return (merged[n // 2 - 1] + merged[n // 2]) / 2

print(median_by_merge([10, 20, 30, 40, 50], [5, 15, 25, 35, 45]))
print(median_by_merge([1, 3, 5], [2, 4, 6, 8, 10]))
```

```text filename:Output
27.5
4.5
```

> [!NOTE] Idea
>
> The median splits the `n1 + n2` elements into a <strong>left half</strong> and a <strong>right half</strong> of (almost) equal size. Take `i1` elements from `a1` and `i2 = (n1 + n2 + 1) / 2 - i1` from `a2` to form the left half. The split is correct exactly when every left element is `<=` every right element: `maxLeft1 <= minRight2` and `maxLeft2 <= minRight1`. If `maxLeft1 > minRight2`, `i1` is too big — binary search `i1` over `[0, n1]`.

```text filename:A%20valid%20partition%3A%20five%20elements%20on%20the%20left%2C%20five%20on%20the%20right
a1 = 10 20 | 30 40 50       i1 = 2  →  maxLeft1 = 20, minRight1 = 30
a2 =  5 15 25 | 35 45       i2 = 3  →  maxLeft2 = 25, minRight2 = 35

left half  = {10, 20, 5, 15, 25}   max = 25
right half = {30, 40, 50, 35, 45}  min = 30
20 ≤ 35 and 25 ≤ 30 ✓  →  median = (25 + 30) / 2 = 27.5
```

1. <strong>Make </strong><strong>`a1`</strong><strong> the shorter array</strong>

   Swap if needed, so the search space is `[0, n1]` with `n1 = min`, and `i2` always stays within `[0, n2]`.

2. <strong>Binary search </strong><strong>`i1`</strong>

   `i1 = (low + high) / 2`, `i2 = (n1 + n2 + 1) / 2 - i1`. Use `-∞` / `+∞` when a side of a split is empty.

3. <strong>Check the partition</strong>

   `maxLeft1 <= minRight2` and `maxLeft2 <= minRight1` → found. If `maxLeft1 > minRight2` move `high = i1 - 1`, else `low = i1 + 1`.

4. <strong>Read the median</strong>

   Odd total: `max(maxLeft1, maxLeft2)`. Even total: average of that and `min(minRight1, minRight2)`.

To keep the four programs' output byte-identical the code computes <strong>twice the median</strong> as an integer (the sum of the two middle values) and prints it as `k.0` or `k.5` — the median of integers is always a whole or half number.

```python filename:Python
INF = float("inf")

def median_x2(a1, a2):
    if len(a1) > len(a2):
        a1, a2 = a2, a1                     # binary search over the shorter array
    n1, n2 = len(a1), len(a2)
    low, high = 0, n1
    while low <= high:
        i1 = (low + high) // 2
        i2 = (n1 + n2 + 1) // 2 - i1
        max_l1 = -INF if i1 == 0 else a1[i1 - 1]
        min_r1 = INF if i1 == n1 else a1[i1]
        max_l2 = -INF if i2 == 0 else a2[i2 - 1]
        min_r2 = INF if i2 == n2 else a2[i2]
        if max_l1 <= min_r2 and max_l2 <= min_r1:       # valid partition
            if (n1 + n2) % 2 == 1:
                return 2 * max(max_l1, max_l2)
            return max(max_l1, max_l2) + min(min_r1, min_r2)
        if max_l1 > min_r2:
            high = i1 - 1                    # took too many from a1
        else:
            low = i1 + 1                     # took too few from a1
    return 0

def show(a1, a2):
    m2 = int(median_x2(a1, a2))
    print(f"{m2 // 2}.{'5' if m2 % 2 else '0'}")

show([10, 20, 30, 40, 50], [5, 15, 25, 35, 45])
show([1, 2, 3], [4, 5, 6])
show([1, 3, 5], [2, 4, 6, 8, 10])
show([1, 2], [3])
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <climits>
#include <iostream>
#include <vector>
using namespace std;

int medianX2(vector<int> a1, vector<int> a2) {
    if (a1.size() > a2.size()) swap(a1, a2);        // binary search over the shorter array
    int n1 = a1.size(), n2 = a2.size();
    int low = 0, high = n1;
    while (low <= high) {
        int i1 = (low + high) / 2;
        int i2 = (n1 + n2 + 1) / 2 - i1;
        int maxL1 = i1 == 0 ? INT_MIN : a1[i1 - 1];
        int minR1 = i1 == n1 ? INT_MAX : a1[i1];
        int maxL2 = i2 == 0 ? INT_MIN : a2[i2 - 1];
        int minR2 = i2 == n2 ? INT_MAX : a2[i2];
        if (maxL1 <= minR2 && maxL2 <= minR1) {        // valid partition
            if ((n1 + n2) % 2 == 1) return 2 * max(maxL1, maxL2);
            return max(maxL1, maxL2) + min(minR1, minR2);
        }
        if (maxL1 > minR2) high = i1 - 1;              // took too many from a1
        else low = i1 + 1;                             // took too few from a1
    }
    return 0;
}

void show(const vector<int>& a1, const vector<int>& a2) {
    int m2 = medianX2(a1, a2);
    cout << m2 / 2 << "." << (m2 % 2 ? "5" : "0") << "\n";
}

int main() {
    show({10, 20, 30, 40, 50}, {5, 15, 25, 35, 45});
    show({1, 2, 3}, {4, 5, 6});
    show({1, 3, 5}, {2, 4, 6, 8, 10});
    show({1, 2}, {3});
}
```

```java filename:Java
public class Main {
    static int medianX2(int[] a1, int[] a2) {
        if (a1.length > a2.length) { int[] t = a1; a1 = a2; a2 = t; }   // search the shorter array
        int n1 = a1.length, n2 = a2.length;
        int low = 0, high = n1;
        while (low <= high) {
            int i1 = (low + high) / 2;
            int i2 = (n1 + n2 + 1) / 2 - i1;
            int maxL1 = i1 == 0 ? Integer.MIN_VALUE : a1[i1 - 1];
            int minR1 = i1 == n1 ? Integer.MAX_VALUE : a1[i1];
            int maxL2 = i2 == 0 ? Integer.MIN_VALUE : a2[i2 - 1];
            int minR2 = i2 == n2 ? Integer.MAX_VALUE : a2[i2];
            if (maxL1 <= minR2 && maxL2 <= minR1) {    // valid partition
                if ((n1 + n2) % 2 == 1) return 2 * Math.max(maxL1, maxL2);
                return Math.max(maxL1, maxL2) + Math.min(minR1, minR2);
            }
            if (maxL1 > minR2) high = i1 - 1;          // took too many from a1
            else low = i1 + 1;                         // took too few from a1
        }
        return 0;
    }

    static void show(int[] a1, int[] a2) {
        int m2 = medianX2(a1, a2);
        System.out.println(m2 / 2 + "." + (m2 % 2 == 1 ? "5" : "0"));
    }

    public static void main(String[] args) {
        show(new int[]{10, 20, 30, 40, 50}, new int[]{5, 15, 25, 35, 45});
        show(new int[]{1, 2, 3}, new int[]{4, 5, 6});
        show(new int[]{1, 3, 5}, new int[]{2, 4, 6, 8, 10});
        show(new int[]{1, 2}, new int[]{3});
    }
}
```

```javascript filename:JavaScript
function medianX2(a1, a2) {
    if (a1.length > a2.length) [a1, a2] = [a2, a1];   // binary search over the shorter array
    const n1 = a1.length, n2 = a2.length;
    let low = 0, high = n1;
    while (low <= high) {
        const i1 = Math.floor((low + high) / 2);
        const i2 = Math.floor((n1 + n2 + 1) / 2) - i1;
        const maxL1 = i1 === 0 ? -Infinity : a1[i1 - 1];
        const minR1 = i1 === n1 ? Infinity : a1[i1];
        const maxL2 = i2 === 0 ? -Infinity : a2[i2 - 1];
        const minR2 = i2 === n2 ? Infinity : a2[i2];
        if (maxL1 <= minR2 && maxL2 <= minR1) {        // valid partition
            if ((n1 + n2) % 2 === 1) return 2 * Math.max(maxL1, maxL2);
            return Math.max(maxL1, maxL2) + Math.min(minR1, minR2);
        }
        if (maxL1 > minR2) high = i1 - 1;              // took too many from a1
        else low = i1 + 1;                             // took too few from a1
    }
    return 0;
}

function show(a1, a2) {
    const m2 = medianX2(a1, a2);
    console.log(`${Math.floor(m2 / 2)}.${m2 % 2 ? "5" : "0"}`);
}

show([10, 20, 30, 40, 50], [5, 15, 25, 35, 45]);
show([1, 2, 3], [4, 5, 6]);
show([1, 3, 5], [2, 4, 6, 8, 10]);
show([1, 2], [3]);
```

```text filename:Output
27.5
3.5
4.5
2.0
```

Time O(log min(n1, n2)) · Space O(1)

> [!WARNING] Pitfall
>
> Three bugs in the original notes, all fixed above: `maxLeft1` for an empty left part must be `-∞`, not `+∞`; `a2[i2]` and `a2[i2 - 1]` need the same empty-side guards as `a1`, otherwise `i2 == n2` indexes out of range; and the solution assumed `len(a1) <= len(a2)` without enforcing it. Also the notes' answer for `[1, 3, 5]` and `[2, 4, 6, 8, 10]` was `4.0` — the merged array is `1 2 3 4 5 6 8 10`, so the median is `4.5`.

# Repeating element

Constraints that make this problem interesting:

- array size `n >= 2`
- <strong>exactly one</strong> value repeats — any number of times
- all values from `0` to `max(arr)` are present, so `0 <= max(arr) <= n - 2`

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [0, 2, 1, 3, 2, 2]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [1, 3, 2, 4, 3, 3]`<br><strong>Output:</strong> `3`

| Approach | Time | Extra space | Modifies array? |
| --- | --- | --- | --- |
| Compare every pair | `O(n²)` | `O(1)` | no |
| Sort, then compare neighbours | `O(n log n)` | `O(1)` | <strong>yes</strong> |
| Hash set of seen values | `O(n)` | `O(n)` | no |
| Boolean `visited` array (values are `< n`) | `O(n)` | `O(n)` | no |
| Floyd's cycle detection on `i → arr[i]` | `O(n)` | `O(1)` | no |

```python filename:Python
# Sort-based: O(n log n), but the array is reordered
def repeating_by_sort(arr):
    arr = sorted(arr)
    for i in range(len(arr) - 1):
        if arr[i] == arr[i + 1]:
            return arr[i]
    return -1

# Set-based: O(n) time but O(n) extra space
def repeating_by_set(arr):
    seen = set()
    for x in arr:
        if x in seen:
            return x
        seen.add(x)
    return -1

print(repeating_by_sort([0, 2, 1, 3, 2, 2]), repeating_by_set([0, 2, 1, 3, 2, 2]))
print(repeating_by_sort([1, 3, 2, 4, 3, 3]), repeating_by_set([1, 3, 2, 4, 3, 3]))
```

```text filename:Output
2 2
3 3
```

Because every value is smaller than `n`, a boolean array indexed by value replaces the hash set — same `O(n)` time, less constant overhead, no hashing.

```python filename:Python
def repeating(arr):
    visited = [False] * len(arr)       # values lie in 0..n-2, so index by value
    for x in arr:
        if visited[x]:
            return x
        visited[x] = True
    return -1

print(repeating([0, 2, 1, 3, 2, 2]))
print(repeating([1, 3, 2, 4, 3, 3]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int repeating(const vector<int>& arr) {
    vector<bool> visited(arr.size(), false);   // values lie in 0..n-2, so index by value
    for (int x : arr) {
        if (visited[x]) return x;
        visited[x] = true;
    }
    return -1;
}

int main() {
    cout << repeating({0, 2, 1, 3, 2, 2}) << "\n";
    cout << repeating({1, 3, 2, 4, 3, 3}) << "\n";
}
```

```java filename:Java
public class Main {
    static int repeating(int[] arr) {
        boolean[] visited = new boolean[arr.length];  // values lie in 0..n-2, so index by value
        for (int x : arr) {
            if (visited[x]) return x;
            visited[x] = true;
        }
        return -1;
    }

    public static void main(String[] args) {
        System.out.println(repeating(new int[]{0, 2, 1, 3, 2, 2}));
        System.out.println(repeating(new int[]{1, 3, 2, 4, 3, 3}));
    }
}
```

```javascript filename:JavaScript
function repeating(arr) {
    const visited = new Array(arr.length).fill(false);   // values lie in 0..n-2, so index by value
    for (const x of arr) {
        if (visited[x]) return x;
        visited[x] = true;
    }
    return -1;
}

console.log(repeating([0, 2, 1, 3, 2, 2]));
console.log(repeating([1, 3, 2, 4, 3, 3]));
```

```text filename:Output
2
3
```

Time O(n) · Space O(n)

# Repeating element in O(n) time, O(1) space, array unchanged

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [0, 2, 1, 3, 2, 2]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [1, 3, 2, 4, 3, 3]`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `arr = [0, 0]`<br><strong>Output:</strong> `0`

Now the array may not be modified and no extra array is allowed. The trick is to stop looking at the values as <em>data</em> and treat them as <em>pointers</em>.

> [!NOTE] Idea
>
> Define `next(i) = arr[i] + 1`. Index `0` is never anybody's `next` (values are `>= 0`, so `next >= 1`), and every index has exactly one outgoing edge — the structure is a <strong>linked list that ends in a cycle</strong> (a ρ shape), starting at `0`. The repeated value is the node with two incoming edges, which is precisely where the cycle begins. Floyd's tortoise-and-hare finds that node in `O(n)` with two integer variables; subtract the `+1` to recover the value.

```text filename:Indices%20as%20a%20functional%20graph%3A%20the%20cycle%20entry%20has%20two%20in-edges%2C%20i.e.%20the%20repeated%20value
arr = [0, 2, 1, 3, 2, 2]        next(i) = arr[i] + 1

0 → 1 → 3 → 4 → 3 → 4 → …        4 and 5 both point to 3
            ↑___|                 (arr[4] = arr[5] = 2)
        5 ──┘
cycle starts at node 3  →  value = 3 - 1 = 2
```

1. <strong>Phase 1 — meet inside the cycle</strong>

   `slow = next(slow)`, `fast = next(next(fast))` from `0` until they are equal. They must meet because once both are on the cycle the gap shrinks by one every step.

2. <strong>Phase 2 — find the entry</strong>

   Reset `slow = 0`; move both one step at a time. They meet exactly at the cycle entry (the distance from `0` to the entry equals the distance from the meeting point to the entry, modulo the cycle length).

3. <strong>Recover the value</strong>

   The entry index is `v + 1` for the repeated value `v`, so return `entry - 1`.

```python filename:Python
def repeating(arr):
    nxt = lambda i: arr[i] + 1          # +1 so that index 0 is never a target
    slow = fast = 0
    while True:                         # phase 1: meet somewhere on the cycle
        slow = nxt(slow)
        fast = nxt(nxt(fast))
        if slow == fast:
            break
    slow = 0                            # phase 2: walk to the cycle entry
    while slow != fast:
        slow = nxt(slow)
        fast = nxt(fast)
    return slow - 1

print(repeating([0, 2, 1, 3, 2, 2]))
print(repeating([1, 3, 2, 4, 3, 3]))
print(repeating([0, 0]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int repeating(const vector<int>& arr) {
    auto next = [&](int i) { return arr[i] + 1; };   // +1 so that index 0 is never a target
    int slow = 0, fast = 0;
    do {                                             // phase 1: meet somewhere on the cycle
        slow = next(slow);
        fast = next(next(fast));
    } while (slow != fast);
    slow = 0;                                        // phase 2: walk to the cycle entry
    while (slow != fast) {
        slow = next(slow);
        fast = next(fast);
    }
    return slow - 1;
}

int main() {
    cout << repeating({0, 2, 1, 3, 2, 2}) << "\n";
    cout << repeating({1, 3, 2, 4, 3, 3}) << "\n";
    cout << repeating({0, 0}) << "\n";
}
```

```java filename:Java
public class Main {
    static int repeating(int[] arr) {
        int slow = 0, fast = 0;
        do {                                         // phase 1: meet somewhere on the cycle
            slow = arr[slow] + 1;                    // +1 so that index 0 is never a target
            fast = arr[arr[fast] + 1] + 1;
        } while (slow != fast);
        slow = 0;                                    // phase 2: walk to the cycle entry
        while (slow != fast) {
            slow = arr[slow] + 1;
            fast = arr[fast] + 1;
        }
        return slow - 1;
    }

    public static void main(String[] args) {
        System.out.println(repeating(new int[]{0, 2, 1, 3, 2, 2}));
        System.out.println(repeating(new int[]{1, 3, 2, 4, 3, 3}));
        System.out.println(repeating(new int[]{0, 0}));
    }
}
```

```javascript filename:JavaScript
function repeating(arr) {
    const next = (i) => arr[i] + 1;     // +1 so that index 0 is never a target
    let slow = 0, fast = 0;
    do {                                // phase 1: meet somewhere on the cycle
        slow = next(slow);
        fast = next(next(fast));
    } while (slow !== fast);
    slow = 0;                           // phase 2: walk to the cycle entry
    while (slow !== fast) {
        slow = next(slow);
        fast = next(fast);
    }
    return slow - 1;
}

console.log(repeating([0, 2, 1, 3, 2, 2]));
console.log(repeating([1, 3, 2, 4, 3, 3]));
console.log(repeating([0, 0]));
```

```text filename:Output
2
3
0
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> The `+1` shift matters. Without it, `arr[0] == 0` makes index `0` point to itself and the “start” is already inside a cycle, so Floyd's phase 2 returns the wrong node. The popular variant <em>Find the Duplicate Number</em> (`n + 1` values in `1..n`) needs no shift because its values are already `>= 1` — use `next(i) = arr[i]` and return the entry itself. The notes' example `[1, 1]` belongs to that variant (it violates `max(arr) <= n - 2`), so it was replaced by `[0, 0]`.

# Allocate minimum number of pages

> [!TIP] Example
>
> <strong>Input:</strong> `pages = [10, 20, 30, 40], k = 2`<br><strong>Output:</strong> `60`<br><strong>Input:</strong> `pages = [10, 20, 30], k = 1`<br><strong>Output:</strong> `60`<br><strong>Input:</strong> `pages = [10, 20, 30, 40], k = 3`<br><strong>Output:</strong> `40`

`n` books with `pages[i]` pages must be split among `k` students. Each student gets a <strong>contiguous</strong> run of books and every book goes to someone. Minimise the maximum number of pages any one student reads. For `[10, 20, 30, 40]` and `k = 2` the best split is `[10, 20, 30] | [40]` → `max(60, 40) = 60`.

```python filename:Python
# Naive: try every position for the last cut, recursively — exponential
def min_pages(pages, n, k):
    if k == 1:
        return sum(pages[:n])          # one student takes all remaining books
    if n == 1:
        return pages[0]
    best = float("inf")
    for i in range(1, n):              # last student gets pages[i..n-1]
        best = min(best, max(min_pages(pages, i, k - 1), sum(pages[i:n])))
    return best

print(min_pages([10, 20, 30, 40], 4, 2))
print(min_pages([10, 20, 30], 3, 1))
```

```text filename:Output
60
60
```

The recursion explores `C(n-1, k-1)` ways of placing cuts. Memoising it gives an `O(n² k)` dynamic programme — still slow. The breakthrough is to search over the <strong>answer</strong> instead of over the cuts.

> [!NOTE] Idea
>
> Ask the inverse question: <em>“can every student stay within </em><em>`cap`</em><em> pages?”</em> Greedily fill students left to right; start a new student whenever adding the next book would exceed `cap`. If at most `k` students were needed, `cap` is feasible. Feasibility is <strong>monotone</strong> — a larger cap is never harder — so binary search the smallest feasible cap between `max(pages)` (one book must fit) and `sum(pages)` (one student takes all).

1. <strong>Bounds</strong>

   `low = max(pages)`, `high = sum(pages)`. The answer is always in this range.

2. <strong>Probe</strong>

   `mid = (low + high) / 2`. Run the greedy `isFeasible(mid)` in `O(n)`.

3. <strong>Shrink</strong>

   Feasible → record `mid`, try smaller (`high = mid - 1`). Not feasible → `low = mid + 1`.

```python filename:Python
def is_feasible(pages, k, cap):
    students, current = 1, 0
    for pg in pages:
        if pg > cap:
            return False
        if current + pg > cap:          # this book starts a new student's share
            students += 1
            current = pg
        else:
            current += pg
    return students <= k

def min_pages(pages, k):
    low, high = max(pages), sum(pages)
    result = high
    while low <= high:                  # binary search on the answer
        mid = low + (high - low) // 2
        if is_feasible(pages, k, mid):
            result = mid
            high = mid - 1              # try an even smaller cap
        else:
            low = mid + 1
    return result

print(min_pages([10, 20, 30, 40], 2))
print(min_pages([10, 20, 30], 1))
print(min_pages([10, 20, 30, 40], 3))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>
using namespace std;

bool isFeasible(const vector<int>& pages, int k, int cap) {
    int students = 1, current = 0;
    for (int pg : pages) {
        if (pg > cap) return false;
        if (current + pg > cap) {       // this book starts a new student's share
            students++;
            current = pg;
        } else {
            current += pg;
        }
    }
    return students <= k;
}

int minPages(const vector<int>& pages, int k) {
    int low = *max_element(pages.begin(), pages.end());
    int high = accumulate(pages.begin(), pages.end(), 0);
    int result = high;
    while (low <= high) {               // binary search on the answer
        int mid = low + (high - low) / 2;
        if (isFeasible(pages, k, mid)) { result = mid; high = mid - 1; }   // try smaller
        else low = mid + 1;
    }
    return result;
}

int main() {
    cout << minPages({10, 20, 30, 40}, 2) << "\n";
    cout << minPages({10, 20, 30}, 1) << "\n";
    cout << minPages({10, 20, 30, 40}, 3) << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isFeasible(int[] pages, int k, int cap) {
        int students = 1, current = 0;
        for (int pg : pages) {
            if (pg > cap) return false;
            if (current + pg > cap) {   // this book starts a new student's share
                students++;
                current = pg;
            } else {
                current += pg;
            }
        }
        return students <= k;
    }

    static int minPages(int[] pages, int k) {
        int low = 0, high = 0;
        for (int pg : pages) { low = Math.max(low, pg); high += pg; }
        int result = high;
        while (low <= high) {           // binary search on the answer
            int mid = low + (high - low) / 2;
            if (isFeasible(pages, k, mid)) { result = mid; high = mid - 1; }   // try smaller
            else low = mid + 1;
        }
        return result;
    }

    public static void main(String[] args) {
        System.out.println(minPages(new int[]{10, 20, 30, 40}, 2));
        System.out.println(minPages(new int[]{10, 20, 30}, 1));
        System.out.println(minPages(new int[]{10, 20, 30, 40}, 3));
    }
}
```

```javascript filename:JavaScript
function isFeasible(pages, k, cap) {
    let students = 1, current = 0;
    for (const pg of pages) {
        if (pg > cap) return false;
        if (current + pg > cap) {       // this book starts a new student's share
            students++;
            current = pg;
        } else {
            current += pg;
        }
    }
    return students <= k;
}

function minPages(pages, k) {
    let low = Math.max(...pages), high = pages.reduce((a, b) => a + b, 0);
    let result = high;
    while (low <= high) {               // binary search on the answer
        const mid = low + Math.floor((high - low) / 2);
        if (isFeasible(pages, k, mid)) { result = mid; high = mid - 1; }   // try smaller
        else low = mid + 1;
    }
    return result;
}

console.log(minPages([10, 20, 30, 40], 2));
console.log(minPages([10, 20, 30], 1));
console.log(minPages([10, 20, 30, 40], 3));
```

```text filename:Output
60
60
40
```

Time O(n log S), S = sum of pages · Space O(1)

> [!NOTE] Key point
>
> <strong>Binary search on the answer</strong> is a template worth memorising: <em>Split Array Largest Sum</em>, <em>Painter's Partition</em>, <em>Koko Eating Bananas</em>, <em>Capacity to Ship Packages</em>, <em>Aggressive Cows</em> and <em>Minimum Days to Make Bouquets</em> are all “smallest (or largest) value for which a greedy `O(n)` check passes”. The two things to get right are the bounds and the direction of monotonicity.

> [!WARNING] Pitfall
>
> The notes' `isFeasible` read `n` from a global variable and the naive solution summed slices inside the loop (`O(n)` per cut). Also note `k > n` is impossible to satisfy if every student must receive a book — decide and document that edge case before coding.

# Interview Q&amp;A

```question
When can binary search be applied to an unsorted array?

---

Whenever there is a predicate over positions that is `false … false true … true` (monotone), or a way to tell from `O(1)` local information which half must contain an answer. Peak finding (compare `mid` with a neighbour) and rotated-array search (one half is always sorted) are both examples; the array itself is not sorted.
```

```question
What does “binary search on the answer” mean and when does it apply?

---

Instead of searching the input, search the range of possible answers. It applies when (1) the answer is a number in a known range, (2) you can check in polynomial time whether a candidate works, and (3) feasibility is monotone — if `x` works, every larger (or every smaller) value works too. Minimum pages, Koko bananas and painter's partition fit this mould; each check is a greedy `O(n)` pass.
```

```question
Why does low + (high - low) / 2 matter in C++ and Java?

---

`(low + high)` can overflow a 32-bit `int` when both are near `2³¹ - 1`, yielding a negative `mid` and an out-of-bounds read. `low + (high - low) / 2` never exceeds `high`. Python and JavaScript are not affected (arbitrary-precision ints / 64-bit doubles), but write it the same way for habit.
```

```question
How does the two-pointer method guarantee it does not skip the answer?

---

When `arr[i] + arr[j] < x`, every pair `(i, j')` with `j' < j` has an even smaller sum, so index `i` can never be part of a solution — discarding it is safe. The symmetric argument applies when the sum is too large. Each step permanently retires one index, so the loop terminates after at most `n - 1` steps and never discards a valid pair.
```

```question
Explain Floyd's cycle detection and why it finds the repeated element.

---

Treat each index as a node with one outgoing edge `i → arr[i] + 1`. A node with two incoming edges is a repeated value; with one start node that nobody points to, the path from it enters a cycle exactly at such a node. Phase 1 (slow 1 step, fast 2 steps) meets inside the cycle; phase 2 (reset slow to the start, both 1 step) meets at the cycle entry because the start-to-entry distance equals the meeting-point-to-entry distance modulo the cycle length. Two variables, `O(n)` steps, no writes.
```

```question
Median of two sorted arrays — why search the shorter array?

---

`i1` ranges over `0..n1`; the matching `i2 = (n1 + n2 + 1) / 2 - i1` must stay in `0..n2`. That is guaranteed only when `n1 <= n2`. Searching the shorter array also gives the better `O(log min(n1, n2))` bound and halves the special cases you need to reason about.
```
