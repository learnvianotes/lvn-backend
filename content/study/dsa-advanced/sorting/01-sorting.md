---
id: 683c4692-e4b9-7d29-8fb3-820ac68070cc
key: topic:dsa-advanced/sorting
subject: dsa-advanced
topic: sorting
title: Sorting
slug: sorting
order: 1
---

At this level sorting is a <strong>toolbox, not one algorithm</strong>: the shape of the data (binary, three-valued, small range, uniformly distributed, nearly sorted) decides the algorithm, and the partition / merge / counting ideas behind the sorts solve a whole family of problems on their own.

> [!INFO]
>
> <strong>Sorting decision</strong> — choose the algorithm by asking three questions — <em>how big is </em><em>`n`</em><em>, what do the values look like, and what is the cost of memory versus writes versus comparisons?</em> — then pick the one whose guarantees match. The default (library sort) is right most of the time, but interview problems are built around the exceptions.

# Which algorithm for which input

| Situation | Best choice | Why |
| --- | --- | --- |
| Binary array (two kinds of values) | one partition pass (two pointers) | `O(n)` time, `O(1)` space, no comparison sort needed |
| Array of three values (0/1/2) | Dutch national flag | one pass, three regions |
| Size `n`, values in a small range `k` | counting sort | `Θ(n + k)`, stable |
| Size `n`, values up to `n²` or `n³` | radix sort (base `n`) | `O(d · n)` with `d = 2` or `3` passes |
| Uniformly distributed over a range | bucket sort | expected `O(n)` with `k ≈ n` buckets |
| Memory writes are expensive (flash, EEPROM) | cycle sort | minimum possible writes: each element written once |
| Only adjacent swaps allowed | bubble sort | it is the only one that moves elements one step at a time |
| Small `n` (≈ under 16) | insertion sort | tiny constants, adaptive, no recursion |
| Almost sorted input | insertion sort / Timsort | `O(n + inversions)` |
| Very little extra memory | heap sort / in-place quick sort | `O(1)` or `O(log n)` auxiliary |
| Must be stable, general purpose | merge sort / Timsort | `O(n log n)` worst case, stable |
| Linked list | merge sort | needs no random access; `O(1)` extra space |
| Data on disk (external sorting) | merge sort (k-way) | sequential reads of sorted runs |

The <strong>general-purpose</strong> comparison sorts are merge sort, heap sort and quick sort — all `O(n log n)` on average, each with a different weakness (extra memory, cache behaviour, worst case). Real libraries combine them into <strong>hybrids</strong>:

> [!NOTE] Timsort
>
> Finds the natural <em>runs</em> already present in the data, extends short runs with insertion sort, then merges runs with merge sort using galloping. Stable, `O(n)` on sorted input, `O(n log n)` worst case.

> [!NOTE] Introsort
>
> Quick sort that watches its recursion depth; when it exceeds `2 log₂ n` it switches to heap sort (guaranteeing `O(n log n)`), and finishes small partitions with insertion sort. Unstable, in place.

> [!NOTE] Dual-pivot quick sort
>
> Two pivots split each range into three parts; fewer comparisons and better cache use on random data than one pivot. Java uses it for primitive arrays, where stability does not matter.

| Library call | Algorithm | Stable? |
| --- | --- | --- |
| Python `sorted()`, `list.sort()` | Timsort (merge policy refined to <em>powersort</em> in 3.11+) | yes |
| Java `Arrays.sort(int[])` (primitives) | dual-pivot quick sort | no (irrelevant for primitives) |
| Java `Arrays.sort(Object[])`, `Collections.sort`, `List.sort` | Timsort | yes |
| C++ `std::sort` | introsort | <strong>no</strong> |
| C++ `std::stable_sort` | merge sort (buffer) / in-place merge if no memory | yes |
| C `qsort` | implementation-defined (glibc: merge sort, falling back to quick sort) | not guaranteed |
| JavaScript `Array.prototype.sort` | Timsort in V8 (stable required since ES2019) | yes |

# Stable sort with a custom key in each language

A sort is <strong>stable</strong> when equal keys keep their input order. Sorting students by marks: with a stable sort, two students on 70 stay in the order they were entered. This matters for multi-key sorts (sort by name, then stable-sort by department gives “grouped by department, alphabetical inside”).

```python filename:Python
students = [("Asha", 80), ("Ravi", 70), ("Meena", 80), ("John", 70), ("Zoe", 90)]
students.sort(key=lambda s: s[1])            # Timsort: stable, equal marks keep input order
for name, marks in students:
    print(name, marks)
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

struct Student { string name; int marks; };

int main() {
    vector<Student> students = {{"Asha", 80}, {"Ravi", 70}, {"Meena", 80}, {"John", 70}, {"Zoe", 90}};
    // std::sort (introsort) is NOT stable — use stable_sort when equal keys must keep their order
    stable_sort(students.begin(), students.end(),
                [](const Student& a, const Student& b) { return a.marks < b.marks; });
    for (const Student& s : students) cout << s.name << " " << s.marks << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class Main {
    record Student(String name, int marks) {}

    public static void main(String[] args) {
        List<Student> students = new ArrayList<>(List.of(
            new Student("Asha", 80), new Student("Ravi", 70), new Student("Meena", 80),
            new Student("John", 70), new Student("Zoe", 90)));
        students.sort(Comparator.comparingInt(Student::marks));   // Timsort for objects: stable
        for (Student s : students) System.out.println(s.name() + " " + s.marks());
    }
}
```

```javascript filename:JavaScript
const students = [["Asha", 80], ["Ravi", 70], ["Meena", 80], ["John", 70], ["Zoe", 90]];
students.sort((a, b) => a[1] - b[1]);        // stable since ES2019 (V8 uses Timsort)
for (const [name, marks] of students) console.log(name, marks);
```

```text filename:Output
Ravi 70
John 70
Asha 80
Meena 80
Zoe 90
```

> [!WARNING] Pitfall
>
> `std::sort` in C++ may reorder equal elements — the Asha/Meena order would be unspecified. Reach for `std::stable_sort` whenever ties matter. In JavaScript, `sort()` without a comparator converts elements to <strong>strings</strong> (`[10, 9, 1].sort()` → `1 10 9`); always pass `(a, b) => a - b` for numbers.

# Tail call elimination in quick sort

Textbook quick sort recurses twice. The second call is a <strong>tail call</strong> — nothing happens after it returns — so it can be replaced by a loop that simply updates `low` and continues. That alone saves one frame per level, but the real win comes from choosing <em>which</em> side to recurse on.

```python filename:Python
def partition(arr, low, high):            # Lomuto: pivot = arr[high]
    pivot, i = arr[high], low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

def quick_sort(arr, low, high):           # two recursive calls
    if low < high:
        p = partition(arr, low, high)
        quick_sort(arr, low, p - 1)
        quick_sort(arr, p + 1, high)      # tail call: nothing after it

def quick_sort_tce(arr, low, high):       # tail call replaced by a loop
    while low < high:
        p = partition(arr, low, high)
        quick_sort_tce(arr, low, p - 1)
        low = p + 1                        # "call" on the right part = continue the loop

a = [10, 80, 30, 90, 40, 50, 70]
quick_sort_tce(a, 0, len(a) - 1)
print(*a)
```

```text filename:Output
10 30 40 50 70 80 90
```

> [!NOTE] Idea
>
> Recurse on the <strong>smaller</strong> partition and loop on the larger one. The recursive call then always handles at most half the elements, so the recursion depth is bounded by `log₂ n` — even on adversarial input where plain quick sort would go `n` deep and overflow the stack. (Time is still `O(n²)` in the worst case; only the <em>stack</em> is now safe.)

> [!WARNING] Pitfall
>
> The notes recursed with `qsort(arr, l, p)` after a Lomuto partition. The pivot is already in its final place at `p`, so the left call must be `(l, p - 1)`; including `p` makes `qsort(l, r)` call itself with the same range when the pivot is the maximum — infinite recursion.

```python filename:Python
depth = max_depth = 0

def partition(arr, low, high):
    pivot, i = arr[high], low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

def quick_sort(arr, low, high):
    global depth, max_depth
    depth += 1
    max_depth = max(max_depth, depth)
    while low < high:
        p = partition(arr, low, high)
        if p - low < high - p:              # recurse into the smaller side ...
            quick_sort(arr, low, p - 1)
            low = p + 1                     # ... and loop on the larger one
        else:
            quick_sort(arr, p + 1, high)
            high = p - 1
    depth -= 1

a = list(range(1, 17))                      # already sorted: worst case for arr[high] pivots
quick_sort(a, 0, len(a) - 1)
print("sorted:", *a)
print("max recursion depth:", max_depth)
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int depth = 0, maxDepth = 0;

int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high], i = low - 1;
    for (int j = low; j < high; j++)
        if (arr[j] <= pivot) swap(arr[++i], arr[j]);
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

void quickSort(vector<int>& arr, int low, int high) {
    depth++;
    maxDepth = max(maxDepth, depth);
    while (low < high) {
        int p = partition(arr, low, high);
        if (p - low < high - p) {           // recurse into the smaller side ...
            quickSort(arr, low, p - 1);
            low = p + 1;                    // ... and loop on the larger one
        } else {
            quickSort(arr, p + 1, high);
            high = p - 1;
        }
    }
    depth--;
}

int main() {
    vector<int> a(16);
    for (int i = 0; i < 16; i++) a[i] = i + 1;   // already sorted: worst case for arr[high] pivots
    quickSort(a, 0, 15);
    cout << "sorted:";
    for (int x : a) cout << " " << x;
    cout << "\nmax recursion depth: " << maxDepth << "\n";
}
```

