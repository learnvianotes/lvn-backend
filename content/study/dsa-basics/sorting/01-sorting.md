---
id: 31485ed0-c6bc-7149-82ad-e362b5b1b2f1
key: topic:dsa-basics/sorting
subject: dsa-basics
topic: sorting
title: Sorting
slug: sorting
order: 1
---

Sorting arranges data in increasing or decreasing order. It is the most studied problem in computer science because so much else — binary search, deduplication, merging, finding medians, grouping — becomes easy once the data is sorted. These notes cover the library sorts you should actually call and the classic algorithms you must be able to write and analyse: bubble, selection, insertion, merge, quick and heap sort.

> [!INFO]
>
> <strong>Sorting</strong> — rearranging a sequence so that every element is `≤` the one after it (ascending) or `≥` it (descending), according to a <em>comparison</em> — numeric, alphabetic, or any custom key.

# Comparison of sorting algorithms

The two properties interviewers ask about after time complexity are <strong>stability</strong> (equal elements keep their original relative order) and whether the sort is <strong>in-place</strong> (needs only `O(1)` — or `O(log n)` stack — extra memory).

| Algorithm | Best | Average | Worst | Extra space | Stable | In-place | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bubble sort | `O(n)`\* | `O(n²)` | `O(n²)` | `O(1)` | yes | yes | \*with the <em>swapped</em> flag; academic only |
| Selection sort | `O(n²)` | `O(n²)` | `O(n²)` | `O(1)` | no | yes | fewest writes: at most `n − 1` swaps |
| Insertion sort | `O(n)` | `O(n²)` | `O(n²)` | `O(1)` | yes | yes | best for small or nearly sorted input; used inside Timsort / introsort |
| Merge sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | no | linked lists and external sorting; guaranteed `n log n` |
| Quick sort | `O(n log n)` | `O(n log n)` | `O(n²)` | `O(log n)` stack | no | yes | fastest in practice: cache-friendly, low constants |
| Heap sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | no | yes | guaranteed `n log n` in place; poor cache behaviour |
| Timsort (library) | `O(n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | no | merge sort + insertion sort on natural runs; Python, Java objects, V8 |

> [!NOTE] Key point
>
> Any sort that only <em>compares</em> elements needs `Ω(n log n)` comparisons in the worst case — there are `n!` orderings and each comparison rules out at most half. Merge, heap and quick sort are optimal in that sense; counting and radix sort beat it only by not comparing (they index on the values).

# Built-in sorting in each language

In real code you call the library sort. Know what it runs, whether it is stable, and how to pass a key or comparator.

| Language | Call | Algorithm | Stable | Custom order |
| --- | --- | --- | --- | --- |
| Python | `sorted(iterable, key=, reverse=)` → new list · `list.sort()` in place | Timsort | yes | `key=` function (`len`, `abs`, `lambda p: (p.x, p.y)`) |
| C++ | `std::sort(begin, end, cmp)` | introsort (quick + heap + insertion) | <strong>no</strong> | comparator: `greater<int>()`, lambda |
| C++ | `std::stable_sort(begin, end, cmp)` | merge sort | yes | same comparator |
| Java | `Arrays.sort(int[])` (primitives) | dual-pivot quicksort | n/a (primitives are indistinguishable) | — |
| Java | `Arrays.sort(T[])`, `Collections.sort(list)`, `list.sort(cmp)` | Timsort | yes | `Comparator.comparingInt(...)`, `reverseOrder()` |
| JavaScript | `arr.sort(cmp)` in place · `arr.toSorted(cmp)` copy | Timsort (V8) | yes (since ES2019) | `(a, b) => a - b` — <strong>required</strong> for numbers |

```python filename:Python
nums = [5, 10, 15, 1]
print("ascending:", *sorted(nums))
print("descending:", *sorted(nums, reverse=True))

words = ["Thrishank", "Nani", "Kuntimaddi"]
print("by length:", *sorted(words, key=len))        # key: sort by what len() returns
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <functional>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {5, 10, 15, 1};
    sort(nums.begin(), nums.end());
    cout << "ascending:";
    for (int x : nums) cout << " " << x;
    cout << "\n";
    sort(nums.begin(), nums.end(), greater<int>());        // comparator: descending
    cout << "descending:";
    for (int x : nums) cout << " " << x;
    cout << "\n";

    vector<string> words = {"Thrishank", "Nani", "Kuntimaddi"};
    stable_sort(words.begin(), words.end(),                // stable: equal lengths keep their order
                [](const string& a, const string& b) { return a.size() < b.size(); });
    cout << "by length:";
    for (const string& w : words) cout << " " << w;
    cout << "\n";
}
```

```java filename:Java
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;

public class Main {
    public static void main(String[] args) {
        Integer[] nums = {5, 10, 15, 1};                      // boxed: needed for a Comparator
        Arrays.sort(nums);
        System.out.println("ascending: " + join(nums));
        Arrays.sort(nums, Collections.reverseOrder());        // comparator: descending
        System.out.println("descending: " + join(nums));

        String[] words = {"Thrishank", "Nani", "Kuntimaddi"};
        Arrays.sort(words, Comparator.comparingInt(String::length));   // Timsort: stable
        System.out.println("by length: " + join(words));
    }

    static String join(Object[] a) {
        StringBuilder sb = new StringBuilder();
        for (Object x : a) sb.append(sb.length() == 0 ? "" : " ").append(x);
        return sb.toString();
    }
}
```

```javascript filename:JavaScript
const nums = [5, 10, 15, 1];
console.log("ascending:", [...nums].sort((a, b) => a - b).join(" "));    // numeric comparator!
console.log("descending:", [...nums].sort((a, b) => b - a).join(" "));

const words = ["Thrishank", "Nani", "Kuntimaddi"];
console.log("by length:", words.toSorted((a, b) => a.length - b.length).join(" "));   // stable
```

```text filename:Output
ascending: 1 5 10 15
descending: 15 10 5 1
by length: Nani Thrishank Kuntimaddi
```

> [!WARNING] Pitfall
>
> JavaScript's `arr.sort()` <strong>without a comparator converts every element to a string</strong> and compares the strings. Numbers come out in dictionary order — a classic bug.

```javascript filename:JavaScript
const arr = [10, 9, 1, 100];
console.log([...arr].sort().join(" "));              // "10" < "9" as strings
console.log([...arr].sort((a, b) => a - b).join(" "));
```

```text filename:Output
1 10 100 9
1 9 10 100
```

# Python: sort() and sorted()

|  | `list.sort()` | `sorted(iterable)` |
| --- | --- | --- |
| Works on | lists only | any iterable: list, tuple, string, set, dict (its keys), generator |
| Result | sorts <strong>in place</strong>, returns `None` | returns a <strong>new list</strong>; the input is untouched |
| Parameters | `key=`, `reverse=` | `key=`, `reverse=` — identical meaning |
| Algorithm | Timsort, stable, `O(n log n)` worst, `O(n)` on sorted input | same |

```python filename:Python
l1 = [5, 10, 15, 1]
l1.sort()                          # in place
print(l1)                          # [1, 5, 10, 15]

l2 = [5, 10, 15, 1]
l2.sort(reverse=True)
print(l2)                          # [15, 10, 5, 1]

l3 = ['Thrishank', 'Nani', 'Kuntimaddi']
l3.sort()                          # strings: dictionary order
print(l3)                          # ['Kuntimaddi', 'Nani', 'Thrishank']

l4 = ['Thrishank', 'Nani', 'Kuntimaddi']
l4.sort(key=len)                   # sort by the key's value: 4, 9, 10
print(l4)                          # ['Nani', 'Thrishank', 'Kuntimaddi']
l4.sort(key=len, reverse=True)
print(l4)                          # ['Kuntimaddi', 'Thrishank', 'Nani']

print([5, 1, 3].sort())            # None   ← sort() returns None: a classic slip
```

> [!WARNING] Pitfall
>
> `x = l.sort()` leaves `x` as `None`. Use `l.sort()` on its own line, or `x = sorted(l)`.

<strong>Sorting objects.</strong> Either pass a `key` function that extracts the field to compare, or define `__lt__` on the class so the objects compare themselves. A tuple key such as `(p.x, p.y)` sorts by `x` and breaks ties by `y`.

```python filename:Python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __lt__(self, other):           # "less than": lets sort() compare Points directly
        if self.x == other.x:
            return self.y < other.y    # tie on x → compare y
        return self.x < other.x

pts = [Point(10, 15), Point(1, 15), Point(3, 8), Point(1, 7)]

by_x = sorted(pts, key=lambda p: p.x)             # key function: compare x only (stable → 1 15 before 1 7)
print("by x:", *(f"({p.x},{p.y})" for p in by_x))

pts.sort()                                        # uses __lt__: x, then y
print("by x then y:", *(f"({p.x},{p.y})" for p in pts))

pts.sort(key=lambda p: (p.y, p.x))                # tuple key: y, then x
print("by y then x:", *(f"({p.x},{p.y})" for p in pts))
```

```text filename:Output
by x: (1,15) (1,7) (3,8) (10,15)
by x then y: (1,7) (1,15) (3,8) (10,15)
by y then x: (1,7) (3,8) (1,15) (10,15)
```

<strong>`sorted()`</strong><strong> on other iterables</strong> — the result is always a list, even for a tuple, string or set. A dict sorts by its keys.

```python filename:Python
l = [30, 8, 23, 76, 12, 1, 12]
print(sorted(l))                         # [1, 8, 12, 12, 23, 30, 76]
print(l)                                 # [30, 8, 23, 76, 12, 1, 12]   ← untouched

l = [10, -15, -2, 1]
print(sorted(l, key=abs))                # [1, -2, 10, -15]
print(sorted(l, key=abs, reverse=True))  # [-15, 10, -2, 1]
print(sorted(l))                         # [-15, -2, 1, 10]

print(sorted((10, 12, 5, 1)))            # [1, 5, 10, 12]
print(sorted({'Thrishank', 'Nani', 'Kuntimaddi'}))   # ['Kuntimaddi', 'Nani', 'Thrishank']
print(sorted('gfg'))                     # ['f', 'g', 'g']
print(sorted({10: 'a', 12: 'b', 5: 'c'}))            # [5, 10, 12]   ← keys only
print(sorted([(10, 15), (12, 15), (3, 8)]))          # [(3, 8), (10, 15), (12, 15)]
```

> [!NOTE] Key point
>
> <strong>Timsort</strong> (Tim Peters, 2002) is a hybrid: it finds already-ordered <em>runs</em> in the input, sorts short runs with insertion sort, then merges runs with merge sort. That is why it is stable, `O(n log n)` in the worst case and `O(n)` on already-sorted data. Java uses it for objects and V8 for `Array.prototype.sort`.

# Stability

> [!INFO]
>
> <strong>Stable sort</strong> — a sort that keeps elements with <strong>equal keys</strong> in the same relative order they had in the input.

```text filename:Stability%20only%20matters%20when%20keys%20repeat
input   (name, marks):  (Anil, 50)  (Ayan, 80)  (Pyush, 50)  (Ramesh, 80)

sort by marks, stable:  (Anil, 50)  (Pyush, 50)  (Ayan, 80)  (Ramesh, 80)
                         ^ Anil still before Pyush, Ayan still before Ramesh

