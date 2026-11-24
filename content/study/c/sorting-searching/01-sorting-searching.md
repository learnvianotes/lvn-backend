---
id: 3afd26fb-b9b9-7819-9104-48ef51f4d22a
key: topic:c/sorting-searching
subject: c
topic: sorting-searching
title: Sorting & Searching
slug: sorting-searching
order: 1
---

The classic algorithms, implemented on plain `int` arrays. Know their complexity, stability and when to reach for the library’s `qsort` / `bsearch` instead.

| Algorithm | Best | Average | Worst | Space | Stable? |
| --- | --- | --- | --- | --- | --- |
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | No |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No |
| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |
| Counting sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes |

# Simple O(n²) sorts

```c filename:C
#include <stdio.h>
#include <stdbool.h>

void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

void bubble_sort(int *a, int n) {
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - i; j++)
            if (a[j] > a[j + 1]) { swap(&a[j], &a[j + 1]); swapped = true; }
        if (!swapped) break;                 /* already sorted: O(n) best case */
    }
}

void selection_sort(int *a, int n) {
    for (int i = 0; i < n - 1; i++) {
        int min = i;
        for (int j = i + 1; j < n; j++) if (a[j] < a[min]) min = j;
        swap(&a[i], &a[min]);
    }
}

void insertion_sort(int *a, int n) {
    for (int i = 1; i < n; i++) {
        int key = a[i], j = i - 1;
        while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
        a[j + 1] = key;
    }
}

void print(const int *a, int n) { for (int i = 0; i < n; i++) printf("%d ", a[i]); printf("\n"); }

int main(void) {
    int a[] = {5, 2, 9, 1, 5, 6}, b[] = {5, 2, 9, 1, 5, 6}, c[] = {5, 2, 9, 1, 5, 6};
    bubble_sort(a, 6); print(a, 6);
    selection_sort(b, 6); print(b, 6);
    insertion_sort(c, 6); print(c, 6);
    return 0;
}
```

```text filename:Output
1 2 5 5 6 9
1 2 5 5 6 9
1 2 5 5 6 9
```

# Merge sort and quick sort

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void merge(int *a, int *tmp, int lo, int mid, int hi) {
    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];   /* <= keeps it stable */
    while (i < mid) tmp[k++] = a[i++];
    while (j < hi)  tmp[k++] = a[j++];
    memcpy(a + lo, tmp + lo, (size_t)(hi - lo) * sizeof *a);
}

static void msort(int *a, int *tmp, int lo, int hi) {     /* sorts a[lo, hi) */
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    msort(a, tmp, lo, mid);
    msort(a, tmp, mid, hi);
    merge(a, tmp, lo, mid, hi);
}

void merge_sort(int *a, int n) {
    int *tmp = malloc((size_t)n * sizeof *tmp);
    if (!tmp) return;
    msort(a, tmp, 0, n);
    free(tmp);
}

void quick_sort(int *a, int lo, int hi) {                 /* Lomuto partition, a[lo..hi] */
    if (lo >= hi) return;
    int pivot = a[hi], i = lo;
    for (int j = lo; j < hi; j++)
        if (a[j] < pivot) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; }
    int t = a[i]; a[i] = a[hi]; a[hi] = t;                /* pivot to its final place */
    quick_sort(a, lo, i - 1);
    quick_sort(a, i + 1, hi);
}

int main(void) {
    int a[] = {38, 27, 43, 3, 9, 82, 10}, b[] = {38, 27, 43, 3, 9, 82, 10};
    merge_sort(a, 7);
    quick_sort(b, 0, 6);
    for (int i = 0; i < 7; i++) printf("%d ", a[i]);
    printf("\n");
    for (int i = 0; i < 7; i++) printf("%d ", b[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
3 9 10 27 38 43 82
3 9 10 27 38 43 82
```

# Binary search

```c filename:C
#include <stdio.h>

int binary_search(const int *a, int n, int key) {
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;     /* not (lo + hi) / 2: that can overflow */
        if (a[mid] == key) return mid;
        if (a[mid] < key) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}

int lower_bound(const int *a, int n, int key) {   /* first index with a[i] >= key */
    int lo = 0, hi = n;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < key) lo = mid + 1; else hi = mid;
    }
    return lo;
}

int main(void) {
    int a[] = {2, 5, 8, 8, 8, 13, 21};
    printf("%d %d\n", binary_search(a, 7, 13), binary_search(a, 7, 4));
    printf("first 8 at %d, insert 9 at %d\n", lower_bound(a, 7, 8), lower_bound(a, 7, 9));
    return 0;
}
```

```text filename:Output
5 -1
first 8 at 2, insert 9 at 5
```

> [!NOTE] Key point
>
> In production C, use `qsort` (see Function Pointers) and `bsearch` from `<stdlib.h>`. Write your own when you need stability (merge sort), a specialised key, or an interview asks for it.

```question
Why is quicksort usually faster than merge sort in practice even though its worst case is O(n²)?

---

It sorts in place with a tight inner loop and excellent cache locality, and choosing the pivot randomly or by median-of-three makes the O(n²) case vanishingly unlikely. Merge sort needs O(n) extra memory and more data movement. Library sorts (introsort) switch to heap sort if recursion gets too deep, guaranteeing O(n log n).
```

```question
What does it mean for a sort to be stable?

---

Elements with equal keys keep their original relative order. It matters when sorting records by one field after another (e.g. by name, then stably by department). Merge, insertion and bubble sort are stable; quick, heap and selection sort are not. `qsort` is not guaranteed stable.
```