```java filename:Java
public class Main {
    static int depth = 0, maxDepth = 0;

    static int partition(int[] arr, int low, int high) {
        int pivot = arr[high], i = low - 1;
        for (int j = low; j < high; j++)
            if (arr[j] <= pivot) { i++; int t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        int t = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = t;
        return i + 1;
    }

    static void quickSort(int[] arr, int low, int high) {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
        while (low < high) {
            int p = partition(arr, low, high);
            if (p - low < high - p) {       // recurse into the smaller side ...
                quickSort(arr, low, p - 1);
                low = p + 1;                // ... and loop on the larger one
            } else {
                quickSort(arr, p + 1, high);
                high = p - 1;
            }
        }
        depth--;
    }

    public static void main(String[] args) {
        int[] a = new int[16];
        for (int i = 0; i < 16; i++) a[i] = i + 1;   // already sorted: worst case for arr[high] pivots
        quickSort(a, 0, 15);
        StringBuilder sb = new StringBuilder("sorted:");
        for (int x : a) sb.append(' ').append(x);
        System.out.println(sb);
        System.out.println("max recursion depth: " + maxDepth);
    }
}
```

```javascript filename:JavaScript
let depth = 0, maxDepth = 0;

function partition(arr, low, high) {
    const pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++)
        if (arr[j] <= pivot) { i++; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    return i + 1;
}

function quickSort(arr, low, high) {
    depth++;
    maxDepth = Math.max(maxDepth, depth);
    while (low < high) {
        const p = partition(arr, low, high);
        if (p - low < high - p) {           // recurse into the smaller side ...
            quickSort(arr, low, p - 1);
            low = p + 1;                    // ... and loop on the larger one
        } else {
            quickSort(arr, p + 1, high);
            high = p - 1;
        }
    }
    depth--;
}

const a = Array.from({ length: 16 }, (_, i) => i + 1);   // already sorted: worst case for arr[high] pivots
quickSort(a, 0, 15);
console.log("sorted:", a.join(" "));
console.log("max recursion depth:", maxDepth);
```

```text filename:Output
sorted: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16
max recursion depth: 2
```

Time O(n log n) average, O(n²) worst · Space O(log n) stack — guaranteed

> [!NOTE] Key point
>
> On this already-sorted input every partition is maximally unbalanced (`p == high`), so the naive version would recurse 16 levels deep. The smaller-side rule keeps the depth at 3 — and would keep it under 31 for any array that fits in memory. Combined with a randomised or median-of-three pivot this is what production quick sorts do.

# Kth smallest element (quickselect)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 5, 30, 12], k = 2`<br><strong>Output:</strong> `10`<br><strong>Input:</strong> `arr = [7, 10, 4, 3, 20, 15], k = 3`<br><strong>Output:</strong> `7`

```python filename:Python
# Naive: sort everything, then index — O(n log n)
def kth_smallest(arr, k):
    return sorted(arr)[k - 1]

print(kth_smallest([10, 5, 30, 12], 2))
print(kth_smallest([7, 10, 4, 3, 20, 15], 3))
```

```text filename:Output
10
7
```

> [!NOTE] Idea
>
> Sorting does more work than needed — we only want position `k - 1`. After one Lomuto partition the pivot sits at its <strong>final sorted index </strong><strong>`p`</strong>. If `p == k - 1` we are done; if `p > k - 1` the answer is in the left part, otherwise in the right. Unlike quick sort we recurse into <strong>one</strong> side only, so the expected work is `n + n/2 + n/4 + … = O(n)`.

```python filename:Python
def partition(arr, low, high):
    pivot, i = arr[high], low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

def kth_smallest(arr, k):
    low, high = 0, len(arr) - 1
    while low <= high:
        p = partition(arr, low, high)   # pivot lands at its final sorted index
        if p == k - 1:
            return arr[p]
        if p > k - 1:
            high = p - 1                # answer is on the left
        else:
            low = p + 1                 # answer is on the right
    return -1

for arr, k, label in [([10, 5, 30, 12], 2, "2nd"), ([7, 10, 4, 3, 20, 15], 3, "3rd"), ([7, 10, 4, 3, 20, 15], 4, "4th")]:
    print(f"{label} smallest of [{', '.join(map(str, arr))}] = {kth_smallest(arr[:], k)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high], i = low - 1;
    for (int j = low; j < high; j++)
        if (arr[j] <= pivot) swap(arr[++i], arr[j]);
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

int kthSmallest(vector<int> arr, int k) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int p = partition(arr, low, high);   // pivot lands at its final sorted index
        if (p == k - 1) return arr[p];
        if (p > k - 1) high = p - 1;         // answer is on the left
        else low = p + 1;                    // answer is on the right
    }
    return -1;
}

void show(const vector<int>& arr, int k, const string& label) {
    cout << label << " smallest of [";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] = " << kthSmallest(arr, k) << "\n";
}

int main() {
    show({10, 5, 30, 12}, 2, "2nd");
    show({7, 10, 4, 3, 20, 15}, 3, "3rd");
    show({7, 10, 4, 3, 20, 15}, 4, "4th");
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int partition(int[] arr, int low, int high) {
        int pivot = arr[high], i = low - 1;
        for (int j = low; j < high; j++)
            if (arr[j] <= pivot) { i++; int t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        int t = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = t;
        return i + 1;
    }

    static int kthSmallest(int[] arr, int k) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int p = partition(arr, low, high);   // pivot lands at its final sorted index
            if (p == k - 1) return arr[p];
            if (p > k - 1) high = p - 1;         // answer is on the left
            else low = p + 1;                    // answer is on the right
        }
        return -1;
    }

    static void show(int[] arr, int k, String label) {
        String list = Arrays.toString(arr);      // "[10, 5, 30, 12]"
        System.out.println(label + " smallest of " + list + " = " + kthSmallest(arr.clone(), k));
    }

    public static void main(String[] args) {
        show(new int[]{10, 5, 30, 12}, 2, "2nd");
        show(new int[]{7, 10, 4, 3, 20, 15}, 3, "3rd");
        show(new int[]{7, 10, 4, 3, 20, 15}, 4, "4th");
    }
}
```

```javascript filename:JavaScript
function partition(arr, low, high) {
    const pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++)
        if (arr[j] <= pivot) { i++; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    return i + 1;
}

function kthSmallest(arr, k) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const p = partition(arr, low, high);   // pivot lands at its final sorted index
        if (p === k - 1) return arr[p];
        if (p > k - 1) high = p - 1;           // answer is on the left
        else low = p + 1;                      // answer is on the right
    }
    return -1;
}

const show = (arr, k, label) =>
    console.log(`${label} smallest of [${arr.join(", ")}] = ${kthSmallest([...arr], k)}`);

show([10, 5, 30, 12], 2, "2nd");
show([7, 10, 4, 3, 20, 15], 3, "3rd");
show([7, 10, 4, 3, 20, 15], 4, "4th");
```

```text filename:Output
2nd smallest of [10, 5, 30, 12] = 10
3rd smallest of [7, 10, 4, 3, 20, 15] = 7
4th smallest of [7, 10, 4, 3, 20, 15] = 10
```

Time O(n) expected, O(n²) worst · Space O(1)

> [!WARNING] Pitfall
>
> Quickselect <strong>rearranges</strong> the array (copy it first if the caller needs the original) and has an `O(n²)` worst case with a bad pivot. A random pivot makes the worst case vanishingly unlikely; the <em>median of medians</em> pivot makes it a guaranteed `O(n)` at the price of a large constant. A size-`k` heap gives `O(n log k)` without modifying the input — better when `k` is tiny or the data streams in.

# Minimum difference in an array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 8, 12, 5, 18]`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `arr = [8, 15]`<br><strong>Output:</strong> `7`<br><strong>Input:</strong> `arr = [10]`<br><strong>Output:</strong> `INF`

> [!NOTE] Idea
>
> The two closest values in a set are <strong>neighbours once the array is sorted</strong> — any other pair has a sorted element between them, which is closer to both. So: sort, scan adjacent differences, take the minimum. `O(n log n)` instead of `O(n²)` for all pairs.