a possible unstable result:  (Pyush, 50)  (Anil, 50)  (Ayan, 80)  (Ramesh, 80)
                              ^ the two 50s swapped — equal keys, order lost
```

<strong>Why it matters:</strong> stability lets you sort by several fields in <em>passes</em>. Sort by the secondary key first, then stably by the primary key — rows with the same primary key stay in secondary order. Spreadsheets, SQL `ORDER BY a, b` and "sort by marks, then alphabetically" all rely on this. It is also what makes `sort by marks` leave an already alphabetical list alphabetical within each group.

```python filename:Python
students = [("Ramesh", 80), ("Anil", 50), ("Pyush", 50), ("Ayan", 80)]
show = lambda rows: ", ".join(f"{name} {marks}" for name, marks in rows)

print("input:", show(students))
print("by marks only:", show(sorted(students, key=lambda s: s[1])))   # ties keep input order

by_name = sorted(students)                                 # pass 1: secondary key
by_both = sorted(by_name, key=lambda s: s[1])              # pass 2: primary key, stable
print("by name, then by marks:", show(by_both))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>
using namespace std;

using Student = pair<string, int>;

void show(const char* label, const vector<Student>& rows) {
    cout << label;
    for (size_t i = 0; i < rows.size(); i++)
        cout << (i ? ", " : " ") << rows[i].first << " " << rows[i].second;
    cout << "\n";
}