```python filename:Python
def min_diff(arr):
    if len(arr) < 2:
        return "INF"
    arr = sorted(arr)
    best = arr[1] - arr[0]
    for i in range(2, len(arr)):
        best = min(best, arr[i] - arr[i - 1])     # closest pair are sorted neighbours
    return str(best)

for a in ([1, 8, 12, 5, 18], [8, 15], [10]):
    print(f"[{', '.join(map(str, a))}] → {min_diff(a)}")
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

string minDiff(vector<int> arr) {
    if (arr.size() < 2) return "INF";
    sort(arr.begin(), arr.end());
    int best = arr[1] - arr[0];
    for (int i = 2; i < (int)arr.size(); i++)
        best = min(best, arr[i] - arr[i - 1]);   // closest pair are sorted neighbours
    return to_string(best);
}

int main() {
    for (vector<int> a : {vector<int>{1, 8, 12, 5, 18}, {8, 15}, {10}}) {
        cout << "[";
        for (int i = 0; i < (int)a.size(); i++) cout << (i ? ", " : "") << a[i];
        cout << "] → " << minDiff(a) << "\n";
    }
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static String minDiff(int[] arr) {
        if (arr.length < 2) return "INF";
        arr = arr.clone();
        Arrays.sort(arr);
        int best = arr[1] - arr[0];
        for (int i = 2; i < arr.length; i++)
            best = Math.min(best, arr[i] - arr[i - 1]);   // closest pair are sorted neighbours
        return String.valueOf(best);
    }

    public static void main(String[] args) {
        for (int[] a : new int[][]{{1, 8, 12, 5, 18}, {8, 15}, {10}})
            System.out.println(Arrays.toString(a) + " → " + minDiff(a));
    }
}
```

```javascript filename:JavaScript
function minDiff(arr) {
    if (arr.length < 2) return "INF";
    arr = [...arr].sort((a, b) => a - b);          // numeric comparator!
    let best = arr[1] - arr[0];
    for (let i = 2; i < arr.length; i++)
        best = Math.min(best, arr[i] - arr[i - 1]);   // closest pair are sorted neighbours
    return String(best);
}

for (const a of [[1, 8, 12, 5, 18], [8, 15], [10]])
    console.log(`[${a.join(", ")}] → ${minDiff(a)}`);
```

```text filename:Output
[1, 8, 12, 5, 18] → 3
[8, 15] → 7
[10] → INF
```

Time O(n log n) · Space O(1) beyond the sort

# Chocolate distribution problem

> [!TIP] Example
>
> <strong>Input:</strong> `packets = [7, 3, 2, 4, 9, 12, 56], m = 3`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `packets = [3, 4, 1, 9, 56, 7, 9, 12], m = 5`<br><strong>Output:</strong> `6`

`n` packets with the given chocolate counts; `m` children each get exactly one packet. Minimise the difference between the largest and smallest packet handed out.

> [!NOTE] Idea
>
> Sort. The `m` chosen packets should be <strong>consecutive in sorted order</strong> — if the chosen set had a gap, swapping an extreme element for the skipped one can only shrink the spread. So the answer is `min over i` of `sorted[i + m - 1] - sorted[i]`: a sliding window of width `m`.

```text filename:Every%20window%20of%20m%20consecutive%20sorted%20values%20is%20a%20candidate
sorted: 2  3  4  7  9  12  56        m = 3
        [2  3  4]              → 4 - 2 = 2   ← minimum
           [3  4  7]           → 7 - 3 = 4
              [4  7  9]        → 9 - 4 = 5
                 [7  9  12]    → 12 - 7 = 5
                    [9  12 56] → 56 - 9 = 47
```

```python filename:Python
def min_spread(packets, m):
    if m == 0 or len(packets) == 0:
        return 0
    if len(packets) < m:
        return -1                              # not enough packets
    packets = sorted(packets)
    best = packets[m - 1] - packets[0]
    for i in range(1, len(packets) - m + 1):   # window [i, i + m - 1]
        best = min(best, packets[i + m - 1] - packets[i])
    return best

print(min_spread([7, 3, 2, 4, 9, 12, 56], 3))
print(min_spread([3, 4, 1, 9, 56, 7, 9, 12], 5))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int minSpread(vector<int> packets, int m) {
    int n = packets.size();
    if (m == 0 || n == 0) return 0;
    if (n < m) return -1;                      // not enough packets
    sort(packets.begin(), packets.end());
    int best = packets[m - 1] - packets[0];
    for (int i = 1; i + m - 1 < n; i++)        // window [i, i + m - 1]
        best = min(best, packets[i + m - 1] - packets[i]);
    return best;
}

int main() {
    cout << minSpread({7, 3, 2, 4, 9, 12, 56}, 3) << "\n";
    cout << minSpread({3, 4, 1, 9, 56, 7, 9, 12}, 5) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int minSpread(int[] packets, int m) {
        int n = packets.length;
        if (m == 0 || n == 0) return 0;
        if (n < m) return -1;                  // not enough packets
        packets = packets.clone();
        Arrays.sort(packets);
        int best = packets[m - 1] - packets[0];
        for (int i = 1; i + m - 1 < n; i++)    // window [i, i + m - 1]
            best = Math.min(best, packets[i + m - 1] - packets[i]);
        return best;
    }

    public static void main(String[] args) {
        System.out.println(minSpread(new int[]{7, 3, 2, 4, 9, 12, 56}, 3));
        System.out.println(minSpread(new int[]{3, 4, 1, 9, 56, 7, 9, 12}, 5));
    }
}
```

```javascript filename:JavaScript
function minSpread(packets, m) {
    const n = packets.length;
    if (m === 0 || n === 0) return 0;
    if (n < m) return -1;                      // not enough packets
    packets = [...packets].sort((a, b) => a - b);
    let best = packets[m - 1] - packets[0];
    for (let i = 1; i + m - 1 < n; i++)        // window [i, i + m - 1]
        best = Math.min(best, packets[i + m - 1] - packets[i]);
    return best;
}

console.log(minSpread([7, 3, 2, 4, 9, 12, 56], 3));
console.log(minSpread([3, 4, 1, 9, 56, 7, 9, 12], 5));
```

```text filename:Output
2
6
```

Time O(n log n) · Space O(1) beyond the sort

> [!NOTE] Key point
>
> Minimum difference is the special case `m = 2`. Both problems share the lesson: <strong>sorting turns a “which pair / which subset” question into a scan of neighbours</strong>.

# Sort an array with two types of elements

Three classic variants of the same problem — move every element of one <em>type</em> before every element of the other, in a single pass with `O(1)` space:

> [!TIP] Example
>
> <strong>Input:</strong> `Segregate negatives and positives: [15, 18, -3, -2]`<br><strong>Output:</strong> `-2 -3 18 15 (any order inside a group is accepted)`<br><strong>Input:</strong> `Segregate even and odd: [15, 14, 13, 12]`<br><strong>Output:</strong> `12 14 13 15`<br><strong>Input:</strong> `Sort a binary array: [0, 1, 1, 1, 0]`<br><strong>Output:</strong> `0 0 1 1 1`

```python filename:Python
# Naive: copy the "left" type, then the "right" type, into a temporary array — O(n) time but O(n) space
def two_types_naive(arr, is_left):
    temp = [x for x in arr if is_left(x)] + [x for x in arr if not is_left(x)]
    for i in range(len(arr)):
        arr[i] = temp[i]
    return arr

print(*two_types_naive([15, 18, -3, -2], lambda x: x < 0))
print(*two_types_naive([0, 1, 1, 1, 0], lambda x: x == 0))
```

```text filename:Output
-3 -2 15 18
0 0 1 1 1
```

> [!NOTE] Idea
>
> This is exactly <strong>Hoare's partition</strong> from quick sort with the predicate playing the role of “less than pivot”. `i` walks right over elements already of the left type, `j` walks left over elements already of the right type; when both stop they point at two misplaced elements — swap them. Each element is examined once.

```python filename:Python
def two_types(arr, is_left):
    i, j = 0, len(arr) - 1
    while i < j:
        while i < j and is_left(arr[i]):        # already on the correct side
            i += 1
        while i < j and not is_left(arr[j]):
            j -= 1
        if i < j:                               # arr[i] is right-type, arr[j] is left-type
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
            j -= 1
    return arr

print("negatives first:", *two_types([15, 18, -3, -2], lambda x: x < 0))
print("evens first:", *two_types([15, 14, 13, 12], lambda x: x % 2 == 0))
print("binary:", *two_types([0, 1, 1, 1, 0], lambda x: x == 0))
```

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

void twoTypes(vector<int>& arr, const function<bool(int)>& isLeft) {
    int i = 0, j = (int)arr.size() - 1;
    while (i < j) {
        while (i < j && isLeft(arr[i])) i++;    // already on the correct side
        while (i < j && !isLeft(arr[j])) j--;
        if (i < j) swap(arr[i++], arr[j--]);    // arr[i] is right-type, arr[j] is left-type
    }
}

void show(const string& label, vector<int> arr, const function<bool(int)>& isLeft) {
    twoTypes(arr, isLeft);
    cout << label << ":";
    for (int x : arr) cout << " " << x;
    cout << "\n";
}

int main() {
    show("negatives first", {15, 18, -3, -2}, [](int x) { return x < 0; });
    show("evens first", {15, 14, 13, 12}, [](int x) { return x % 2 == 0; });
    show("binary", {0, 1, 1, 1, 0}, [](int x) { return x == 0; });
}
```

```java filename:Java
import java.util.function.IntPredicate;

public class Main {
    static void twoTypes(int[] arr, IntPredicate isLeft) {
        int i = 0, j = arr.length - 1;
        while (i < j) {
            while (i < j && isLeft.test(arr[i])) i++;    // already on the correct side
            while (i < j && !isLeft.test(arr[j])) j--;
            if (i < j) { int t = arr[i]; arr[i++] = arr[j]; arr[j--] = t; }   // swap misplaced pair
        }
    }

    static void show(String label, int[] arr, IntPredicate isLeft) {
        twoTypes(arr, isLeft);
        StringBuilder sb = new StringBuilder(label + ":");
        for (int x : arr) sb.append(' ').append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        show("negatives first", new int[]{15, 18, -3, -2}, x -> x < 0);
        show("evens first", new int[]{15, 14, 13, 12}, x -> x % 2 == 0);
        show("binary", new int[]{0, 1, 1, 1, 0}, x -> x == 0);
    }
}
```

```javascript filename:JavaScript
function twoTypes(arr, isLeft) {
    let i = 0, j = arr.length - 1;
    while (i < j) {
        while (i < j && isLeft(arr[i])) i++;        // already on the correct side
        while (i < j && !isLeft(arr[j])) j--;
        if (i < j) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; j--; }   // swap misplaced pair
    }
    return arr;
}

console.log("negatives first:", twoTypes([15, 18, -3, -2], (x) => x < 0).join(" "));
console.log("evens first:", twoTypes([15, 14, 13, 12], (x) => x % 2 === 0).join(" "));
console.log("binary:", twoTypes([0, 1, 1, 1, 0], (x) => x === 0).join(" "));
```

```text filename:Output
negatives first: -2 -3 18 15
evens first: 12 14 13 15
binary: 0 0 1 1 1
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> The <strong>Lomuto-style</strong> one-pass alternative — keep a boundary `j`; for each `i`, if `arr[i]` is left-type swap it to `arr[j]` and `j++` — is shorter but does more swaps. Neither version is stable; if the relative order inside each group must be preserved you need the `O(n)`-space copy (or an `O(n log n)` stable partition).

# Sort an array with three types (Dutch national flag)

> [!TIP] Example
>
> <strong>Input:</strong> `Sort 0s, 1s and 2s: [0, 1, 2, 1, 1, 2]`<br><strong>Output:</strong> `0 1 1 1 2 2`<br><strong>Input:</strong> `Three-way partition around pivot 2: [2, 1, 2, 20, 10, 20, 1]`<br><strong>Output:</strong> `1 1 2 2 20 10 20`<br><strong>Input:</strong> `Partition around range [5, 10]: [10, 5, 6, 3, 20, 9, 40]`<br><strong>Output:</strong> `3 5 6 10 9 40 20`

```python filename:Python
# Naive: three passes collecting 0s, then 1s, then 2s — O(n) time, O(n) space
def sort012_naive(arr):
    return [x for x in arr if x == 0] + [x for x in arr if x == 1] + [x for x in arr if x == 2]

print(*sort012_naive([0, 1, 2, 1, 1, 2]))
```

```text filename:Output
0 1 1 1 2 2
```

> [!NOTE] Idea
>
> Maintain <strong>three regions</strong> with two boundaries: `[0, low)` holds <em>small</em> values, `[low, mid)` holds <em>middle</em> values, `(high, n-1]` holds <em>large</em> values, and `[mid, high]` is unknown. Look at `arr[mid]`: small → swap with `arr[low]`, advance both; middle → just advance `mid`; large → swap with `arr[high]` and shrink `high` (do <strong>not</strong> advance `mid`, the swapped-in element is unexamined). When `mid` passes `high` the unknown region is empty.

```text filename:Dijkstra's%20three-way%20partition%3A%20one%20pass%2C%20O(1)%20space
[ small … | middle … | ??? unknown ??? | large … ]
  0      low        mid             high       n-1

arr[mid] < L   → swap(arr[low], arr[mid]); low++; mid++
L ≤ arr[mid] ≤ U → mid++
arr[mid] > U   → swap(arr[mid], arr[high]); high--
```

One routine, parameterised by the middle range `[L, U]`, solves all three variants: 0/1/2 sorting is `L = U = 1`, three-way partitioning around a pivot is `L = U = pivot`, and partitioning around a range is the general case.

```python filename:Python
def three_way(arr, L, U):
    low, mid, high = 0, 0, len(arr) - 1
    while mid <= high:
        if arr[mid] < L:                           # small → grow the left region
            arr[low], arr[mid] = arr[mid], arr[low]
            low += 1
            mid += 1
        elif arr[mid] > U:                         # large → grow the right region
            arr[mid], arr[high] = arr[high], arr[mid]
            high -= 1                              # mid stays: new arr[mid] is unexamined
        else:                                      # middle → already in place
            mid += 1
    return arr

print(*three_way([0, 1, 2, 1, 1, 2], 1, 1))         # sort 0s, 1s, 2s
print(*three_way([2, 1, 2, 20, 10, 20, 1], 2, 2))   # partition around pivot 2
print(*three_way([10, 5, 6, 3, 20, 9, 40], 5, 10))  # partition around range [5, 10]
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void threeWay(vector<int>& arr, int L, int U) {
    int low = 0, mid = 0, high = (int)arr.size() - 1;
    while (mid <= high) {
        if (arr[mid] < L) swap(arr[low++], arr[mid++]);     // small → grow the left region
        else if (arr[mid] > U) swap(arr[mid], arr[high--]); // large → grow the right (mid stays)
        else mid++;                                         // middle → already in place
    }
}

void show(vector<int> arr, int L, int U) {
    threeWay(arr, L, U);
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? " " : "") << arr[i];
    cout << "\n";
}

int main() {
    show({0, 1, 2, 1, 1, 2}, 1, 1);          // sort 0s, 1s, 2s
    show({2, 1, 2, 20, 10, 20, 1}, 2, 2);    // partition around pivot 2
    show({10, 5, 6, 3, 20, 9, 40}, 5, 10);   // partition around range [5, 10]
}
```

```java filename:Java
public class Main {
    static void threeWay(int[] arr, int L, int U) {
        int low = 0, mid = 0, high = arr.length - 1;
        while (mid <= high) {
            if (arr[mid] < L) {                              // small → grow the left region
                int t = arr[low]; arr[low] = arr[mid]; arr[mid] = t;
                low++; mid++;
            } else if (arr[mid] > U) {                       // large → grow the right (mid stays)
                int t = arr[mid]; arr[mid] = arr[high]; arr[high] = t;
                high--;
            } else {
                mid++;                                       // middle → already in place
            }
        }
    }

    static void show(int[] arr, int L, int U) {
        threeWay(arr, L, U);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < arr.length; i++) sb.append(i > 0 ? " " : "").append(arr[i]);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        show(new int[]{0, 1, 2, 1, 1, 2}, 1, 1);          // sort 0s, 1s, 2s
        show(new int[]{2, 1, 2, 20, 10, 20, 1}, 2, 2);    // partition around pivot 2
        show(new int[]{10, 5, 6, 3, 20, 9, 40}, 5, 10);   // partition around range [5, 10]
    }
}
```

```javascript filename:JavaScript
function threeWay(arr, L, U) {
    let low = 0, mid = 0, high = arr.length - 1;
    while (mid <= high) {
        if (arr[mid] < L) {                                  // small → grow the left region
            [arr[low], arr[mid]] = [arr[mid], arr[low]];
            low++; mid++;
        } else if (arr[mid] > U) {                           // large → grow the right (mid stays)
            [arr[mid], arr[high]] = [arr[high], arr[mid]];
            high--;
        } else {
            mid++;                                           // middle → already in place
        }
    }
    return arr;
}

console.log(threeWay([0, 1, 2, 1, 1, 2], 1, 1).join(" "));         // sort 0s, 1s, 2s
console.log(threeWay([2, 1, 2, 20, 10, 20, 1], 2, 2).join(" "));   // partition around pivot 2
console.log(threeWay([10, 5, 6, 3, 20, 9, 40], 5, 10).join(" "));  // partition around range [5, 10]
```