int main() {
    vector<Student> students = {{"Ramesh", 80}, {"Anil", 50}, {"Pyush", 50}, {"Ayan", 80}};
    auto byMarks = [](const Student& a, const Student& b) { return a.second < b.second; };
    show("input:", students);

    vector<Student> v = students;
    stable_sort(v.begin(), v.end(), byMarks);          // std::sort would NOT guarantee the tie order
    show("by marks only:", v);

    v = students;
    sort(v.begin(), v.end());                          // pass 1: by name (pairs compare by first)
    stable_sort(v.begin(), v.end(), byMarks);          // pass 2: by marks, stable
    show("by name, then by marks:", v);
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class Main {
    record Student(String name, int marks) {}

    static String show(List<Student> rows) {
        StringBuilder sb = new StringBuilder();
        for (Student s : rows) sb.append(sb.length() == 0 ? "" : ", ").append(s.name()).append(' ').append(s.marks());
        return sb.toString();
    }

    public static void main(String[] args) {
        List<Student> students = List.of(new Student("Ramesh", 80), new Student("Anil", 50),
                                         new Student("Pyush", 50), new Student("Ayan", 80));
        System.out.println("input: " + show(students));

        List<Student> v = new ArrayList<>(students);
        v.sort(Comparator.comparingInt(Student::marks));     // List.sort is Timsort: stable
        System.out.println("by marks only: " + show(v));

        v = new ArrayList<>(students);
        v.sort(Comparator.comparing(Student::name));         // pass 1: by name
        v.sort(Comparator.comparingInt(Student::marks));     // pass 2: by marks, stable
        System.out.println("by name, then by marks: " + show(v));
    }
}
```

```javascript filename:JavaScript
const students = [["Ramesh", 80], ["Anil", 50], ["Pyush", 50], ["Ayan", 80]];
const show = rows => rows.map(([name, marks]) => `${name} ${marks}`).join(", ");

console.log("input:", show(students));
console.log("by marks only:", show(students.toSorted((a, b) => a[1] - b[1])));   // stable since ES2019

const byName = students.toSorted((a, b) => a[0].localeCompare(b[0]));   // pass 1: by name
const byBoth = byName.toSorted((a, b) => a[1] - b[1]);                  // pass 2: by marks, stable
console.log("by name, then by marks:", show(byBoth));
```

```text filename:Output
input: Ramesh 80, Anil 50, Pyush 50, Ayan 80
by marks only: Anil 50, Pyush 50, Ramesh 80, Ayan 80
by name, then by marks: Anil 50, Pyush 50, Ayan 80, Ramesh 80
```

| Stable | Not stable | Why |
| --- | --- | --- |
| Bubble sort | Selection sort | selection swaps the minimum over elements it has not compared with — a long-distance swap can jump one equal element over another |
| Insertion sort | Quick sort | partition swaps elements across the whole range |
| Merge sort | Heap sort | the heap's swaps with the last leaf reorder equal keys |
| Timsort, counting sort | `std::sort`, `Arrays.sort(int[])` | introsort / quicksort based |

> [!NOTE] Key point
>
> Any unstable sort can be made stable by sorting `(key, original index)` pairs — at the cost of `O(n)` extra memory. And stability is irrelevant when keys are <em>all</em> of the data (sorting plain integers): two equal `5`s are indistinguishable.

# Bubble sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 12, 5, 1, 10, 4, 56, 100]`<br><strong>Output:</strong> `1 4 5 10 10 12 56 100`

> [!NOTE] Idea
>
> Repeatedly walk the array and <strong>swap adjacent elements that are out of order</strong>. After pass 1 the largest element has <em>bubbled</em> to the end; after pass `i` the last `i` positions are final, so each pass can stop earlier. If a whole pass makes no swap the array is sorted — stop early.

```text filename:Each%20pass%20carries%20the%20largest%20remaining%20element%20to%20its%20place
pass 1 on [5, 1, 4, 2]:
  (5 1) 4 2  →  swap  →  1 5 4 2
  1 (5 4) 2  →  swap  →  1 4 5 2
  1 4 (5 2)  →  swap  →  1 4 2 5      5 is now final
pass 2 on the first 3:
  (1 4) 2    →  ok
  1 (4 2)    →  swap  →  1 2 4 5      4 is now final
pass 3: (1 2) ok → no swap in the whole pass → sorted
```

```python filename:Python
def bubble_sort(arr):
    n = len(arr)
    passes = 0
    for i in range(n - 1):
        swapped = False
        passes += 1
        for j in range(n - i - 1):            # last i elements are already in place
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:                       # a clean pass: already sorted
            break
    return passes

for arr in ([10, 12, 5, 1, 10, 4, 56, 100], [1, 2, 3, 4, 5]):
    passes = bubble_sort(arr)
    print("sorted:", *arr)
    print("passes:", passes)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

int bubbleSort(vector<int>& arr) {
    int n = arr.size(), passes = 0;
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        passes++;
        for (int j = 0; j < n - i - 1; j++) {        // last i elements are already in place
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;                           // a clean pass: already sorted
    }
    return passes;
}

int main() {
    vector<vector<int>> tests = {{10, 12, 5, 1, 10, 4, 56, 100}, {1, 2, 3, 4, 5}};
    for (auto& arr : tests) {
        int passes = bubbleSort(arr);
        cout << "sorted:";
        for (int x : arr) cout << " " << x;
        cout << "\npasses: " << passes << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int bubbleSort(int[] arr) {
        int n = arr.length, passes = 0;
        for (int i = 0; i < n - 1; i++) {
            boolean swapped = false;
            passes++;
            for (int j = 0; j < n - i - 1; j++) {        // last i elements are already in place
                if (arr[j] > arr[j + 1]) {
                    int t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t;
                    swapped = true;
                }
            }
            if (!swapped) break;                           // a clean pass: already sorted
        }
        return passes;
    }

    public static void main(String[] args) {
        int[][] tests = {{10, 12, 5, 1, 10, 4, 56, 100}, {1, 2, 3, 4, 5}};
        for (int[] arr : tests) {
            int passes = bubbleSort(arr);
            StringBuilder sb = new StringBuilder("sorted:");
            for (int x : arr) sb.append(' ').append(x);
            System.out.println(sb);
            System.out.println("passes: " + passes);
        }
    }
}
```

```javascript filename:JavaScript
function bubbleSort(arr) {
    const n = arr.length;
    let passes = 0;
    for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        passes++;
        for (let j = 0; j < n - i - 1; j++) {            // last i elements are already in place
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swapped = true;
            }
        }
        if (!swapped) break;                               // a clean pass: already sorted
    }
    return passes;
}

for (const arr of [[10, 12, 5, 1, 10, 4, 56, 100], [1, 2, 3, 4, 5]]) {
    const passes = bubbleSort(arr);
    console.log("sorted:", arr.join(" "));
    console.log("passes:", passes);
}
```

```text filename:Output
sorted: 1 4 5 10 10 12 56 100
passes: 5
sorted: 1 2 3 4 5
passes: 1
```

Time O(n²) — O(n) best with the swapped flag · Space O(1)

- <strong>Stable</strong>: only adjacent elements are swapped, and only when strictly greater — equal neighbours never cross.
- <strong>In-place</strong>, trivially simple — which is why it appears in every textbook and almost no real program.
- Without the `swapped` flag it always runs `n − 1` full passes, even on sorted input.

# Selection sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [29, 10, 14, 37, 13]`<br><strong>Output:</strong> `10 13 14 29 37`

> [!NOTE] Idea
>
> Position `i` should hold the `i`-th smallest value. Find the <strong>minimum of the unsorted part</strong> `arr[i..n-1]` and swap it into position `i`; the sorted prefix grows by one each pass. Exactly `n − 1` swaps, whatever the input.

```python filename:Python
def selection_sort(arr, trace=False):
    n = len(arr)
    for i in range(n - 1):
        min_index = i
        for j in range(i + 1, n):           # find the minimum of arr[i..n-1]
            if arr[j] < arr[min_index]:
                min_index = j
        arr[i], arr[min_index] = arr[min_index], arr[i]   # one swap per pass
        if trace:
            print(f"pass {i + 1}: min {arr[i]} ->", *arr)

selection_sort([29, 10, 14, 37, 13], trace=True)
arr = [10, 12, 5, 1, 10, 4, 56, 100]
selection_sort(arr)
print("sorted:", *arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

void show(const vector<int>& arr) {
    for (int x : arr) cout << " " << x;
    cout << "\n";
}

void selectionSort(vector<int>& arr, bool trace = false) {
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {
        int minIndex = i;
        for (int j = i + 1; j < n; j++)              // find the minimum of arr[i..n-1]
            if (arr[j] < arr[minIndex]) minIndex = j;
        swap(arr[i], arr[minIndex]);                 // one swap per pass
        if (trace) { cout << "pass " << i + 1 << ": min " << arr[i] << " ->"; show(arr); }
    }
}

int main() {
    vector<int> small = {29, 10, 14, 37, 13};
    selectionSort(small, true);
    vector<int> arr = {10, 12, 5, 1, 10, 4, 56, 100};
    selectionSort(arr);
    cout << "sorted:";
    show(arr);
}
```

```java filename:Java
public class Main {
    static String join(int[] arr) {
        StringBuilder sb = new StringBuilder();
        for (int x : arr) sb.append(' ').append(x);
        return sb.toString();
    }

    static void selectionSort(int[] arr, boolean trace) {
        int n = arr.length;
        for (int i = 0; i < n - 1; i++) {
            int minIndex = i;
            for (int j = i + 1; j < n; j++)              // find the minimum of arr[i..n-1]
                if (arr[j] < arr[minIndex]) minIndex = j;
            int t = arr[i]; arr[i] = arr[minIndex]; arr[minIndex] = t;   // one swap per pass
            if (trace) System.out.println("pass " + (i + 1) + ": min " + arr[i] + " ->" + join(arr));
        }
    }

    public static void main(String[] args) {
        selectionSort(new int[]{29, 10, 14, 37, 13}, true);
        int[] arr = {10, 12, 5, 1, 10, 4, 56, 100};
        selectionSort(arr, false);
        System.out.println("sorted:" + join(arr));
    }
}
```

```javascript filename:JavaScript
function selectionSort(arr, trace = false) {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
        let minIndex = i;
        for (let j = i + 1; j < n; j++)                  // find the minimum of arr[i..n-1]
            if (arr[j] < arr[minIndex]) minIndex = j;
        [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];   // one swap per pass
        if (trace) console.log(`pass ${i + 1}: min ${arr[i]} ->`, arr.join(" "));
    }
}

selectionSort([29, 10, 14, 37, 13], true);
const arr = [10, 12, 5, 1, 10, 4, 56, 100];
selectionSort(arr);
console.log("sorted:", arr.join(" "));
```

```text filename:Output
pass 1: min 10 -> 10 29 14 37 13
pass 2: min 13 -> 10 13 14 37 29
pass 3: min 14 -> 10 13 14 37 29
pass 4: min 29 -> 10 13 14 29 37
sorted: 1 4 5 10 10 12 56 100
```

Time Θ(n²) in every case · Space O(1)

- Always `Θ(n²)` comparisons — it cannot notice that the input is already sorted.
- <strong>Fewest memory writes</strong> of the simple sorts (at most `n − 1` swaps), useful when writes are expensive (flash memory). Cycle sort is the optimum for writes.
- <strong>Not stable</strong>: in pass 1 on `[2a, 2b, 1]` the `1` is swapped with `2a`, which lands after `2b`.
- In-place. Its idea — repeatedly extract the minimum — is the seed of <strong>heap sort</strong>, which extracts it in `O(log n)` instead of `O(n)`.

# Insertion sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 12, 5, 1, 10, 4]`<br><strong>Output:</strong> `1 4 5 10 10 12`

> [!NOTE] Idea
>
> Keep the prefix `arr[0..i-1]` sorted (as you would sort cards in your hand). Take the next element `x = arr[i]`, <strong>shift</strong> every larger element of the prefix one slot to the right, and drop `x` into the gap. On nearly sorted input almost nothing shifts, which is why it is `O(n)` in the best case.

```text filename:Insert%20arr%5Bi%5D%20into%20the%20sorted%20prefix%20by%20shifting%2C%20not%20swapping
i = 2, x = 5:     [10, 12 | 5, 1, 10, 4]
                   shift 12 →  [10, _, 12]   shift 10 →  [_, 10, 12]   place 5 →  [5, 10, 12 | 1, 10, 4]
```

```python filename:Python
def insertion_sort(arr, trace=False):
    for i in range(1, len(arr)):
        x = arr[i]                             # the element to insert
        j = i - 1
        while j >= 0 and arr[j] > x:           # shift larger elements right ...
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = x                         # ... and drop x into the gap
        if trace:
            print(f"insert {x}:", *arr)

insertion_sort([10, 12, 5, 1, 10, 4], trace=True)
arr = [10, 12, 5, 1, 10, 4, 56, 100]
insertion_sort(arr)
print("sorted:", *arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void show(const vector<int>& arr) {
    for (int x : arr) cout << " " << x;
    cout << "\n";
}

void insertionSort(vector<int>& arr, bool trace = false) {
    int n = arr.size();
    for (int i = 1; i < n; i++) {
        int x = arr[i];                              // the element to insert
        int j = i - 1;
        while (j >= 0 && arr[j] > x) {               // shift larger elements right ...
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = x;                              // ... and drop x into the gap
        if (trace) { cout << "insert " << x << ":"; show(arr); }
    }
}

int main() {
    vector<int> small = {10, 12, 5, 1, 10, 4};
    insertionSort(small, true);
    vector<int> arr = {10, 12, 5, 1, 10, 4, 56, 100};
    insertionSort(arr);
    cout << "sorted:";
    show(arr);
}
```

```java filename:Java
public class Main {
    static String join(int[] arr) {
        StringBuilder sb = new StringBuilder();
        for (int x : arr) sb.append(' ').append(x);
        return sb.toString();
    }

    static void insertionSort(int[] arr, boolean trace) {
        for (int i = 1; i < arr.length; i++) {
            int x = arr[i];                              // the element to insert
            int j = i - 1;
            while (j >= 0 && arr[j] > x) {               // shift larger elements right ...
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = x;                              // ... and drop x into the gap
            if (trace) System.out.println("insert " + x + ":" + join(arr));
        }
    }

    public static void main(String[] args) {
        insertionSort(new int[]{10, 12, 5, 1, 10, 4}, true);
        int[] arr = {10, 12, 5, 1, 10, 4, 56, 100};
        insertionSort(arr, false);
        System.out.println("sorted:" + join(arr));
    }
}
```

```javascript filename:JavaScript
function insertionSort(arr, trace = false) {
    for (let i = 1; i < arr.length; i++) {
        const x = arr[i];                                // the element to insert
        let j = i - 1;
        while (j >= 0 && arr[j] > x) {                   // shift larger elements right ...
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = x;                                  // ... and drop x into the gap
        if (trace) console.log(`insert ${x}:`, arr.join(" "));
    }
}

insertionSort([10, 12, 5, 1, 10, 4], true);
const arr = [10, 12, 5, 1, 10, 4, 56, 100];
insertionSort(arr);
console.log("sorted:", arr.join(" "));
```

```text filename:Output
insert 12: 10 12 5 1 10 4
insert 5: 5 10 12 1 10 4
insert 1: 1 5 10 12 10 4
insert 10: 1 5 10 10 12 4
insert 4: 1 4 5 10 10 12
sorted: 1 4 5 10 10 12 56 100
```

Time O(n²) worst / average · O(n) best (sorted input) · Space O(1)

- <strong>Stable</strong> (shifts only strictly greater elements) and <strong>in-place</strong>.
- The practical choice for <strong>small arrays</strong> (≈ 16–32 elements) and nearly sorted data — Timsort and introsort both switch to insertion sort for short ranges.
- `O(n + d)` where `d` is the number of inversions: an array with few elements out of place sorts in almost linear time.

> [!WARNING] Pitfall
>
> The original notes compared `x < l[i]` in the inner loop. `l[i]` <em>is</em> `x`, so the condition is never true and nothing is ever shifted — the array came back unsorted. The comparison must be against `arr[j]`, the element being shifted.

# Merging two sorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [10, 15, 20], b = [5, 6, 6, 30]`<br><strong>Output:</strong> `5 6 6 10 15 20 30`

Naive: concatenate and sort — `O((m + n) log(m + n))`. It ignores the fact that both inputs are already sorted.

```python filename:Python
def merge_naive(a, b):
    res = a + b
    res.sort()                 # throws away the order we already had
    return res

print(*merge_naive([10, 15, 20], [5, 6, 6, 30]))
```

```text filename:Output
5 6 6 10 15 20 30
```

> [!NOTE] Idea
>
> <strong>Two pointers.</strong> The smallest remaining element of the union is either `a[i]` or `b[j]` — the heads of the two arrays. Compare them, copy the smaller one to the result and advance its pointer. When one array runs out, copy the rest of the other. Every element is looked at once: `O(m + n)`.

```text filename:The%20merge%20step%3A%20always%20take%20the%20smaller%20head
a = [10, 15, 20]       b = [5, 6, 6, 30]       res = []
     i                      j
10 > 5   → take 5          res = [5]              j → 6
10 > 6   → take 6          res = [5 6]            j → 6
10 > 6   → take 6          res = [5 6 6]          j → 30
10 < 30  → take 10         res = [5 6 6 10]       i → 15
15 < 30  → take 15         res = [5 6 6 10 15]    i → 20
20 < 30  → take 20         res = [5 6 6 10 15 20] a is exhausted
copy the rest of b         res = [5 6 6 10 15 20 30]
```

```python filename:Python
def merge(a, b):
    res = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:             # <= keeps the merge stable (a's element first on a tie)
            res.append(a[i])
            i += 1
        else:
            res.append(b[j])
            j += 1
    res.extend(a[i:])                # at most one of these has anything left
    res.extend(b[j:])
    return res

print(*merge([10, 15, 20], [5, 6, 6, 30]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> merge(const vector<int>& a, const vector<int>& b) {
    vector<int> res;
    int m = a.size(), n = b.size(), i = 0, j = 0;
    while (i < m && j < n) {
        if (a[i] <= b[j]) res.push_back(a[i++]);   // <= keeps the merge stable
        else res.push_back(b[j++]);
    }
    while (i < m) res.push_back(a[i++]);           // at most one of these has anything left
    while (j < n) res.push_back(b[j++]);
    return res;
}

int main() {
    vector<int> res = merge({10, 15, 20}, {5, 6, 6, 30});
    for (size_t k = 0; k < res.size(); k++) cout << (k ? " " : "") << res[k];
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static int[] merge(int[] a, int[] b) {
        int m = a.length, n = b.length, i = 0, j = 0, k = 0;
        int[] res = new int[m + n];
        while (i < m && j < n) {
            if (a[i] <= b[j]) res[k++] = a[i++];     // <= keeps the merge stable
            else res[k++] = b[j++];
        }
        while (i < m) res[k++] = a[i++];             // at most one of these has anything left
        while (j < n) res[k++] = b[j++];
        return res;
    }

    public static void main(String[] args) {
        int[] res = merge(new int[]{10, 15, 20}, new int[]{5, 6, 6, 30});
        StringBuilder sb = new StringBuilder();
        for (int x : res) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function merge(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] <= b[j]) res.push(a[i++]);       // <= keeps the merge stable
        else res.push(b[j++]);
    }
    while (i < a.length) res.push(a[i++]);        // at most one of these has anything left
    while (j < b.length) res.push(b[j++]);
    return res;
}

console.log(merge([10, 15, 20], [5, 6, 6, 30]).join(" "));
```

```text filename:Output
5 6 6 10 15 20 30
```

Time O(m + n) · Space O(m + n) for the result

> [!NOTE] Key point
>
> Use `<=` (not `<`) when comparing `a[i]` with `b[j]`: on a tie the element from the <em>left</em> array is taken first, which is what makes merge sort stable.

# Merge subarray

> [!TIP] Example
>
> <strong>Input:</strong> `a = [10, 15, 20, 11, 13], low = 0, mid = 2, high = 4`<br><strong>Output:</strong> `10 11 13 15 20`

Merge sort needs the same merge, but <strong>inside one array</strong>: the two sorted halves are `a[low..mid]` and `a[mid+1..high]`, and the merged result must land back in `a[low..high]`. Copy the two halves into temporary arrays `left` and `right`, then merge them back starting at index `low`.

```python filename:Python
def merge(a, low, mid, high):
    left = a[low:mid + 1]                   # copies: a[low..mid] and a[mid+1..high]
    right = a[mid + 1:high + 1]
    i = j = 0
    k = low                                 # write position in a
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            a[k] = left[i]
            i += 1
        else:
            a[k] = right[j]
            j += 1
        k += 1
    while i < len(left):                    # leftovers
        a[k] = left[i]
        i += 1
        k += 1
    while j < len(right):
        a[k] = right[j]
        j += 1
        k += 1

a = [10, 15, 20, 11, 13]
merge(a, 0, 2, 4)
print(*a)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void merge(vector<int>& a, int low, int mid, int high) {
    vector<int> left(a.begin() + low, a.begin() + mid + 1);        // a[low..mid]
    vector<int> right(a.begin() + mid + 1, a.begin() + high + 1);  // a[mid+1..high]
    int nl = left.size(), nr = right.size(), i = 0, j = 0, k = low;   // k: write position in a
    while (i < nl && j < nr) {
        if (left[i] <= right[j]) a[k++] = left[i++];
        else a[k++] = right[j++];
    }
    while (i < nl) a[k++] = left[i++];        // leftovers
    while (j < nr) a[k++] = right[j++];
}

int main() {
    vector<int> a = {10, 15, 20, 11, 13};
    merge(a, 0, 2, 4);
    for (size_t k = 0; k < a.size(); k++) cout << (k ? " " : "") << a[k];
    cout << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static void merge(int[] a, int low, int mid, int high) {
        int[] left = Arrays.copyOfRange(a, low, mid + 1);         // a[low..mid]
        int[] right = Arrays.copyOfRange(a, mid + 1, high + 1);   // a[mid+1..high]
        int i = 0, j = 0, k = low;                                // k: write position in a
        while (i < left.length && j < right.length) {
            if (left[i] <= right[j]) a[k++] = left[i++];
            else a[k++] = right[j++];
        }
        while (i < left.length) a[k++] = left[i++];              // leftovers
        while (j < right.length) a[k++] = right[j++];
    }

    public static void main(String[] args) {
        int[] a = {10, 15, 20, 11, 13};
        merge(a, 0, 2, 4);
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function merge(a, low, mid, high) {
    const left = a.slice(low, mid + 1);            // a[low..mid]
    const right = a.slice(mid + 1, high + 1);      // a[mid+1..high]
    let i = 0, j = 0, k = low;                     // k: write position in a
    while (i < left.length && j < right.length) {
        if (left[i] <= right[j]) a[k++] = left[i++];
        else a[k++] = right[j++];
    }
    while (i < left.length) a[k++] = left[i++];   // leftovers
    while (j < right.length) a[k++] = right[j++];
}

const a = [10, 15, 20, 11, 13];
merge(a, 0, 2, 4);
console.log(a.join(" "));
```

```text filename:Output
10 11 13 15 20
```

Time O(high − low + 1) · Space O(high − low + 1) temporary copies

# Merge sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [38, 27, 43, 3, 9, 82, 10]`<br><strong>Output:</strong> `3 9 10 27 38 43 82`

> [!NOTE] Idea
>
> <strong>Divide and conquer.</strong> A one-element array is sorted. Otherwise split the array in half, sort each half recursively, and <em>merge</em> the two sorted halves with the merge above. All the real work happens in the merges: `log n` levels, each merging `n` elements in total.

```text filename:Split%20down%20to%20single%20elements%2C%20then%20merge%20back%20up%20%E2%80%94%20log2%20n%20levels
             [38 27 43 3 9 82 10]
            /                    \                  divide
     [38 27 43 3]              [9 82 10]
      /        \                /       \
  [38 27]    [43 3]         [9 82]     [10]
  /    \      /   \         /   \
[38]  [27]  [43]  [3]     [9]  [82]
  \    /      \   /         \   /
  [27 38]    [3 43]        [9 82]     [10]           merge
      \        /                \       /
     [3 27 38 43]              [9 10 82]
            \                    /
             [3 9 10 27 38 43 82]
```

```python filename:Python
def merge(a, low, mid, high):
    left, right = a[low:mid + 1], a[mid + 1:high + 1]
    i = j = 0
    k = low
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            a[k] = left[i]; i += 1
        else:
            a[k] = right[j]; j += 1
        k += 1
    while i < len(left):
        a[k] = left[i]; i += 1; k += 1
    while j < len(right):
        a[k] = right[j]; j += 1; k += 1

def merge_sort(a, low, high):
    if low < high:                       # at least two elements
        mid = low + (high - low) // 2
        merge_sort(a, low, mid)          # sort the left half
        merge_sort(a, mid + 1, high)     # sort the right half
        merge(a, low, mid, high)         # combine

for arr in ([38, 27, 43, 3, 9, 82, 10], [10, 15, 20, 11, 13]):
    merge_sort(arr, 0, len(arr) - 1)
    print(*arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void merge(vector<int>& a, int low, int mid, int high) {
    vector<int> left(a.begin() + low, a.begin() + mid + 1);
    vector<int> right(a.begin() + mid + 1, a.begin() + high + 1);
    int nl = left.size(), nr = right.size(), i = 0, j = 0, k = low;
    while (i < nl && j < nr) a[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
    while (i < nl) a[k++] = left[i++];
    while (j < nr) a[k++] = right[j++];
}

void mergeSort(vector<int>& a, int low, int high) {
    if (low < high) {                          // at least two elements
        int mid = low + (high - low) / 2;
        mergeSort(a, low, mid);                // sort the left half
        mergeSort(a, mid + 1, high);           // sort the right half
        merge(a, low, mid, high);              // combine
    }
}

int main() {
    vector<vector<int>> tests = {{38, 27, 43, 3, 9, 82, 10}, {10, 15, 20, 11, 13}};
    for (auto& arr : tests) {
        mergeSort(arr, 0, (int)arr.size() - 1);
        for (size_t k = 0; k < arr.size(); k++) cout << (k ? " " : "") << arr[k];
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static void merge(int[] a, int low, int mid, int high) {
        int[] left = Arrays.copyOfRange(a, low, mid + 1);
        int[] right = Arrays.copyOfRange(a, mid + 1, high + 1);
        int i = 0, j = 0, k = low;
        while (i < left.length && j < right.length) a[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
        while (i < left.length) a[k++] = left[i++];
        while (j < right.length) a[k++] = right[j++];
    }

    static void mergeSort(int[] a, int low, int high) {
        if (low < high) {                          // at least two elements
            int mid = low + (high - low) / 2;
            mergeSort(a, low, mid);                // sort the left half
            mergeSort(a, mid + 1, high);           // sort the right half
            merge(a, low, mid, high);              // combine
        }
    }

    public static void main(String[] args) {
        int[][] tests = {{38, 27, 43, 3, 9, 82, 10}, {10, 15, 20, 11, 13}};
        for (int[] arr : tests) {
            mergeSort(arr, 0, arr.length - 1);
            StringBuilder sb = new StringBuilder();
            for (int x : arr) sb.append(sb.length() == 0 ? "" : " ").append(x);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function merge(a, low, mid, high) {
    const left = a.slice(low, mid + 1), right = a.slice(mid + 1, high + 1);
    let i = 0, j = 0, k = low;
    while (i < left.length && j < right.length) a[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
    while (i < left.length) a[k++] = left[i++];
    while (j < right.length) a[k++] = right[j++];
}

function mergeSort(a, low, high) {
    if (low < high) {                              // at least two elements
        const mid = low + Math.floor((high - low) / 2);
        mergeSort(a, low, mid);                    // sort the left half
        mergeSort(a, mid + 1, high);               // sort the right half
        merge(a, low, mid, high);                  // combine
    }
}

for (const arr of [[38, 27, 43, 3, 9, 82, 10], [10, 15, 20, 11, 13]]) {
    mergeSort(arr, 0, arr.length - 1);
    console.log(arr.join(" "));
}
```

```text filename:Output
3 9 10 27 38 43 82
10 11 13 15 20
```

Time Θ(n log n) in every case · Space O(n) temporary arrays + O(log n) stack

`T(n) = 2 T(n / 2) + Θ(n) ⇒ T(n) = Θ(n log n)`

- <strong>Stable</strong> (the `<=` in merge) and <strong>guaranteed</strong> `Θ(n log n)` — no bad inputs, unlike quick sort.
- <strong>Not in-place</strong>: the merge needs `O(n)` temporary space. (In-place variants exist but are slow or complex.)
- Ideal for <strong>linked lists</strong>: splitting and merging lists needs no extra array, so it sorts a list in `O(1)` auxiliary space — and it is the default list sort in many libraries.
- Used in <strong>external sorting</strong> (data larger than memory): sort chunks that fit in RAM, then merge the sorted chunks sequentially from disk.
- Timsort is merge sort with insertion-sorted runs; it is what Python and Java's object sort run.

> [!WARNING] Pitfall
>
> Writing `mergeSort(a, mid, high)` for the right half re-includes `a[mid]` in both halves and recurses forever on two elements. The halves are `[low..mid]` and `[mid+1..high]`.

# Union of two sorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [3, 5, 8, 9, 10, 15], b = [2, 8, 9, 10, 15]`<br><strong>Output:</strong> `2 3 5 8 9 10 15`<br><strong>Input:</strong> `a = [1, 1, 3, 3, 5], b = [1, 2, 2, 3]`<br><strong>Output:</strong> `1 2 3 5`

The union is every distinct value present in either array, in sorted order. Naive: concatenate, sort, then print each element that differs from its predecessor — `O((m + n) log(m + n))`.

```python filename:Python
def union_naive(a, b):
    c = sorted(a + b)
    return [c[i] for i in range(len(c)) if i == 0 or c[i] != c[i - 1]]   # skip repeats

print(*union_naive([3, 5, 8, 9, 10, 15], [2, 8, 9, 10, 15]))
```

```text filename:Output
2 3 5 8 9 10 15
```

> [!NOTE] Idea
>
> It is the <strong>merge</strong> two-pointer walk with two extra rules: skip an element equal to the previous one in its own array (duplicates <em>within</em> an array), and when `a[i] == b[j]` output it once and advance both pointers (duplicates <em>across</em> the arrays). The leftovers after one array is exhausted need the same within-array duplicate check.

```python filename:Python
def union(a, b):
    res = []
    i = j = 0
    m, n = len(a), len(b)
    while i < m and j < n:
        if i > 0 and a[i] == a[i - 1]:          # duplicate inside a: skip
            i += 1
        elif j > 0 and b[j] == b[j - 1]:        # duplicate inside b: skip
            j += 1
        elif a[i] < b[j]:
            res.append(a[i]); i += 1
        elif a[i] > b[j]:
            res.append(b[j]); j += 1
        else:                                   # equal: take once, advance both
            res.append(a[i]); i += 1; j += 1
    while i < m:                                # leftovers of a (still skipping duplicates)
        if i == 0 or a[i] != a[i - 1]:
            res.append(a[i])
        i += 1
    while j < n:                                # leftovers of b
        if j == 0 or b[j] != b[j - 1]:
            res.append(b[j])
        j += 1
    return res

print(*union([3, 5, 8, 9, 10, 15], [2, 8, 9, 10, 15]))
print(*union([1, 1, 3, 3, 5], [1, 2, 2, 3]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> unionOf(const vector<int>& a, const vector<int>& b) {
    vector<int> res;
    int m = a.size(), n = b.size(), i = 0, j = 0;
    while (i < m && j < n) {
        if (i > 0 && a[i] == a[i - 1]) i++;              // duplicate inside a: skip
        else if (j > 0 && b[j] == b[j - 1]) j++;         // duplicate inside b: skip
        else if (a[i] < b[j]) res.push_back(a[i++]);
        else if (a[i] > b[j]) res.push_back(b[j++]);
        else { res.push_back(a[i]); i++; j++; }          // equal: take once, advance both
    }
    for (; i < m; i++) if (i == 0 || a[i] != a[i - 1]) res.push_back(a[i]);   // leftovers of a
    for (; j < n; j++) if (j == 0 || b[j] != b[j - 1]) res.push_back(b[j]);   // leftovers of b
    return res;
}

void show(const vector<int>& v) {
    for (size_t k = 0; k < v.size(); k++) cout << (k ? " " : "") << v[k];
    cout << "\n";
}

int main() {
    show(unionOf({3, 5, 8, 9, 10, 15}, {2, 8, 9, 10, 15}));
    show(unionOf({1, 1, 3, 3, 5}, {1, 2, 2, 3}));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> union(int[] a, int[] b) {
        List<Integer> res = new ArrayList<>();
        int m = a.length, n = b.length, i = 0, j = 0;
        while (i < m && j < n) {
            if (i > 0 && a[i] == a[i - 1]) i++;              // duplicate inside a: skip
            else if (j > 0 && b[j] == b[j - 1]) j++;         // duplicate inside b: skip
            else if (a[i] < b[j]) res.add(a[i++]);
            else if (a[i] > b[j]) res.add(b[j++]);
            else { res.add(a[i]); i++; j++; }                // equal: take once, advance both
        }
        for (; i < m; i++) if (i == 0 || a[i] != a[i - 1]) res.add(a[i]);   // leftovers of a
        for (; j < n; j++) if (j == 0 || b[j] != b[j - 1]) res.add(b[j]);   // leftovers of b
        return res;
    }

    static void show(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        show(union(new int[]{3, 5, 8, 9, 10, 15}, new int[]{2, 8, 9, 10, 15}));
        show(union(new int[]{1, 1, 3, 3, 5}, new int[]{1, 2, 2, 3}));
    }
}
```

```javascript filename:JavaScript
function union(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if (i > 0 && a[i] === a[i - 1]) i++;                 // duplicate inside a: skip
        else if (j > 0 && b[j] === b[j - 1]) j++;            // duplicate inside b: skip
        else if (a[i] < b[j]) res.push(a[i++]);
        else if (a[i] > b[j]) res.push(b[j++]);
        else { res.push(a[i]); i++; j++; }                   // equal: take once, advance both
    }
    for (; i < a.length; i++) if (i === 0 || a[i] !== a[i - 1]) res.push(a[i]);   // leftovers of a
    for (; j < b.length; j++) if (j === 0 || b[j] !== b[j - 1]) res.push(b[j]);   // leftovers of b
    return res;
}

console.log(union([3, 5, 8, 9, 10, 15], [2, 8, 9, 10, 15]).join(" "));
console.log(union([1, 1, 3, 3, 5], [1, 2, 2, 3]).join(" "));
```

```text filename:Output
2 3 5 8 9 10 15
1 2 3 5
```

Time O(m + n) · Space O(m + n) for the result

> [!WARNING] Pitfall
>
> The original notes' leftover loops printed an element only when it <strong>equalled</strong> its predecessor and advanced the pointer only in that case — so they printed the wrong values and looped forever on a non-duplicate. The leftover loop must advance on every iteration and print when the element <em>differs</em> from its predecessor.

# Intersection of two sorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [3, 5, 10, 10, 10, 10, 15, 15, 20], b = [5, 10, 10, 15, 30]`<br><strong>Output:</strong> `5 10 15`

The intersection is every distinct value present in <strong>both</strong> arrays. Naive: for each element of `a` (skipping repeats), scan `b` for it — `O(m · n)`.

```python filename:Python
def intersection_naive(a, b):
    res = []
    for i in range(len(a)):
        if i > 0 and a[i] == a[i - 1]:
            continue                         # already handled this value
        for x in b:                          # linear scan of b
            if x == a[i]:
                res.append(x)
                break
    return res

print(*intersection_naive([3, 5, 10, 10, 10, 10, 15, 15, 20], [5, 10, 10, 15, 30]))
```

```text filename:Output
5 10 15
```

> [!NOTE] Idea
>
> Two pointers again. Skip duplicates in `a`. If `a[i] < b[j]`, `a[i]` cannot be in `b` any more — advance `i`; if `a[i] > b[j]` advance `j`; if equal, output it and advance both. Duplicates in `b` are harmless: after a match `i` moves to a larger value, so the repeated `b[j]` is simply skipped by the `>` rule.

```python filename:Python
def intersection(a, b):
    res = []
    i = j = 0
    while i < len(a) and j < len(b):
        if i > 0 and a[i] == a[i - 1]:      # duplicate inside a: skip
            i += 1
        elif a[i] < b[j]:                   # a[i] is too small to be in b from here on
            i += 1
        elif a[i] > b[j]:                   # b[j] is too small
            j += 1
        else:                               # common value
            res.append(a[i]); i += 1; j += 1
    return res

print(*intersection([3, 5, 10, 10, 10, 10, 15, 15, 20], [5, 10, 10, 15, 30]))
print(*intersection([1, 2, 2, 3, 3, 3], [2, 2, 3, 4]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> intersection(const vector<int>& a, const vector<int>& b) {
    vector<int> res;
    int m = a.size(), n = b.size(), i = 0, j = 0;
    while (i < m && j < n) {
        if (i > 0 && a[i] == a[i - 1]) i++;          // duplicate inside a: skip
        else if (a[i] < b[j]) i++;                   // a[i] is too small to be in b from here on
        else if (a[i] > b[j]) j++;                   // b[j] is too small
        else { res.push_back(a[i]); i++; j++; }      // common value
    }
    return res;
}

void show(const vector<int>& v) {
    for (size_t k = 0; k < v.size(); k++) cout << (k ? " " : "") << v[k];
    cout << "\n";
}

int main() {
    show(intersection({3, 5, 10, 10, 10, 10, 15, 15, 20}, {5, 10, 10, 15, 30}));
    show(intersection({1, 2, 2, 3, 3, 3}, {2, 2, 3, 4}));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> intersection(int[] a, int[] b) {
        List<Integer> res = new ArrayList<>();
        int m = a.length, n = b.length, i = 0, j = 0;
        while (i < m && j < n) {
            if (i > 0 && a[i] == a[i - 1]) i++;          // duplicate inside a: skip
            else if (a[i] < b[j]) i++;                   // a[i] is too small to be in b from here on
            else if (a[i] > b[j]) j++;                   // b[j] is too small
            else { res.add(a[i]); i++; j++; }            // common value
        }
        return res;
    }

    static void show(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        show(intersection(new int[]{3, 5, 10, 10, 10, 10, 15, 15, 20}, new int[]{5, 10, 10, 15, 30}));
        show(intersection(new int[]{1, 2, 2, 3, 3, 3}, new int[]{2, 2, 3, 4}));
    }
}
```

```javascript filename:JavaScript
function intersection(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if (i > 0 && a[i] === a[i - 1]) i++;             // duplicate inside a: skip
        else if (a[i] < b[j]) i++;                       // a[i] is too small to be in b from here on
        else if (a[i] > b[j]) j++;                       // b[j] is too small
        else { res.push(a[i]); i++; j++; }               // common value
    }
    return res;
}

console.log(intersection([3, 5, 10, 10, 10, 10, 15, 15, 20], [5, 10, 10, 15, 30]).join(" "));
console.log(intersection([1, 2, 2, 3, 3, 3], [2, 2, 3, 4]).join(" "));
```

```text filename:Output
5 10 15
2 3
```

Time O(m + n) · Space O(min(m, n)) for the result

> [!NOTE] Key point
>
> Union and intersection on <strong>unsorted</strong> arrays: put one array in a hash set and scan the other — `O(m + n)` expected time, `O(m)` space. Sorting first costs `O(n log n)` but needs no extra memory and keeps the output sorted.

# Count inversions

> [!INFO]
>
> <strong>Inversion</strong> — a pair of indices `i < j` with `arr[i] > arr[j]` — two elements that are in the wrong order relative to each other. A sorted array has 0 inversions; a reverse-sorted one has `n(n − 1) / 2`. The count measures <em>how unsorted</em> an array is.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 4, 1, 3, 5]`<br><strong>Output:</strong> `3 — the pairs (2,1), (4,1), (4,3)`<br><strong>Input:</strong> `arr = [5, 4, 3, 2, 1]`<br><strong>Output:</strong> `10`

Naive: check every pair — `O(n²)`.

```python filename:Python
def count_inversions_naive(arr):
    n = len(arr)
    count = 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            if arr[i] > arr[j]:
                count += 1
    return count