```text filename:Output
0 1 1 1 2 2
1 1 2 2 20 10 20
3 5 6 10 9 40 20
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> Advancing `mid` after swapping with `high` skips an element that was never looked at — the most common bug in this algorithm. Also note that the order <em>inside</em> the small and large groups is arbitrary (`20 10 20` above); the notes' range example showed a stable order because it used three list comprehensions, which cost `O(n)` extra space.

# Merge overlapping intervals

> [!TIP] Example
>
> <strong>Input:</strong> `[[1, 3], [2, 4], [5, 7], [6, 8]]`<br><strong>Output:</strong> `[1,4] [5,8]`<br><strong>Input:</strong> `[[7, 9], [6, 10], [4, 5], [1, 3], [2, 4]]`<br><strong>Output:</strong> `[1,5] [6,10]`

Two intervals `a` and `b` overlap when `a.start <= b.end` and `b.start <= a.end` (they touch or cross). The naive approach repeatedly picks an interval, merges everything that overlaps it and deletes the absorbed ones — up to `n` passes of `O(n²)` work.

> [!NOTE] Idea
>
> <strong>Sort by start.</strong> Walk through the sorted list keeping the last merged interval `m`. If the next interval starts at or before `m.end`, it overlaps `m` — extend `m.end`. Otherwise it starts a new merged interval. The key claim: a new interval can never overlap any <em>earlier</em> merged interval `m'` because `x.start >= m.start > m'.end` — once sorted, overlaps are only ever with the most recent one.

```text filename:After%20sorting%2C%20each%20interval%20is%20compared%20with%20the%20last%20merged%20one%20only
sorted:  [1,3] [2,4] [5,7] [6,8]

[1,3]            → start result: [1,3]
[2,4]  2 ≤ 3     → overlaps, extend: [1,4]
[5,7]  5 > 4     → new interval:     [1,4] [5,7]
[6,8]  6 ≤ 7     → overlaps, extend: [1,4] [5,8]
```

```python filename:Python
def merge_intervals(intervals):
    intervals.sort(key=lambda iv: iv[0])          # by start
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:                # overlaps the last merged interval
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

for ivs in ([[1, 3], [2, 4], [5, 7], [6, 8]], [[7, 9], [6, 10], [4, 5], [1, 3], [2, 4]]):
    print(" ".join(f"[{s},{e}]" for s, e in merge_intervals(ivs)))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

vector<pair<int, int>> mergeIntervals(vector<pair<int, int>> iv) {
    sort(iv.begin(), iv.end());                   // pairs sort by start, then end
    vector<pair<int, int>> merged = {iv[0]};
    for (int i = 1; i < (int)iv.size(); i++) {
        if (iv[i].first <= merged.back().second)  // overlaps the last merged interval
            merged.back().second = max(merged.back().second, iv[i].second);
        else
            merged.push_back(iv[i]);
    }
    return merged;
}