print(count_inversions_naive([2, 4, 1, 3, 5]), count_inversions_naive([2, 4, 1, 3, 5, 2]))
```

```text filename:Output
3 6
```

> [!NOTE] Idea
>
> Piggy-back on <strong>merge sort</strong>. Split the array at `mid`; every inversion `(x, y)` has both elements in the left half, both in the right half, or `x` on the left and `y` on the right. The first two kinds are counted by the recursive calls. The third kind is counted <em>during the merge</em>: when `right[j]` is taken before `left[i]`, it is smaller than `left[i]` <strong>and every element after it</strong> in the sorted left half — that is `len(left) − i` inversions at once.

```text filename:Cross%20inversions%20are%20counted%20in%20bulk%20while%20merging
merge  left = [2 4]   right = [1 3 5]
       take 1 from right  → 1 < every remaining left element (2, 4)   → +2 inversions
       take 2 from left
       take 3 from right  → 3 < remaining left (4)                   → +1 inversion
       take 4, 5                                                      total: 3
```

```python filename:Python
def count_merge(arr, low, mid, high):
    left, right = arr[low:mid + 1], arr[mid + 1:high + 1]
    count = 0
    i = j = 0
    k = low
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            arr[k] = left[i]; i += 1
        else:
            arr[k] = right[j]; j += 1
            count += len(left) - i          # right[j] is smaller than all remaining left elements
        k += 1
    while i < len(left):
        arr[k] = left[i]; i += 1; k += 1
    while j < len(right):
        arr[k] = right[j]; j += 1; k += 1
    return count

def count_inversions(arr, low, high):
    count = 0
    if low < high:
        mid = low + (high - low) // 2
        count += count_inversions(arr, low, mid)        # both in the left half
        count += count_inversions(arr, mid + 1, high)   # both in the right half
        count += count_merge(arr, low, mid, high)       # one in each half
    return count

for arr in ([2, 4, 1, 3, 5], [2, 4, 1, 3, 5, 2], [5, 4, 3, 2, 1], [1, 2, 3, 4, 5]):
    label = "[" + " ".join(map(str, arr)) + "]"
    print(f"{label}:", count_inversions(arr, 0, len(arr) - 1))    # note: arr ends up sorted
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

long long countMerge(vector<int>& arr, int low, int mid, int high) {
    vector<int> left(arr.begin() + low, arr.begin() + mid + 1);
    vector<int> right(arr.begin() + mid + 1, arr.begin() + high + 1);
    int nl = left.size(), nr = right.size(), i = 0, j = 0, k = low;
    long long count = 0;
    while (i < nl && j < nr) {
        if (left[i] <= right[j]) arr[k++] = left[i++];
        else { arr[k++] = right[j++]; count += nl - i; }   // right[j] < all remaining left elements
    }
    while (i < nl) arr[k++] = left[i++];
    while (j < nr) arr[k++] = right[j++];
    return count;
}

long long countInversions(vector<int>& arr, int low, int high) {
    long long count = 0;
    if (low < high) {
        int mid = low + (high - low) / 2;
        count += countInversions(arr, low, mid);          // both in the left half
        count += countInversions(arr, mid + 1, high);     // both in the right half
        count += countMerge(arr, low, mid, high);         // one in each half
    }
    return count;
}