int main() {
    vector<vector<pair<int, int>>> tests = {{{1, 3}, {2, 4}, {5, 7}, {6, 8}},
                                            {{7, 9}, {6, 10}, {4, 5}, {1, 3}, {2, 4}}};
    for (auto& t : tests) {
        auto m = mergeIntervals(t);
        for (int i = 0; i < (int)m.size(); i++)
            cout << (i ? " " : "") << "[" << m[i].first << "," << m[i].second << "]";
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class Main {
    static List<int[]> mergeIntervals(int[][] iv) {
        Arrays.sort(iv, (a, b) -> Integer.compare(a[0], b[0]));   // by start
        List<int[]> merged = new ArrayList<>();
        merged.add(iv[0]);
        for (int i = 1; i < iv.length; i++) {
            int[] last = merged.get(merged.size() - 1);
            if (iv[i][0] <= last[1])                          // overlaps the last merged interval
                last[1] = Math.max(last[1], iv[i][1]);
            else
                merged.add(iv[i]);
        }
        return merged;
    }

    public static void main(String[] args) {
        int[][][] tests = {{{1, 3}, {2, 4}, {5, 7}, {6, 8}}, {{7, 9}, {6, 10}, {4, 5}, {1, 3}, {2, 4}}};
        for (int[][] t : tests) {
            StringBuilder sb = new StringBuilder();
            for (int[] m : mergeIntervals(t))
                sb.append(sb.length() > 0 ? " " : "").append("[").append(m[0]).append(",").append(m[1]).append("]");
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function mergeIntervals(intervals) {
    intervals.sort((a, b) => a[0] - b[0]);            // by start
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        if (intervals[i][0] <= last[1])               // overlaps the last merged interval
            last[1] = Math.max(last[1], intervals[i][1]);
        else
            merged.push(intervals[i]);
    }
    return merged;
}

for (const ivs of [[[1, 3], [2, 4], [5, 7], [6, 8]], [[7, 9], [6, 10], [4, 5], [1, 3], [2, 4]]])
    console.log(mergeIntervals(ivs).map(([s, e]) => `[${s},${e}]`).join(" "));
```

```text filename:Output
[1,4] [5,8]
[1,5] [6,10]
```

Time O(n log n) · Space O(n) for the result (O(1) if merged in place)

> [!NOTE] Key point
>
> Decide whether touching intervals (`[1, 3]` and `[3, 5]`) merge: the `<=` test above merges them; use `<` to keep them apart. The same sort-then-sweep handles <em>insert interval</em>, <em>interval intersection</em> and <em>minimum meeting rooms</em> (the next problem).

# Meeting maximum guests

> [!TIP] Example
>
> <strong>Input:</strong> `arrival = [900, 940], departure = [1000, 1030]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arrival = [800, 700, 600, 500], departure = [840, 820, 830, 530]`<br><strong>Output:</strong> `3`

Guest `i` is present from `arrival[i]` to `departure[i]` (times `0000`–`2359`). Find the maximum number of guests present at the same time — the moment to hold a toast. Checking every minute against every guest is `O(1440 · n)`; checking every arrival against every guest is `O(n²)`.

> [!NOTE] Idea
>
> Sort arrivals and departures <strong>separately</strong> and sweep through them as a merged sequence of events. An arrival increments the current count, a departure decrements it; the maximum count seen is the answer. Who arrived or left does not matter, only <em>how many</em> are present — which is why the two arrays may be sorted independently.

```text filename:Sweep%20both%20sorted%20arrays%20like%20a%20merge%2C%20counting%20current%20guests
arrivals:    500  600  700  800
departures:  530  820  830  840

time  500 → +1 (1)   530 → -1 (0)   600 → +1 (1)   700 → +1 (2)
      800 → +1 (3)   820 → -1 (2)   830 → -1 (1)   840 → -1 (0)
maximum = 3
```

```python filename:Python
def max_guests(arrival, departure):
    arrival, departure = sorted(arrival), sorted(departure)
    n = len(arrival)
    i, j = 1, 0
    current = best = 1 if n else 0
    while i < n and j < n:
        if arrival[i] <= departure[j]:      # next event is an arrival (ties count as overlap)
            current += 1
            i += 1
        else:                               # next event is a departure
            current -= 1
            j += 1
        best = max(best, current)
    return best

print(max_guests([900, 940], [1000, 1030]))
print(max_guests([800, 700, 600, 500], [840, 820, 830, 530]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int maxGuests(vector<int> arrival, vector<int> departure) {
    sort(arrival.begin(), arrival.end());
    sort(departure.begin(), departure.end());
    int n = arrival.size();
    int i = 1, j = 0, current = n ? 1 : 0, best = current;
    while (i < n && j < n) {
        if (arrival[i] <= departure[j]) { current++; i++; }   // arrival (ties count as overlap)
        else { current--; j++; }                               // departure
        best = max(best, current);
    }
    return best;
}

int main() {
    cout << maxGuests({900, 940}, {1000, 1030}) << "\n";
    cout << maxGuests({800, 700, 600, 500}, {840, 820, 830, 530}) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int maxGuests(int[] arrival, int[] departure) {
        arrival = arrival.clone(); departure = departure.clone();
        Arrays.sort(arrival);
        Arrays.sort(departure);
        int n = arrival.length;
        int i = 1, j = 0, current = n > 0 ? 1 : 0, best = current;
        while (i < n && j < n) {
            if (arrival[i] <= departure[j]) { current++; i++; }   // arrival (ties count as overlap)
            else { current--; j++; }                               // departure
            best = Math.max(best, current);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(maxGuests(new int[]{900, 940}, new int[]{1000, 1030}));
        System.out.println(maxGuests(new int[]{800, 700, 600, 500}, new int[]{840, 820, 830, 530}));
    }
}
```

```javascript filename:JavaScript
function maxGuests(arrival, departure) {
    arrival = [...arrival].sort((a, b) => a - b);
    departure = [...departure].sort((a, b) => a - b);
    const n = arrival.length;
    let i = 1, j = 0, current = n ? 1 : 0, best = current;
    while (i < n && j < n) {
        if (arrival[i] <= departure[j]) { current++; i++; }   // arrival (ties count as overlap)
        else { current--; j++; }                               // departure
        best = Math.max(best, current);
    }
    return best;
}

console.log(maxGuests([900, 940], [1000, 1030]));
console.log(maxGuests([800, 700, 600, 500], [840, 820, 830, 530]));
```

```text filename:Output
2
3
```

Time O(n log n) · Space O(1) beyond the sorts

> [!NOTE] Key point
>
> Because times are bounded (`0..2359`), a <strong>counting</strong> variant is `O(n + 2360)`: add `+1` at each arrival, `-1` just after each departure in a 2360-slot array, then take the running maximum. This is the <em>difference array</em> trick, and it is the right answer when `n` is huge and the time range is small. The loop needs `i` to start at `1` with `current = 1` because the first arrival is always the first event.

# Counting sort

> [!INFO]
>
> <strong>Counting sort</strong> — a `Θ(n + k)` <strong>non-comparison</strong> sort for values in a known range `0..k-1`: count how many times each value occurs, convert the counts to starting positions, then place each element directly at its position.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 4, 4, 1, 0, 1], k = 5`<br><strong>Output:</strong> `0 1 1 1 4 4`

```python filename:Python
# Simplest form: count, then write each value count[v] times — fine for plain integers
def counting_sort_simple(arr, k):
    count = [0] * k
    for x in arr:
        count[x] += 1
    idx = 0
    for v in range(k):
        for _ in range(count[v]):
            arr[idx] = v
            idx += 1

a = [1, 4, 4, 1, 0, 1]
counting_sort_simple(a, 5)
print(*a)
```

```text filename:Output
0 1 1 1 4 4
```

That version only works when the <em>value is the whole record</em>. To sort students by marks (records with a key) you must move the original objects, which needs the <strong>stable</strong> formulation:

```text filename:Prefix%20sums%20turn%20counts%20into%20positions%3B%20scanning%20right-to-left%20keeps%20equal%20keys%20in%20input%20order
arr   = 1 4 4 1 0 1          k = 5

count = [1, 3, 0, 0, 2]      how many of each value
prefix= [1, 4, 4, 4, 6]      count[v] = number of elements ≤ v  (= end position of value v)

scan arr from the RIGHT, place each x at output[count[x] - 1], then count[x]--:
  x=1 → output[3]=1, count[1]=3      x=0 → output[0]=0
  x=1 → output[2]=1, count[1]=2      x=1 → output[1]=1
  x=4 → output[5]=4, count[4]=1      x=4 → output[4]=4
output = 0 1 1 1 4 4
```

```python filename:Python
def counting_sort(arr, k):
    count = [0] * k
    for x in arr:
        count[x] += 1
    for v in range(1, k):
        count[v] += count[v - 1]          # count[v] = number of elements <= v
    output = [0] * len(arr)
    for x in reversed(arr):               # right-to-left keeps the sort stable
        count[x] -= 1
        output[count[x]] = x
    arr[:] = output

a = [1, 4, 4, 1, 0, 1]
counting_sort(a, 5)
print(*a)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void countingSort(vector<int>& arr, int k) {
    vector<int> count(k, 0);
    for (int x : arr) count[x]++;
    for (int v = 1; v < k; v++) count[v] += count[v - 1];   // count[v] = number of elements <= v
    vector<int> output(arr.size());
    for (int i = (int)arr.size() - 1; i >= 0; i--)          // right-to-left keeps the sort stable
        output[--count[arr[i]]] = arr[i];
    arr = output;
}

int main() {
    vector<int> a = {1, 4, 4, 1, 0, 1};
    countingSort(a, 5);
    for (int i = 0; i < (int)a.size(); i++) cout << (i ? " " : "") << a[i];
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static void countingSort(int[] arr, int k) {
        int[] count = new int[k];
        for (int x : arr) count[x]++;
        for (int v = 1; v < k; v++) count[v] += count[v - 1];   // count[v] = number of elements <= v
        int[] output = new int[arr.length];
        for (int i = arr.length - 1; i >= 0; i--)               // right-to-left keeps the sort stable
            output[--count[arr[i]]] = arr[i];
        System.arraycopy(output, 0, arr, 0, arr.length);
    }

    public static void main(String[] args) {
        int[] a = {1, 4, 4, 1, 0, 1};
        countingSort(a, 5);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? " " : "").append(a[i]);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function countingSort(arr, k) {
    const count = new Array(k).fill(0);
    for (const x of arr) count[x]++;
    for (let v = 1; v < k; v++) count[v] += count[v - 1];   // count[v] = number of elements <= v
    const output = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--)               // right-to-left keeps the sort stable
        output[--count[arr[i]]] = arr[i];
    for (let i = 0; i < arr.length; i++) arr[i] = output[i];
}

const a = [1, 4, 4, 1, 0, 1];
countingSort(a, 5);
console.log(a.join(" "));
```

```text filename:Output
0 1 1 1 4 4
```

Time Θ(n + k) · Space Θ(n + k)

```python filename:Python
# Stability in action: sort records by a key, then any range by shifting with min(arr)
def counting_sort_by(items, key, k):
    count = [0] * k
    for it in items:
        count[key(it)] += 1
    for v in range(1, k):
        count[v] += count[v - 1]
    output = [None] * len(items)
    for it in reversed(items):
        count[key(it)] -= 1
        output[count[key(it)]] = it
    return output

students = [("Asha", 3), ("Ravi", 1), ("Meena", 3), ("John", 1), ("Zoe", 2)]
print(counting_sort_by(students, key=lambda s: s[1], k=4))

def counting_sort_any_range(arr):           # values in [min, max] — shift by min
    lo = min(arr)
    return counting_sort_by(arr, key=lambda x: x - lo, k=max(arr) - lo + 1)

print(counting_sort_any_range([1, -2, 4, 4, -1, 1, 0]))
```

```text filename:Output
[('Ravi', 1), ('John', 1), ('Zoe', 2), ('Asha', 3), ('Meena', 3)]
[-2, -1, 0, 1, 1, 4, 4]
```

- <strong>Not comparison based</strong> — it beats the `Ω(n log n)` lower bound because it exploits the value range.
- <strong>Stable</strong> when written with prefix sums and a right-to-left scan — this is what radix sort relies on.
- <strong>Not in place</strong>: needs the `count` array and an `output` array.
- Useless when `k` is much larger than `n` (sorting five values in `0..10⁹` would allocate a billion counters) — that is where radix sort takes over.

> [!WARNING] Pitfall
>
> The notes' “updated solution” defined `countingSort` but then called the old `Countingsort` — a Python name-case slip that silently ran the wrong function. Case matters in identifiers in all four languages.

# Cycle sort

> [!INFO]
>
> <strong>Cycle sort</strong> — an in-place, unstable `O(n²)` sort that performs the <strong>minimum possible number of writes</strong> — every element is written at most once, directly into its final position. It is the algorithm of choice when writes are expensive (flash memory, EEPROM) or when you need the minimum number of swaps to sort an array.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [30, 40, 50, 10, 20, 50]`<br><strong>Output:</strong> `10 20 30 40 50 50 (5 writes)`

> [!NOTE] Idea
>
> The final index of a value equals the <strong>number of elements smaller than it</strong> (plus the number of equal elements already placed). Take the element at position `cs`, count how many are smaller to find its destination, write it there and pick up the element that was there — follow this <em>cycle</em> of displacements until it returns to `cs`. Then move to `cs + 1`.

```text filename:One%20cycle%20of%20displacements%20fixes%20five%20elements%20with%20five%20writes
arr = 30 40 50 10 20 50       start at cs = 0, item = 30

30 has 2 smaller → goes to index 2, picks up 50
50 has 3 smaller, one equal already placed? no → index 4, picks up 20
20 has 1 smaller → index 1, picks up 40
40 has 3 smaller → index 3, picks up 10
10 has 0 smaller → index 0 = cs → cycle closed

arr = 10 20 30 40 50 50       5 writes for 5 misplaced elements
```

```python filename:Python
def cycle_sort(arr):
    writes = 0
    n = len(arr)
    for cs in range(n - 1):
        item = arr[cs]
        pos = cs
        for i in range(cs + 1, n):               # destination = number of smaller elements
            if arr[i] < item:
                pos += 1
        if pos == cs:
            continue                             # already in place
        while item == arr[pos]:                  # skip duplicates already placed
            pos += 1
        arr[pos], item = item, arr[pos]          # write, pick up the displaced element
        writes += 1
        while pos != cs:                         # follow the cycle back to cs
            pos = cs
            for i in range(cs + 1, n):
                if arr[i] < item:
                    pos += 1
            while item == arr[pos]:
                pos += 1
            arr[pos], item = item, arr[pos]
            writes += 1
    return writes

a = [30, 40, 50, 10, 20, 50]
w = cycle_sort(a)
print(*a)
print("writes:", w)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int cycleSort(vector<int>& arr) {
    int writes = 0, n = arr.size();
    for (int cs = 0; cs < n - 1; cs++) {
        int item = arr[cs], pos = cs;
        for (int i = cs + 1; i < n; i++)         // destination = number of smaller elements
            if (arr[i] < item) pos++;
        if (pos == cs) continue;                 // already in place
        while (item == arr[pos]) pos++;          // skip duplicates already placed
        swap(arr[pos], item); writes++;          // write, pick up the displaced element
        while (pos != cs) {                      // follow the cycle back to cs
            pos = cs;
            for (int i = cs + 1; i < n; i++)
                if (arr[i] < item) pos++;
            while (item == arr[pos]) pos++;
            swap(arr[pos], item); writes++;
        }
    }
    return writes;
}

int main() {
    vector<int> a = {30, 40, 50, 10, 20, 50};
    int w = cycleSort(a);
    for (int i = 0; i < (int)a.size(); i++) cout << (i ? " " : "") << a[i];
    cout << "\nwrites: " << w << "\n";
}
```

```java filename:Java
public class Main {
    static int cycleSort(int[] arr) {
        int writes = 0, n = arr.length;
        for (int cs = 0; cs < n - 1; cs++) {
            int item = arr[cs], pos = cs;
            for (int i = cs + 1; i < n; i++)     // destination = number of smaller elements
                if (arr[i] < item) pos++;
            if (pos == cs) continue;             // already in place
            while (item == arr[pos]) pos++;      // skip duplicates already placed
            int t = arr[pos]; arr[pos] = item; item = t; writes++;   // write, pick up displaced
            while (pos != cs) {                  // follow the cycle back to cs
                pos = cs;
                for (int i = cs + 1; i < n; i++)
                    if (arr[i] < item) pos++;
                while (item == arr[pos]) pos++;
                t = arr[pos]; arr[pos] = item; item = t; writes++;
            }
        }
        return writes;
    }

    public static void main(String[] args) {
        int[] a = {30, 40, 50, 10, 20, 50};
        int w = cycleSort(a);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? " " : "").append(a[i]);
        System.out.println(sb);
        System.out.println("writes: " + w);
    }
}
```

```javascript filename:JavaScript
function cycleSort(arr) {
    let writes = 0;
    const n = arr.length;
    for (let cs = 0; cs < n - 1; cs++) {
        let item = arr[cs], pos = cs;
        for (let i = cs + 1; i < n; i++)         // destination = number of smaller elements
            if (arr[i] < item) pos++;
        if (pos === cs) continue;                // already in place
        while (item === arr[pos]) pos++;         // skip duplicates already placed
        [arr[pos], item] = [item, arr[pos]]; writes++;   // write, pick up the displaced element
        while (pos !== cs) {                     // follow the cycle back to cs
            pos = cs;
            for (let i = cs + 1; i < n; i++)
                if (arr[i] < item) pos++;
            while (item === arr[pos]) pos++;
            [arr[pos], item] = [item, arr[pos]]; writes++;
        }
    }
    return writes;
}

const a = [30, 40, 50, 10, 20, 50];
const w = cycleSort(a);
console.log(a.join(" "));
console.log("writes:", w);
```

```text filename:Output
10 20 30 40 50 50
writes: 5
```

Time O(n²) · Space O(1)

- Worst and average case `O(n²)` comparisons — never use it for speed.
- At most `n - 1` writes in total, versus up to `O(n²)` for insertion or bubble sort.
- In place, <strong>not stable</strong>.
- The number of writes equals the <strong>minimum number of swaps</strong> needed to sort the array — the standard way to solve that interview question. When the values are a permutation of `0..n-1`, the destination of `x` is simply `x`, no counting needed, and the whole sort becomes `O(n)`.

# Radix sort

> [!INFO]
>
> <strong>Radix sort (LSD)</strong> — sort the numbers digit by digit, from the <strong>least significant digit</strong> to the most significant, using a <em>stable</em> counting sort for each digit. After processing the most significant digit the array is fully sorted.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [319, 212, 6, 8, 100, 50]`<br><strong>Output:</strong> `6 8 50 100 212 319`

```text filename:Three%20stable%20passes%20(one%20per%20digit)%20%E2%80%94%20each%20pass%20preserves%20the%20order%20established%20by%20the%20previous%20ones
write with leading zeros:   319 212 006 008 100 050

stable sort by units digit:     100 050 212 006 008 319
stable sort by tens digit:      100 006 008 212 319 050
stable sort by hundreds digit:  006 008 050 100 212 319
```

> [!NOTE] Idea
>
> Why LSD works: after sorting by the tens digit, numbers with equal tens digits are still in units-digit order <strong>because the pass is stable</strong>. Induction over the digits gives a fully sorted array after the last pass. Each pass is a counting sort with `k = 10`, so the total is `O(d · (n + 10))` where `d` is the number of digits of the maximum.

```python filename:Python
def counting_sort_by_digit(arr, exp):
    output = [0] * len(arr)
    count = [0] * 10
    for x in arr:
        count[(x // exp) % 10] += 1
    for d in range(1, 10):
        count[d] += count[d - 1]
    for x in reversed(arr):                    # stable
        d = (x // exp) % 10
        count[d] -= 1
        output[count[d]] = x
    arr[:] = output

def radix_sort(arr):
    mx = max(arr)
    exp = 1
    while mx // exp > 0:                       # one pass per digit of the maximum
        counting_sort_by_digit(arr, exp)
        print(f"after pass exp={exp}:", *arr)
        exp *= 10

radix_sort([319, 212, 6, 8, 100, 50])
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

void countingSortByDigit(vector<int>& arr, int exp) {
    vector<int> output(arr.size()), count(10, 0);
    for (int x : arr) count[(x / exp) % 10]++;
    for (int d = 1; d < 10; d++) count[d] += count[d - 1];
    for (int i = (int)arr.size() - 1; i >= 0; i--)   // stable
        output[--count[(arr[i] / exp) % 10]] = arr[i];
    arr = output;
}

void radixSort(vector<int>& arr) {
    int mx = *max_element(arr.begin(), arr.end());
    for (int exp = 1; mx / exp > 0; exp *= 10) {   // one pass per digit of the maximum
        countingSortByDigit(arr, exp);
        cout << "after pass exp=" << exp << ":";
        for (int x : arr) cout << " " << x;
        cout << "\n";
    }
}

int main() {
    vector<int> a = {319, 212, 6, 8, 100, 50};
    radixSort(a);
}
```

```java filename:Java
public class Main {
    static void countingSortByDigit(int[] arr, int exp) {
        int[] output = new int[arr.length], count = new int[10];
        for (int x : arr) count[(x / exp) % 10]++;
        for (int d = 1; d < 10; d++) count[d] += count[d - 1];
        for (int i = arr.length - 1; i >= 0; i--)        // stable
            output[--count[(arr[i] / exp) % 10]] = arr[i];
        System.arraycopy(output, 0, arr, 0, arr.length);
    }

    static void radixSort(int[] arr) {
        int mx = 0;
        for (int x : arr) mx = Math.max(mx, x);
        for (int exp = 1; mx / exp > 0; exp *= 10) {     // one pass per digit of the maximum
            countingSortByDigit(arr, exp);
            StringBuilder sb = new StringBuilder("after pass exp=" + exp + ":");
            for (int x : arr) sb.append(' ').append(x);
            System.out.println(sb);
        }
    }

    public static void main(String[] args) {
        radixSort(new int[]{319, 212, 6, 8, 100, 50});
    }
}
```

```javascript filename:JavaScript
function countingSortByDigit(arr, exp) {
    const output = new Array(arr.length), count = new Array(10).fill(0);
    for (const x of arr) count[Math.floor(x / exp) % 10]++;
    for (let d = 1; d < 10; d++) count[d] += count[d - 1];
    for (let i = arr.length - 1; i >= 0; i--)            // stable
        output[--count[Math.floor(arr[i] / exp) % 10]] = arr[i];
    for (let i = 0; i < arr.length; i++) arr[i] = output[i];
}

function radixSort(arr) {
    const mx = Math.max(...arr);
    for (let exp = 1; Math.floor(mx / exp) > 0; exp *= 10) {   // one pass per digit of the maximum
        countingSortByDigit(arr, exp);
        console.log(`after pass exp=${exp}:`, arr.join(" "));
    }
}

radixSort([319, 212, 6, 8, 100, 50]);
```

```text filename:Output
after pass exp=1: 100 50 212 6 8 319
after pass exp=10: 100 6 8 212 319 50
after pass exp=100: 6 8 50 100 212 319
```

Time O(d · (n + b)), b = base · Space O(n + b)

> [!NOTE] Key point
>
> <strong>Choosing the base.</strong> With `b = n` (not 10) a number up to `n²` has only `d = 2` “digits”, so radix sort runs in `O(2 · 2n) = O(n)` — this is the “values up to `n²` or `n³`” row of the decision table. Radix sort is not comparison based, is stable, needs `O(n)` extra memory, and extends to negative numbers (offset or sort by sign first), fixed-length strings and floats (by their IEEE bit pattern). The notes' loop condition `mx/exp > 1` was wrong: it skips the final pass when the maximum has a leading digit of 1 (e.g. `mx = 100` would stop after the tens pass); `mx // exp > 0` is correct.

# Bucket sort

> [!INFO]
>
> <strong>Bucket sort</strong> — <strong>scatter</strong> the elements into `k` buckets by value range, <strong>sort</strong> each bucket (insertion sort or any library sort), then <strong>gather</strong> the buckets in order. Expected `O(n)` when the input is uniformly distributed over the range and `k ≈ n`.

Typical inputs: integers uniformly spread over `1..10⁸` (too wide for counting sort, too many digits for radix), or floating-point numbers uniformly spread in `[0, 1)` where the bucket index is simply `floor(k · x)`.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [20, 88, 70, 85, 75, 95, 18, 82, 60], range 0..99, k = 5 buckets`<br><strong>Output:</strong> `18 20 60 70 75 82 85 88 95`

```text filename:Scatter%20%E2%86%92%20sort%20buckets%20%E2%86%92%20gather
Scatter (bucket = 5 * x / 100):           Sort each bucket:
  bucket 0 (00-19): 18                       18
  bucket 1 (20-39): 20                       20
  bucket 2 (40-59):                          (empty)
  bucket 3 (60-79): 70 75 60                 60 70 75
  bucket 4 (80-99): 88 85 95 82              82 85 88 95

Gather: 18 20 60 70 75 82 85 88 95
```

```python filename:Python
def bucket_sort(arr, k):
    rs = max(arr) + 1                          # values lie in [0, rs)
    buckets = [[] for _ in range(k)]
    for x in arr:
        buckets[(k * x) // rs].append(x)       # scatter
    for i, b in enumerate(buckets):
        print(f"bucket {i}:", *b)
    idx = 0
    for b in buckets:
        b.sort()                               # sort each bucket (small → cheap)
        for x in b:                            # gather
            arr[idx] = x
            idx += 1

a = [20, 88, 70, 85, 75, 95, 18, 82, 60]
bucket_sort(a, 5)
print("sorted:", *a)
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

void bucketSort(vector<int>& arr, int k) {
    int rs = *max_element(arr.begin(), arr.end()) + 1;   // values lie in [0, rs)
    vector<vector<int>> buckets(k);
    for (int x : arr) buckets[(k * x) / rs].push_back(x);   // scatter
    for (int i = 0; i < k; i++) {
        cout << "bucket " << i << ":";
        for (int x : buckets[i]) cout << " " << x;
        cout << "\n";
    }
    int idx = 0;
    for (auto& b : buckets) {
        sort(b.begin(), b.end());                        // sort each bucket (small → cheap)
        for (int x : b) arr[idx++] = x;                  // gather
    }
}

int main() {
    vector<int> a = {20, 88, 70, 85, 75, 95, 18, 82, 60};
    bucketSort(a, 5);
    cout << "sorted:";
    for (int x : a) cout << " " << x;
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Main {
    static void bucketSort(int[] arr, int k) {
        int rs = 0;
        for (int x : arr) rs = Math.max(rs, x);
        rs++;                                            // values lie in [0, rs)
        List<List<Integer>> buckets = new ArrayList<>();
        for (int i = 0; i < k; i++) buckets.add(new ArrayList<>());
        for (int x : arr) buckets.get((k * x) / rs).add(x);   // scatter
        for (int i = 0; i < k; i++) {
            StringBuilder sb = new StringBuilder("bucket " + i + ":");
            for (int x : buckets.get(i)) sb.append(' ').append(x);
            System.out.println(sb);
        }
        int idx = 0;
        for (List<Integer> b : buckets) {
            Collections.sort(b);                         // sort each bucket (small → cheap)
            for (int x : b) arr[idx++] = x;              // gather
        }
    }

    public static void main(String[] args) {
        int[] a = {20, 88, 70, 85, 75, 95, 18, 82, 60};
        bucketSort(a, 5);
        StringBuilder sb = new StringBuilder("sorted:");
        for (int x : a) sb.append(' ').append(x);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function bucketSort(arr, k) {
    const rs = Math.max(...arr) + 1;               // values lie in [0, rs)
    const buckets = Array.from({ length: k }, () => []);
    for (const x of arr) buckets[Math.floor((k * x) / rs)].push(x);   // scatter
    buckets.forEach((b, i) => console.log(`bucket ${i}:${b.map((x) => " " + x).join("")}`));
    let idx = 0;
    for (const b of buckets) {
        b.sort((x, y) => x - y);                   // sort each bucket (small → cheap)
        for (const x of b) arr[idx++] = x;         // gather
    }
}

const a = [20, 88, 70, 85, 75, 95, 18, 82, 60];
bucketSort(a, 5);
console.log("sorted:", a.join(" "));
```

```text filename:Output
bucket 0: 18
bucket 1: 20
bucket 2:
bucket 3: 70 75 60
bucket 4: 88 85 95 82
sorted: 18 20 60 70 75 82 85 88 95
```

Time O(n + k) expected, O(n log n) worst · Space O(n + k)

> [!WARNING] Pitfall
>
> Bucket sort degrades to the cost of the inner sort when the data is <strong>skewed</strong> — if every value lands in one bucket you have just paid `O(n)` to run a regular sort. Pick the bucket function from the known distribution, not from hope. The notes' diagram listed `92` in the last bucket although the input contained `82`; the example above is consistent.

# Comparison of all sorting algorithms

| Algorithm | Best | Average | Worst | Space | Stable | In place | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bubble | `O(n)` | `O(n²)` | `O(n²)` | `O(1)` | yes | yes | adjacent swaps only |
| Selection | `O(n²)` | `O(n²)` | `O(n²)` | `O(1)` | no | yes | `O(n)` swaps |
| Insertion | `O(n)` | `O(n²)` | `O(n²)` | `O(1)` | yes | yes | best for small / nearly sorted |
| Merge | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | no | linked lists, external sort |
| Quick (Lomuto/Hoare) | `O(n log n)` | `O(n log n)` | `O(n²)` | `O(log n)`\* | no | yes | fastest in practice; \*with smaller-side recursion |
| Heap | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | no | yes | poor cache behaviour |
| Counting | `Θ(n + k)` | `Θ(n + k)` | `Θ(n + k)` | `O(n + k)` | yes | no | small integer range |
| Radix (LSD) | `O(d(n + b))` | `O(d(n + b))` | `O(d(n + b))` | `O(n + b)` | yes | no | fixed-width keys |
| Bucket | `O(n + k)` | `O(n + k)` | `O(n log n)` | `O(n + k)` | yes\* | no | uniform data; \*if inner sort is stable |
| Cycle | `O(n²)` | `O(n²)` | `O(n²)` | `O(1)` | no | yes | minimum writes |
| Timsort | `O(n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | no | Python, Java objects, V8 |
| Introsort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(log n)` | no | yes | C++ `std::sort` |

`Any comparison sort needs Ω(n log n) comparisons in the worst case — counting, radix and bucket sort escape this by not comparing.`

# Interview Q&amp;A

```question
Why do libraries use hybrid algorithms instead of plain quick sort or merge sort?

---

Each pure algorithm has a weakness: quick sort has an `O(n²)` worst case and deep recursion, merge sort needs `O(n)` extra memory and does unnecessary work on already-sorted data, insertion sort is quadratic but unbeatable for tiny arrays. Introsort (quick → heap on deep recursion → insertion on small parts) and Timsort (natural runs + insertion + merge) combine the strengths: guaranteed `O(n log n)`, fast on real data, and — for Timsort — stability plus `O(n)` on sorted input.
```

```question
Quickselect vs a heap for the kth smallest — when is each better?

---

Quickselect: expected `O(n)`, `O(1)` space, but modifies the array and has an `O(n²)` worst case (fix with a random pivot). Min/max heap of size `k`: `O(n log k)`, does not touch the input, works on a stream, and is better when `k` is small or when the data cannot be held in memory. For `k` near `n/2` on in-memory data quickselect wins.
```

```question
How can you sort in O(n)? Doesn't the lower bound forbid it?

---

The `Ω(n log n)` bound applies to <strong>comparison</strong> sorts. Counting, radix and bucket sort use the values themselves (as array indices or digit groups) and never compare two elements. They need extra assumptions — a small range, fixed-width keys, or a uniform distribution — and extra memory.
```

```question
Why is the right-to-left scan needed for counting sort to be stable, and why does radix sort need stability?

---

After prefix sums, `count[v]` is the position <em>just past</em> the last slot for value `v`. Scanning the input from the right and decrementing before placing fills each value's slots from the back, so the last occurrence lands last — input order is preserved. Radix sort relies on this: when sorting by the tens digit, elements with equal tens digits must keep the units-digit order produced by the previous pass, otherwise the earlier passes are wasted.
```

```question
Explain tail call elimination in quick sort. Does it fix the O(n²) worst case?

---

No — it fixes the <strong>stack</strong>, not the time. Replacing the second recursive call with a loop and always recursing on the smaller partition bounds the recursion depth by `log₂ n`, so even adversarial input cannot overflow the stack. The number of comparisons on that input is still quadratic; a randomised or median-of-three pivot is what makes the worst case unlikely.
```

```question
Minimum number of swaps to sort an array — which sorting idea applies?

---

Cycle sort. Write each element directly to its sorted position (found by sorting a copy with indices, or by counting smaller elements), following cycles of displacement. Each cycle of length `L` needs `L - 1` swaps, and the total over all cycles is the minimum. For a permutation of `0..n-1` the whole thing is `O(n)`.
```