int main() {
    vector<vector<int>> tests = {{2, 4, 1, 3, 5}, {2, 4, 1, 3, 5, 2}, {5, 4, 3, 2, 1}, {1, 2, 3, 4, 5}};
    for (auto& arr : tests) {
        cout << "[";
        for (size_t k = 0; k < arr.size(); k++) cout << (k ? " " : "") << arr[k];
        cout << "]: " << countInversions(arr, 0, (int)arr.size() - 1) << "\n";   // arr ends up sorted
    }
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static long countMerge(int[] arr, int low, int mid, int high) {
        int[] left = Arrays.copyOfRange(arr, low, mid + 1);
        int[] right = Arrays.copyOfRange(arr, mid + 1, high + 1);
        int i = 0, j = 0, k = low;
        long count = 0;
        while (i < left.length && j < right.length) {
            if (left[i] <= right[j]) arr[k++] = left[i++];
            else { arr[k++] = right[j++]; count += left.length - i; }   // right[j] < all remaining left
        }
        while (i < left.length) arr[k++] = left[i++];
        while (j < right.length) arr[k++] = right[j++];
        return count;
    }

    static long countInversions(int[] arr, int low, int high) {
        long count = 0;
        if (low < high) {
            int mid = low + (high - low) / 2;
            count += countInversions(arr, low, mid);          // both in the left half
            count += countInversions(arr, mid + 1, high);     // both in the right half
            count += countMerge(arr, low, mid, high);         // one in each half
        }
        return count;
    }

    public static void main(String[] args) {
        int[][] tests = {{2, 4, 1, 3, 5}, {2, 4, 1, 3, 5, 2}, {5, 4, 3, 2, 1}, {1, 2, 3, 4, 5}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder("[");
            for (int k = 0; k < arr.length; k++) sb.append(k > 0 ? " " : "").append(arr[k]);
            System.out.println(sb + "]: " + countInversions(arr, 0, arr.length - 1));   // arr ends up sorted
        }
    }
}
```

```javascript filename:JavaScript
function countMerge(arr, low, mid, high) {
    const left = arr.slice(low, mid + 1), right = arr.slice(mid + 1, high + 1);
    let i = 0, j = 0, k = low, count = 0;
    while (i < left.length && j < right.length) {
        if (left[i] <= right[j]) arr[k++] = left[i++];
        else { arr[k++] = right[j++]; count += left.length - i; }   // right[j] < all remaining left
    }
    while (i < left.length) arr[k++] = left[i++];
    while (j < right.length) arr[k++] = right[j++];
    return count;
}

function countInversions(arr, low, high) {
    let count = 0;
    if (low < high) {
        const mid = low + Math.floor((high - low) / 2);
        count += countInversions(arr, low, mid);          // both in the left half
        count += countInversions(arr, mid + 1, high);     // both in the right half
        count += countMerge(arr, low, mid, high);         // one in each half
    }
    return count;
}

for (const arr of [[2, 4, 1, 3, 5], [2, 4, 1, 3, 5, 2], [5, 4, 3, 2, 1], [1, 2, 3, 4, 5]]) {
    const label = "[" + arr.join(" ") + "]";
    console.log(`${label}:`, countInversions(arr, 0, arr.length - 1));   // arr ends up sorted
}
```

```text filename:Output
[2 4 1 3 5]: 3
[2 4 1 3 5 2]: 6
[5 4 3 2 1]: 10
[1 2 3 4 5]: 0
```

Time O(n log n) · Space O(n)

> [!WARNING] Pitfall
>
> Use `<=` when comparing `left[i]` with `right[j]`: equal elements are <strong>not</strong> an inversion (`arr[i] > arr[j]` is strict), so a tie must take the left element without counting. The count can reach `n(n − 1) / 2 ≈ 5 × 10¹⁷` for `n = 10⁹` — use a 64-bit integer in C++/Java.

# Partition around a pivot

> [!INFO]
>
> <strong>Partition</strong> — rearranging `arr[low..high]` around a chosen <strong>pivot</strong> value so that everything `≤ pivot` comes before everything `> pivot`, and returning the boundary. It is the heart of quick sort: after partitioning, the pivot is in its final sorted position and the two sides can be sorted independently.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 8, 6, 12, 10, 7], pivot = arr[5] = 7`<br><strong>Output:</strong> `3 6 7 8 12 10 (any order inside each side is valid)`

Naive, <strong>stable</strong> partition: move the pivot to the end, copy the `≤ pivot` elements and then the `> pivot` elements into a temporary array, copy back — `O(n)` time but `O(n)` extra space.

```python filename:Python
def partition_naive(arr, p):
    n = len(arr)
    arr[p], arr[n - 1] = arr[n - 1], arr[p]       # pivot goes to the end
    pivot = arr[n - 1]
    temp = [x for x in arr if x <= pivot]          # smaller-or-equal first (includes the pivot) ...
    temp += [x for x in arr if x > pivot]          # ... then the larger ones; order inside each part kept
    arr[:] = temp
    return len([x for x in arr if x <= pivot]) - 1   # index of the pivot

arr = [3, 8, 6, 12, 10, 7]
print("pivot index:", partition_naive(arr, 5))
print(*arr)
```

```text filename:Output
pivot index: 2
3 6 7 8 12 10
```

The two in-place schemes below do it in `O(1)` extra space. Both are <strong>unstable</strong>.

# Lomuto partition

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 80, 30, 90, 40, 50, 70], pivot = arr[high] = 70`<br><strong>Output:</strong> `pivot index 4, arr = 10 30 40 50 70 90 80`

> [!NOTE] Idea
>
> Pivot is the <strong>last</strong> element. Keep an index `i` marking the end of the `≤ pivot` zone (initially `low − 1`). Scan `j` from `low` to `high − 1`: whenever `arr[j] ≤ pivot`, grow the zone (`i++`) and swap `arr[j]` into it. Finally swap the pivot into position `i + 1` — it is now exactly between the two zones, so it <strong>is guaranteed to be in its final place</strong>.

```text filename:Lomuto%3A%20the%20%E2%89%A4%20zone%20grows%20from%20the%20left%3B%20the%20pivot%20lands%20at%20i%20%2B%201
pivot = 70       zone of <= pivot | zone of > pivot | unscanned
start   i=-1     [10 80 30 90 40 50 | 70]
j=0 10<=70  i=0  [10 | 80 30 90 40 50 | 70]
j=1 80 > 70      [10 | 80 30 90 40 50 | 70]
j=2 30<=70  i=1  [10 30 | 80 90 40 50 | 70]      swap arr[1], arr[2]
j=3 90 > 70      [10 30 | 80 90 40 50 | 70]
j=4 40<=70  i=2  [10 30 40 | 90 80 50 | 70]      swap arr[2], arr[4]
j=5 50<=70  i=3  [10 30 40 50 | 80 90 | 70]      swap arr[3], arr[5]
end: swap pivot into i+1 = 4  →  [10 30 40 50 | 70 | 90 80]
```

```python filename:Python
def lomuto_partition(arr, low, high):
    pivot = arr[high]                         # last element is the pivot
    i = low - 1                               # end of the "<= pivot" zone
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]   # pull arr[j] into the zone
    arr[i + 1], arr[high] = arr[high], arr[i + 1]   # pivot goes between the zones
    return i + 1

arr = [10, 80, 30, 90, 40, 50, 70]
print("before:", *arr)
print("pivot index:", lomuto_partition(arr, 0, len(arr) - 1))
print("after:", *arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

int lomutoPartition(vector<int>& arr, int low, int high) {
    int pivot = arr[high];                        // last element is the pivot
    int i = low - 1;                              // end of the "<= pivot" zone
    for (int j = low; j < high; j++) {
        if (arr[j] <= pivot) swap(arr[++i], arr[j]);   // pull arr[j] into the zone
    }
    swap(arr[i + 1], arr[high]);                  // pivot goes between the zones
    return i + 1;
}

void show(const char* label, const vector<int>& v) {
    cout << label;
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    vector<int> arr = {10, 80, 30, 90, 40, 50, 70};
    show("before:", arr);
    cout << "pivot index: " << lomutoPartition(arr, 0, (int)arr.size() - 1) << "\n";
    show("after:", arr);
}
```

```java filename:Java
public class Main {
    static int lomutoPartition(int[] arr, int low, int high) {
        int pivot = arr[high];                        // last element is the pivot
        int i = low - 1;                              // end of the "<= pivot" zone
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                int t = arr[i]; arr[i] = arr[j]; arr[j] = t;   // pull arr[j] into the zone
            }
        }
        int t = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = t;   // pivot between the zones
        return i + 1;
    }

    static String join(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(' ').append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        int[] arr = {10, 80, 30, 90, 40, 50, 70};
        System.out.println("before:" + join(arr));
        System.out.println("pivot index: " + lomutoPartition(arr, 0, arr.length - 1));
        System.out.println("after:" + join(arr));
    }
}
```

```javascript filename:JavaScript
function lomutoPartition(arr, low, high) {
    const pivot = arr[high];                          // last element is the pivot
    let i = low - 1;                                  // end of the "<= pivot" zone
    for (let j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]];      // pull arr[j] into the zone
        }
    }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];   // pivot goes between the zones
    return i + 1;
}

const arr = [10, 80, 30, 90, 40, 50, 70];
console.log("before:", arr.join(" "));
console.log("pivot index:", lomutoPartition(arr, 0, arr.length - 1));
console.log("after:", arr.join(" "));
```

```text filename:Output
before: 10 80 30 90 40 50 70
pivot index: 4
after: 10 30 40 50 70 90 80
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> Lomuto returns the pivot's <strong>final index</strong> — quick sort then recurses on `[low..p−1]` and `[p+1..high]`, never touching `p` again. To use a different pivot (random, median-of-three), swap it to `arr[high]` first.

# Hoare partition

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 80, 30, 90, 40, 50, 70, 100, 120, 10, 5], pivot = arr[low] = 10`<br><strong>Output:</strong> `returns 1, arr = 5 10 30 90 40 50 70 100 120 80 10`

> [!NOTE] Idea
>
> Pivot is the <strong>first</strong> element. Two indices walk towards each other: `i` from the left stops at an element `≥ pivot`, `j` from the right stops at one `≤ pivot`. If they have not crossed, swap and continue; once `i ≥ j`, return `j`. Everything in `[low..j]` is `≤ pivot` and everything in `[j+1..high]` is `≥ pivot` — but the pivot itself can be <strong>anywhere in the left part</strong>, so quick sort must recurse on `[low..j]` and `[j+1..high]`, not skip `j`.

```python filename:Python
def hoare_partition(arr, low, high):
    pivot = arr[low]                     # first element is the pivot
    i, j = low - 1, high + 1
    while True:
        i += 1
        while arr[i] < pivot:            # stop at something >= pivot
            i += 1
        j -= 1
        while arr[j] > pivot:            # stop at something <= pivot
            j -= 1
        if i >= j:                       # crossed: [low..j] <= pivot <= [j+1..high]
            return j
        arr[i], arr[j] = arr[j], arr[i]

arr = [10, 80, 30, 90, 40, 50, 70, 100, 120, 10, 5]
print("before:", *arr)
print("returned:", hoare_partition(arr, 0, len(arr) - 1))
print("after:", *arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

int hoarePartition(vector<int>& arr, int low, int high) {
    int pivot = arr[low];                    // first element is the pivot
    int i = low - 1, j = high + 1;
    while (true) {
        do { i++; } while (arr[i] < pivot);  // stop at something >= pivot
        do { j--; } while (arr[j] > pivot);  // stop at something <= pivot
        if (i >= j) return j;                // crossed: [low..j] <= pivot <= [j+1..high]
        swap(arr[i], arr[j]);
    }
}

void show(const char* label, const vector<int>& v) {
    cout << label;
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    vector<int> arr = {10, 80, 30, 90, 40, 50, 70, 100, 120, 10, 5};
    show("before:", arr);
    cout << "returned: " << hoarePartition(arr, 0, (int)arr.size() - 1) << "\n";
    show("after:", arr);
}
```

```java filename:Java
public class Main {
    static int hoarePartition(int[] arr, int low, int high) {
        int pivot = arr[low];                    // first element is the pivot
        int i = low - 1, j = high + 1;
        while (true) {
            do { i++; } while (arr[i] < pivot);  // stop at something >= pivot
            do { j--; } while (arr[j] > pivot);  // stop at something <= pivot
            if (i >= j) return j;                // crossed: [low..j] <= pivot <= [j+1..high]
            int t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
    }

    static String join(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(' ').append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        int[] arr = {10, 80, 30, 90, 40, 50, 70, 100, 120, 10, 5};
        System.out.println("before:" + join(arr));
        System.out.println("returned: " + hoarePartition(arr, 0, arr.length - 1));
        System.out.println("after:" + join(arr));
    }
}
```

```javascript filename:JavaScript
function hoarePartition(arr, low, high) {
    const pivot = arr[low];                      // first element is the pivot
    let i = low - 1, j = high + 1;
    while (true) {
        do { i++; } while (arr[i] < pivot);      // stop at something >= pivot
        do { j--; } while (arr[j] > pivot);      // stop at something <= pivot
        if (i >= j) return j;                    // crossed: [low..j] <= pivot <= [j+1..high]
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

const arr = [10, 80, 30, 90, 40, 50, 70, 100, 120, 10, 5];
console.log("before:", arr.join(" "));
console.log("returned:", hoarePartition(arr, 0, arr.length - 1));
console.log("after:", arr.join(" "));
```

```text filename:Output
before: 10 80 30 90 40 50 70 100 120 10 5
returned: 1
after: 5 10 30 90 40 50 70 100 120 80 10
```

Time O(n) · Space O(1)

|  | Lomuto | Hoare |
| --- | --- | --- |
| Pivot | last element `arr[high]` | first element `arr[low]` |
| Returns | the pivot's final index `p` | a boundary `j`; the pivot is somewhere in `[low..j]` |
| Quick sort recursion | `[low..p−1]` and `[p+1..high]` | `[low..j]` and `[j+1..high]` |
| Swaps | about `n/2` on average | about `n/6` — roughly three times fewer |
| All-equal input | degenerates: every element goes left → `O(n²)` | splits in the middle → stays `O(n log n)` |
| Simplicity | easier to get right | the stop conditions and the `i >= j` test are easy to get wrong |

> [!WARNING] Pitfall
>
> With Hoare, recursing on `[low..j−1]` and `[j+1..high]` (as for Lomuto) loses the element at `j`, which is <strong>not</strong> necessarily the pivot. And the inner loops must use strict `<` / `>` — with `<=` they can run off the ends of the array.

# Quick sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 80, 30, 90, 40, 50, 70]`<br><strong>Output:</strong> `10 30 40 50 70 80 90`<br><strong>Input:</strong> `arr = [3, 5, 6, 7, 1, 2, 4]`<br><strong>Output:</strong> `1 2 3 4 5 6 7`

> [!NOTE] Idea
>
> <strong>Divide and conquer</strong> where the work is in the <em>divide</em>: partition the array around a pivot, then sort the two sides recursively. There is no merge step — once both sides are sorted, the whole array is, because every left element `≤` pivot `≤` every right element.

```text filename:Each%20partition%20fixes%20the%20pivot%3B%20the%20sides%20are%20sorted%20independently
[3 5 6 7 1 2 4]   pivot 4 (Lomuto, last)
       ↓ partition
[3 1 2] 4 [5 6 7]          4 is final
  ↓            ↓
[1] 2 [3]    [5 6] 7        2 and 7 are final
               ↓
             [5] 6          6 is final
result: 1 2 3 4 5 6 7
```

```python filename:Python
def lomuto_partition(arr, low, high):
    pivot, i = arr[high], low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

def hoare_partition(arr, low, high):
    pivot, i, j = arr[low], low - 1, high + 1
    while True:
        i += 1
        while arr[i] < pivot: i += 1
        j -= 1
        while arr[j] > pivot: j -= 1
        if i >= j: return j
        arr[i], arr[j] = arr[j], arr[i]

def quick_sort_lomuto(arr, low, high):
    if low < high:
        p = lomuto_partition(arr, low, high)
        quick_sort_lomuto(arr, low, p - 1)      # pivot at p is final: skip it
        quick_sort_lomuto(arr, p + 1, high)

def quick_sort_hoare(arr, low, high):
    if low < high:
        p = hoare_partition(arr, low, high)
        quick_sort_hoare(arr, low, p)           # p is a boundary, not the pivot: include it
        quick_sort_hoare(arr, p + 1, high)

for arr in ([10, 80, 30, 90, 40, 50, 70], [3, 5, 6, 7, 1, 2, 4]):
    a, b = arr[:], arr[:]
    quick_sort_lomuto(a, 0, len(a) - 1)
    quick_sort_hoare(b, 0, len(b) - 1)
    print("lomuto:", *a)
    print("hoare:", *b)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

int lomutoPartition(vector<int>& arr, int low, int high) {
    int pivot = arr[high], i = low - 1;
    for (int j = low; j < high; j++)
        if (arr[j] <= pivot) swap(arr[++i], arr[j]);
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

int hoarePartition(vector<int>& arr, int low, int high) {
    int pivot = arr[low], i = low - 1, j = high + 1;
    while (true) {
        do { i++; } while (arr[i] < pivot);
        do { j--; } while (arr[j] > pivot);
        if (i >= j) return j;
        swap(arr[i], arr[j]);
    }
}

void quickSortLomuto(vector<int>& arr, int low, int high) {
    if (low < high) {
        int p = lomutoPartition(arr, low, high);
        quickSortLomuto(arr, low, p - 1);        // pivot at p is final: skip it
        quickSortLomuto(arr, p + 1, high);
    }
}

void quickSortHoare(vector<int>& arr, int low, int high) {
    if (low < high) {
        int p = hoarePartition(arr, low, high);
        quickSortHoare(arr, low, p);             // p is a boundary, not the pivot: include it
        quickSortHoare(arr, p + 1, high);
    }
}

void show(const char* label, const vector<int>& v) {
    cout << label;
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    vector<vector<int>> tests = {{10, 80, 30, 90, 40, 50, 70}, {3, 5, 6, 7, 1, 2, 4}};
    for (const auto& arr : tests) {
        vector<int> a = arr, b = arr;
        quickSortLomuto(a, 0, (int)a.size() - 1);
        quickSortHoare(b, 0, (int)b.size() - 1);
        show("lomuto:", a);
        show("hoare:", b);
    }
}
```

```java filename:Java
public class Main {
    static int lomutoPartition(int[] arr, int low, int high) {
        int pivot = arr[high], i = low - 1;
        for (int j = low; j < high; j++)
            if (arr[j] <= pivot) { i++; int t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        int t = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = t;
        return i + 1;
    }

    static int hoarePartition(int[] arr, int low, int high) {
        int pivot = arr[low], i = low - 1, j = high + 1;
        while (true) {
            do { i++; } while (arr[i] < pivot);
            do { j--; } while (arr[j] > pivot);
            if (i >= j) return j;
            int t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
    }

    static void quickSortLomuto(int[] arr, int low, int high) {
        if (low < high) {
            int p = lomutoPartition(arr, low, high);
            quickSortLomuto(arr, low, p - 1);        // pivot at p is final: skip it
            quickSortLomuto(arr, p + 1, high);
        }
    }

    static void quickSortHoare(int[] arr, int low, int high) {
        if (low < high) {
            int p = hoarePartition(arr, low, high);
            quickSortHoare(arr, low, p);             // p is a boundary, not the pivot: include it
            quickSortHoare(arr, p + 1, high);
        }
    }

    static String join(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(' ').append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        int[][] tests = {{10, 80, 30, 90, 40, 50, 70}, {3, 5, 6, 7, 1, 2, 4}};
        for (int[] arr : tests) {
            int[] a = arr.clone(), b = arr.clone();
            quickSortLomuto(a, 0, a.length - 1);
            quickSortHoare(b, 0, b.length - 1);
            System.out.println("lomuto:" + join(a));
            System.out.println("hoare:" + join(b));
        }
    }
}
```

```javascript filename:JavaScript
function lomutoPartition(arr, low, high) {
    const pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++)
        if (arr[j] <= pivot) { i++; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    return i + 1;
}

function hoarePartition(arr, low, high) {
    const pivot = arr[low];
    let i = low - 1, j = high + 1;
    while (true) {
        do { i++; } while (arr[i] < pivot);
        do { j--; } while (arr[j] > pivot);
        if (i >= j) return j;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function quickSortLomuto(arr, low, high) {
    if (low < high) {
        const p = lomutoPartition(arr, low, high);
        quickSortLomuto(arr, low, p - 1);            // pivot at p is final: skip it
        quickSortLomuto(arr, p + 1, high);
    }
}

function quickSortHoare(arr, low, high) {
    if (low < high) {
        const p = hoarePartition(arr, low, high);
        quickSortHoare(arr, low, p);                 // p is a boundary, not the pivot: include it
        quickSortHoare(arr, p + 1, high);
    }
}

for (const arr of [[10, 80, 30, 90, 40, 50, 70], [3, 5, 6, 7, 1, 2, 4]]) {
    const a = [...arr], b = [...arr];
    quickSortLomuto(a, 0, a.length - 1);
    quickSortHoare(b, 0, b.length - 1);
    console.log("lomuto:", a.join(" "));
    console.log("hoare:", b.join(" "));
}
```

```text filename:Output
lomuto: 10 30 40 50 70 80 90
hoare: 10 30 40 50 70 80 90
lomuto: 1 2 3 4 5 6 7
hoare: 1 2 3 4 5 6 7
```

Time O(n log n) average · O(n²) worst · Space O(log n) stack on average

# Analysis of quick sort

| Case | When | Recurrence | Time |
| --- | --- | --- | --- |
| Best | every partition splits in half | `T(n) = 2T(n/2) + Θ(n)` | `Θ(n log n)` |
| Average | random pivots / random input | `T(n) = T(n/4) + T(3n/4) + Θ(n)` (a typical uneven split) | `Θ(n log n)` — about `1.39 n log2 n` comparisons |
| Worst | the pivot is always the min or max — sorted input with first/last pivot, or all equal values with Lomuto | `T(n) = T(n − 1) + Θ(n)` | `Θ(n²)` |
| Space | recursion depth | `O(log n)` average; `O(n)` in the worst case unless the smaller side is recursed first |  |

Despite the `O(n²)` worst case, quick sort is usually the fastest comparison sort in practice:

> [!NOTE] In-place
>
> Partition needs `O(1)` extra memory; merge sort needs an `O(n)` buffer.

> [!NOTE] Cache-friendly
>
> Partition sweeps the array sequentially; heap sort jumps around and misses the cache.

> [!NOTE] Small constants
>
> The inner loop is a compare and an occasional swap — less work per element than merge sort's copying.

> [!NOTE] Tail recursion
>
> The second recursive call can become a loop; recursing on the <em>smaller</em> side first bounds the stack at `O(log n)`.

> [!NOTE] Worst case is avoidable
>
> A random pivot (or median-of-three) makes the `O(n²)` case astronomically unlikely; introsort falls back to heap sort if the depth gets too large.

> [!NOTE] Not stable
>
> Both in-place partitions move elements across the range, so equal keys can swap order. Use merge sort / Timsort when stability matters.

> [!WARNING] Pitfall
>
> Three statements in the original notes were wrong: the <em>best</em> case is `Θ(n log n)`, not `Θ(log n)` — you cannot sort without looking at every element; the space complexity is `O(log n)` on average (recursion depth), not `Θ(n)`; and Hoare's partition is not "three times faster" overall — it does about <strong>three times fewer swaps</strong> on average, which makes it somewhat faster. Hoare also handles many equal keys gracefully, while Lomuto degrades to `O(n²)` on them.

> [!NOTE] Key point
>
> `std::sort` in C++ is <strong>introsort</strong>: quick sort with median-of-three pivots, switching to heap sort when the recursion depth exceeds `2 log n` and to insertion sort for ranges of ≈ 16 elements. Java sorts primitives with a dual-pivot quick sort. Both are `O(n log n)` worst case in practice.

# Heap sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [4, 10, 3, 5, 1, 12, 7]`<br><strong>Output:</strong> `1 3 4 5 7 10 12`

> [!NOTE] Idea
>
> Selection sort finds the maximum in `O(n)` per pass; a <strong>max-heap</strong> finds it in `O(1)` and restores itself in `O(log n)`. So: build a max-heap from the array in place, then repeatedly swap the root (the maximum) with the last element of the heap, shrink the heap by one and <em>heapify</em> the new root down. The sorted elements accumulate at the end of the array.

```text filename:A%20max-heap%20stored%20in%20an%20array%3B%20sorting%20pulls%20the%20root%20out%20one%20at%20a%20time
array [12 10 7 5 1 3 4] as a max-heap:      children of i are 2i+1 and 2i+2

              12 (0)
            /        \
       10 (1)         7 (2)
      /     \        /    \
   5 (3)   1 (4)   3 (5)  4 (6)

swap root 12 with last (4)  →  [4 10 7 5 1 3 | 12]   heapify 4 down over the first 6
```

1. <strong>heapify(i)</strong>

   Compare node `i` with its children; swap with the larger child if it is bigger, and continue down. `O(log n)`.

2. <strong>build heap</strong>

   Call `heapify` on every internal node from the last one (`n/2 − 1`) down to the root. Leaves are already heaps. This takes `O(n)` in total, not `O(n log n)`.

3. <strong>extract</strong>

   For `i = n − 1 … 1`: swap `arr[0]` (the max) with `arr[i]`, then `heapify(0)` on the heap of size `i`. Each extraction is `O(log n)`.

```python filename:Python
def heapify(arr, n, i):
    largest = i
    left, right = 2 * i + 1, 2 * i + 2
    if left < n and arr[left] > arr[largest]:
        largest = left
    if right < n and arr[right] > arr[largest]:
        largest = right
    if largest != i:
        arr[i], arr[largest] = arr[largest], arr[i]
        heapify(arr, n, largest)                 # keep sinking the displaced value

def build_heap(arr):
    n = len(arr)
    for i in range(n // 2 - 1, -1, -1):          # internal nodes, bottom-up
        heapify(arr, n, i)

def heap_sort(arr):
    n = len(arr)
    build_heap(arr)
    print("max-heap:", *arr)
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]          # max goes to the end
        heapify(arr, i, 0)                       # restore the heap of size i

for arr in ([4, 10, 3, 5, 1, 12, 7], [50, 20, 10, 4, 15]):
    heap_sort(arr)
    print("sorted:", *arr)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

void heapify(vector<int>& arr, int n, int i) {
    int largest = i, left = 2 * i + 1, right = 2 * i + 2;
    if (left < n && arr[left] > arr[largest]) largest = left;
    if (right < n && arr[right] > arr[largest]) largest = right;
    if (largest != i) {
        swap(arr[i], arr[largest]);
        heapify(arr, n, largest);                // keep sinking the displaced value
    }
}

void show(const char* label, const vector<int>& v) {
    cout << label;
    for (int x : v) cout << " " << x;
    cout << "\n";
}

void heapSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);   // build heap, bottom-up
    show("max-heap:", arr);
    for (int i = n - 1; i > 0; i--) {
        swap(arr[0], arr[i]);                    // max goes to the end
        heapify(arr, i, 0);                      // restore the heap of size i
    }
}

int main() {
    vector<vector<int>> tests = {{4, 10, 3, 5, 1, 12, 7}, {50, 20, 10, 4, 15}};
    for (auto& arr : tests) {
        heapSort(arr);
        show("sorted:", arr);
    }
}
```

```java filename:Java
public class Main {
    static void heapify(int[] arr, int n, int i) {
        int largest = i, left = 2 * i + 1, right = 2 * i + 2;
        if (left < n && arr[left] > arr[largest]) largest = left;
        if (right < n && arr[right] > arr[largest]) largest = right;
        if (largest != i) {
            int t = arr[i]; arr[i] = arr[largest]; arr[largest] = t;
            heapify(arr, n, largest);            // keep sinking the displaced value
        }
    }

    static String join(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int x : a) sb.append(' ').append(x);
        return sb.toString();
    }

    static void heapSort(int[] arr) {
        int n = arr.length;
        for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);   // build heap, bottom-up
        System.out.println("max-heap:" + join(arr));
        for (int i = n - 1; i > 0; i--) {
            int t = arr[0]; arr[0] = arr[i]; arr[i] = t;   // max goes to the end
            heapify(arr, i, 0);                            // restore the heap of size i
        }
    }

    public static void main(String[] args) {
        int[][] tests = {{4, 10, 3, 5, 1, 12, 7}, {50, 20, 10, 4, 15}};
        for (int[] arr : tests) {
            heapSort(arr);
            System.out.println("sorted:" + join(arr));
        }
    }
}
```

```javascript filename:JavaScript
function heapify(arr, n, i) {
    let largest = i;
    const left = 2 * i + 1, right = 2 * i + 2;
    if (left < n && arr[left] > arr[largest]) largest = left;
    if (right < n && arr[right] > arr[largest]) largest = right;
    if (largest !== i) {
        [arr[i], arr[largest]] = [arr[largest], arr[i]];
        heapify(arr, n, largest);                // keep sinking the displaced value
    }
}

function heapSort(arr) {
    const n = arr.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(arr, n, i);   // build heap, bottom-up
    console.log("max-heap:", arr.join(" "));
    for (let i = n - 1; i > 0; i--) {
        [arr[0], arr[i]] = [arr[i], arr[0]];     // max goes to the end
        heapify(arr, i, 0);                      // restore the heap of size i
    }
}

for (const arr of [[4, 10, 3, 5, 1, 12, 7], [50, 20, 10, 4, 15]]) {
    heapSort(arr);
    console.log("sorted:", arr.join(" "));
}
```

```text filename:Output
max-heap: 12 10 7 5 1 3 4
sorted: 1 3 4 5 7 10 12
max-heap: 50 20 10 4 15
sorted: 4 10 15 20 50
```

Time O(n log n) in every case · Space O(1)

- An optimisation of <strong>selection sort</strong>: the same <em>extract the extreme, shrink the range</em> loop, with an `O(log n)` extraction instead of `O(n)`.
- <strong>Guaranteed</strong> `O(n log n)` and <strong>in-place</strong> — the combination merge sort and quick sort each lack. The price: poor cache locality, so it is slower than quick sort in practice.
- <strong>Not stable</strong>: swapping the root with the last leaf can jump an element over equal keys.
- Used as the fallback inside <strong>introsort</strong> (`std::sort`) and wherever a worst-case guarantee matters. The heap itself is the DSA Basics → Heap topic.

# Interview Q&amp;A

```question
Which sorting algorithm would you pick, and why?

---

For general use, the library sort: Timsort (Python/Java objects/JS) or introsort (`std::sort`). Hand-rolled: quick sort for speed on arrays in memory; merge sort when stability or a guaranteed `n log n` is needed, for linked lists, or for data that does not fit in memory; heap sort when memory is tight and the worst case must be bounded; insertion sort for tiny or nearly sorted inputs; counting/radix sort when keys are small integers.
```

```question
What does stable mean, and which algorithms are stable?

---

Equal keys keep their input order. Stable: bubble, insertion, merge, Timsort, counting sort. Not stable: selection, quick, heap, `std::sort`. It matters for multi-key sorts (sort by name, then stably by marks) and for sorting records by one field while keeping a meaningful prior order.
```

```question
Why is quick sort faster than merge sort in practice if both are O(n log n)?

---

Quick sort partitions in place with a tight inner loop and sequential memory access; merge sort copies every element into a buffer at every level. Quick sort does more comparisons on average (`≈ 1.39 n log n` vs `n log n`) but fewer memory moves and far fewer cache misses. Merge sort wins on linked lists, on stability, and when a worst-case guarantee is required.
```

```question
When does quick sort degrade to O(n²), and how do you prevent it?

---

When every partition is maximally unbalanced: already sorted or reverse-sorted input with a first/last pivot, or many equal keys with Lomuto. Fixes: choose a random pivot or the median of three, use Hoare or three-way (Dutch flag) partitioning for duplicates, recurse on the smaller side first to cap the stack, and switch to heap sort if the depth exceeds `2 log n` (introsort).
```

```question
Can you sort in better than O(n log n)?

---

Not by comparing: a comparison sort must distinguish `n!` permutations, which needs `log2(n!) = Θ(n log n)` comparisons. Non-comparison sorts use the structure of the keys: counting sort is `O(n + k)` for integers in `0..k`, radix sort `O(d(n + k))` for `d`-digit keys, bucket sort for uniformly distributed reals.
```

```question
What is the difference between sort() and sorted() in Python?

---

`list.sort()` sorts the list in place and returns `None`; `sorted(iterable)` accepts any iterable and returns a new list, leaving the input untouched. Both are Timsort, stable, and take the same `key=` and `reverse=` arguments.
```

```question
Why does \[10, 9, 1\].sort() give \[1, 10, 9\] in JavaScript?

---

Without a comparator, `Array.prototype.sort` converts elements to strings and compares them lexicographically: `"10" < "9"` because `"1" < "9"`. Always pass `(a, b) => a - b` for numbers.
```

```question
How many swaps does selection sort make, and why is that interesting?

---

At most `n − 1` — one per pass — regardless of input, versus `O(n²)` for bubble sort and `O(n²)` shifts for insertion sort. On media where writes are expensive (flash) that can matter; cycle sort takes the idea to its limit with the minimum possible number of writes.
```
