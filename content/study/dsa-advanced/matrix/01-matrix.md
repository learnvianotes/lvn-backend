---
id: c7854396-4c09-7906-8205-8e3644d7c0ec
key: topic:dsa-advanced/matrix
subject: dsa-advanced
topic: matrix
title: Matrix
slug: matrix
order: 1
---

A matrix is a 2-D array: a list of rows, each a list of values, addressed as `mat[i][j]`. Matrix problems are mostly about <strong>traversal order</strong> (snake, boundary, spiral), <strong>in-place rearrangement</strong> (transpose, rotate) and <strong>exploiting sortedness</strong> (staircase search, median by binary search on the value range).

> [!INFO]
>
> <strong>Matrix (2-D array)</strong> — `R` rows × `C` columns of elements; `mat[i][j]` is the element in row `i` (`0..R-1`) and column `j` (`0..C-1`). In Python, C++ and Java it is an array of row arrays; in memory the rows are stored one after another (row-major order).

```text filename:Indices%3A%20first%20the%20row%20i%2C%20then%20the%20column%20j
         j=0  j=1  j=2  j=3
       ┌────┬────┬────┬────┐
i=0    │  1 │  2 │  3 │  4 │     R = 3 rows, C = 4 columns
       ├────┼────┼────┼────┤
i=1    │  5 │  6 │  7 │  8 │     mat[1][2] = 7
       ├────┼────┼────┼────┤
i=2    │  9 │ 10 │ 11 │ 12 │     row-major memory: 1 2 3 4 5 6 7 8 9 10 11 12
       └────┴────┴────┴────┘
```

# 2-D arrays in each language

|  | Python | C++ | Java | JavaScript |
| --- | --- | --- | --- | --- |
| Literal | `[[1,2,3],[4,5,6]]` | `vector<vector<int>> m = {{1,2,3},{4,5,6}};` | `int[][] m = {{1,2,3},{4,5,6}};` | `[[1,2,3],[4,5,6]]` |
| Rows | `len(m)` | `m.size()` | `m.length` | `m.length` |
| Columns of row `i` | `len(m[i])` | `m[i].size()` | `m[i].length` | `m[i].length` |
| `R × C` zeros | `[[0]*C for _ in range(R)]` | `vector<vector<int>>(R, vector<int>(C, 0))` | `new int[R][C]` | `Array.from({length: R}, () => Array(C).fill(0))` |
| Pass to a function | by reference (the list object) | `vector<vector<int>>&` | `int[][]` (reference) | by reference |

Rows can have different lengths in all four languages (a <em>jagged</em> array), so always read the column count from the row you are about to use — `len(mat[i])` — not from `mat[0]` unless the matrix is known to be rectangular.

```python filename:Python
def print_matrix(mat):                   # a 2-D list is passed by reference
    for row in mat:
        print(*row)                      # space-separated row

mat = [[1, 2, 3],
       [4, 5, 6]]
print_matrix(mat)
print("rows:", len(mat))
print("cols:", len(mat[0]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void printMatrix(const vector<vector<int>>& mat) {   // pass by reference: no copy
    for (const auto& row : mat) {
        for (int x : row) cout << x << " ";
        cout << "\n";
    }
}

int main() {
    vector<vector<int>> mat = {{1, 2, 3},
                               {4, 5, 6}};
    printMatrix(mat);
    cout << "rows: " << mat.size() << "\n";
    cout << "cols: " << mat[0].size() << "\n";
}
```

```java filename:Java
public class Main {
    static void printMatrix(int[][] mat) {       // arrays are passed by reference
        for (int[] row : mat) {
            StringBuilder sb = new StringBuilder();
            for (int x : row) sb.append(x).append(' ');
            System.out.println(sb.toString().trim());
        }
    }

    public static void main(String[] args) {
        int[][] mat = {{1, 2, 3},
                       {4, 5, 6}};
        printMatrix(mat);
        System.out.println("rows: " + mat.length);
        System.out.println("cols: " + mat[0].length);
    }
}
```

```javascript filename:JavaScript
function printMatrix(mat) {                  // arrays are passed by reference
    for (const row of mat) console.log(row.join(" "));
}

const mat = [[1, 2, 3],
             [4, 5, 6]];
printMatrix(mat);
console.log("rows:", mat.length);
console.log("cols:", mat[0].length);
```

```text filename:Output
1 2 3
4 5 6
rows: 2
cols: 3
```

<strong>User-specified dimensions.</strong> Build an `R × C` matrix of zeros and fill it. The one trap is Python's `[[0] * C] * R`, which repeats the <em>same</em> row object `R` times:

```python filename:Python
rows, cols = 3, 4
bad = [[0] * cols] * rows          # three references to ONE row
bad[0][0] = 1
for r in bad:
    print(*r)                      # the 1 shows up in every row

good = [[0] * cols for _ in range(rows)]   # a fresh row each time
good[0][0] = 1
for r in good:
    print(*r)
```

```text filename:Output
1 0 0 0
1 0 0 0
1 0 0 0
1 0 0 0
0 0 0 0
0 0 0 0
```

```python filename:Python
rows, cols = 3, 4
mat = [[0] * cols for _ in range(rows)]  # R independent rows of C zeros
for i in range(rows):
    for j in range(cols):
        mat[i][j] = i * cols + j + 1     # row-major numbering
for row in mat:
    print(*row)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int rows = 3, cols = 4;
    vector<vector<int>> mat(rows, vector<int>(cols, 0));   // R rows of C zeros
    for (int i = 0; i < rows; i++)
        for (int j = 0; j < cols; j++)
            mat[i][j] = i * cols + j + 1;    // row-major numbering
    for (const auto& row : mat) {
        for (int x : row) cout << x << " ";
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int rows = 3, cols = 4;
        int[][] mat = new int[rows][cols];           // zero-filled
        for (int i = 0; i < rows; i++)
            for (int j = 0; j < cols; j++)
                mat[i][j] = i * cols + j + 1;        // row-major numbering
        for (int[] row : mat) {
            StringBuilder sb = new StringBuilder();
            for (int x : row) sb.append(x).append(' ');
            System.out.println(sb.toString().trim());
        }
    }
}
```

```javascript filename:JavaScript
const rows = 3, cols = 4;
const mat = Array.from({ length: rows }, () => Array(cols).fill(0));   // R independent rows
for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
        mat[i][j] = i * cols + j + 1;            // row-major numbering
for (const row of mat) console.log(row.join(" "));
```

```text filename:Output
1 2 3 4
5 6 7 8
9 10 11 12
```

> [!WARNING] Pitfall
>
> `Array(rows).fill(Array(cols).fill(0))` in JavaScript has the same aliasing bug as Python's `[[0]*C]*R` — every row is the same array. Use `Array.from` with a factory, or a loop that pushes a new row each time.

# Print a matrix in snake pattern

Traverse even-numbered rows left to right and odd-numbered rows right to left, as a snake winds through the grid.

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]`<br><strong>Output:</strong> `1 2 3 6 5 4 7 8 9 12 11 10`

```text filename:Snake%20order%3A%20alternate%20the%20direction%20on%20every%20row
 1 → 2 → 3
         ↓
 6 ← 5 ← 4
 ↓
 7 → 8 → 9
         ↓
12 ← 11 ← 10
```

> [!NOTE] Idea
>
> The row index decides the direction: `i % 2 == 0` → columns `0..C-1`, otherwise `C-1..0`. No extra space is needed.

```python filename:Python
def snake(mat):
    out = []
    for i, row in enumerate(mat):
        if i % 2 == 0:
            out.extend(row)                  # left → right
        else:
            out.extend(reversed(row))        # right → left
    return out

mat = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]
print(*snake(mat))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void snake(const vector<vector<int>>& mat) {
    int R = mat.size();
    for (int i = 0; i < R; i++) {
        int C = mat[i].size();
        if (i % 2 == 0)
            for (int j = 0; j < C; j++) cout << mat[i][j] << " ";        // left → right
        else
            for (int j = C - 1; j >= 0; j--) cout << mat[i][j] << " ";   // right → left
    }
    cout << "\n";
}

int main() {
    snake({{1, 2, 3}, {4, 5, 6}, {7, 8, 9}, {10, 11, 12}});
}
```

```java filename:Java
public class Main {
    static void snake(int[][] mat) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < mat.length; i++) {
            int C = mat[i].length;
            if (i % 2 == 0)
                for (int j = 0; j < C; j++) sb.append(mat[i][j]).append(' ');        // left → right
            else
                for (int j = C - 1; j >= 0; j--) sb.append(mat[i][j]).append(' ');   // right → left
        }
        System.out.println(sb.toString().trim());
    }

    public static void main(String[] args) {
        snake(new int[][]{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}, {10, 11, 12}});
    }
}
```

```javascript filename:JavaScript
function snake(mat) {
    const out = [];
    for (let i = 0; i < mat.length; i++) {
        const C = mat[i].length;
        if (i % 2 === 0)
            for (let j = 0; j < C; j++) out.push(mat[i][j]);        // left → right
        else
            for (let j = C - 1; j >= 0; j--) out.push(mat[i][j]);   // right → left
    }
    return out;
}

console.log(snake([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]).join(" "));
```

```text filename:Output
1 2 3 6 5 4 7 8 9 12 11 10
```

Time O(R · C) · Space O(1)

# Matrix boundary traversal

Print the outer ring clockwise: top row, right column, bottom row (backwards), left column (upwards).

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]`<br><strong>Output:</strong> `1 2 3 4 8 12 11 10 9 5`<br><strong>Input:</strong> `mat = [[1], [2], [3]]`<br><strong>Output:</strong> `1 2 3`<br><strong>Input:</strong> `mat = [[1, 2, 3]]`<br><strong>Output:</strong> `1 2 3`

```text filename:Boundary%20order%20on%20a%203%20%C3%97%204%20matrix
1 → 2 → 3 → 4
↑           ↓
5   6   7   8
↑           ↓
9 ← 10 ← 11 ← 12
```

> [!NOTE] Idea
>
> Walk the four sides, each stopping one short of the next corner so no corner is printed twice. A single row or a single column is a special case — the ring collapses to a line and the generic four-side walk would print cells twice.

```python filename:Python
def boundary(mat):
    R, C = len(mat), len(mat[0])
    if R == 1:
        return list(mat[0])                              # single row
    if C == 1:
        return [mat[i][0] for i in range(R)]             # single column
    out = []
    for j in range(C):           out.append(mat[0][j])       # top: left → right
    for i in range(1, R):        out.append(mat[i][C - 1])   # right: top → bottom
    for j in range(C - 2, -1, -1): out.append(mat[R - 1][j]) # bottom: right → left
    for i in range(R - 2, 0, -1):  out.append(mat[i][0])     # left: bottom → top
    return out

for mat in ([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], [[1], [2], [3]], [[1, 2, 3]]):
    print(*boundary(mat))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<int> boundary(const vector<vector<int>>& mat) {
    int R = mat.size(), C = mat[0].size();
    vector<int> out;
    if (R == 1) return mat[0];                                        // single row
    if (C == 1) { for (int i = 0; i < R; i++) out.push_back(mat[i][0]); return out; }
    for (int j = 0; j < C; j++) out.push_back(mat[0][j]);             // top: left → right
    for (int i = 1; i < R; i++) out.push_back(mat[i][C - 1]);         // right: top → bottom
    for (int j = C - 2; j >= 0; j--) out.push_back(mat[R - 1][j]);    // bottom: right → left
    for (int i = R - 2; i > 0; i--) out.push_back(mat[i][0]);         // left: bottom → top
    return out;
}

int main() {
    vector<vector<vector<int>>> tests = {{{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}}, {{1}, {2}, {3}}, {{1, 2, 3}}};
    for (auto& mat : tests) {
        for (int x : boundary(mat)) cout << x << " ";
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> boundary(int[][] mat) {
        int R = mat.length, C = mat[0].length;
        List<Integer> out = new ArrayList<>();
        if (R == 1) { for (int x : mat[0]) out.add(x); return out; }                // single row
        if (C == 1) { for (int i = 0; i < R; i++) out.add(mat[i][0]); return out; } // single column
        for (int j = 0; j < C; j++) out.add(mat[0][j]);                 // top: left → right
        for (int i = 1; i < R; i++) out.add(mat[i][C - 1]);             // right: top → bottom
        for (int j = C - 2; j >= 0; j--) out.add(mat[R - 1][j]);        // bottom: right → left
        for (int i = R - 2; i > 0; i--) out.add(mat[i][0]);             // left: bottom → top
        return out;
    }

    public static void main(String[] args) {
        int[][][] tests = {{{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}}, {{1}, {2}, {3}}, {{1, 2, 3}}};
        for (int[][] mat : tests) {
            StringBuilder sb = new StringBuilder();
            for (int x : boundary(mat)) sb.append(x).append(' ');
            System.out.println(sb.toString().trim());
        }
    }
}
```

```javascript filename:JavaScript
function boundary(mat) {
    const R = mat.length, C = mat[0].length;
    if (R === 1) return [...mat[0]];                                  // single row
    if (C === 1) return mat.map(row => row[0]);                       // single column
    const out = [];
    for (let j = 0; j < C; j++) out.push(mat[0][j]);                  // top: left → right
    for (let i = 1; i < R; i++) out.push(mat[i][C - 1]);              // right: top → bottom
    for (let j = C - 2; j >= 0; j--) out.push(mat[R - 1][j]);         // bottom: right → left
    for (let i = R - 2; i > 0; i--) out.push(mat[i][0]);              // left: bottom → top
    return out;
}

for (const mat of [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], [[1], [2], [3]], [[1, 2, 3]]])
    console.log(boundary(mat).join(" "));
```

```text filename:Output
1 2 3 4 8 12 11 10 9 5
1 2 3
1 2 3
```

Time O(R + C) · Space O(1) besides the output

> [!WARNING] Pitfall
>
> Without the single-row / single-column cases, the four loops print the row `1 2 3` as `1 2 3 2 1` — the bottom side is the same cells walked backwards.

# Transpose of a matrix

Rows become columns: `T[i][j] = mat[j][i]`.

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]`<br><strong>Output:</strong> `1 5 9 13 / 2 6 10 14 / 3 7 11 15 / 4 8 12 16`

The naive version copies every element into a new `N × N` matrix and copies it back — `O(N²)` extra space:

```python filename:Python
def transpose_copy(mat):
    N = len(mat)
    temp = [[0] * N for _ in range(N)]
    for i in range(N):
        for j in range(N):
            temp[i][j] = mat[j][i]
    return temp

for row in transpose_copy([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]):
    print(*row)
```

```text filename:Output
1 5 9 13
2 6 10 14
3 7 11 15
4 8 12 16
```

> [!NOTE] Idea
>
> For a <strong>square</strong> matrix, transposing just swaps `mat[i][j]` with `mat[j][i]`. Visit only the cells <strong>above the diagonal</strong> (`j > i`) and swap each with its mirror — visiting both triangles would swap everything twice and restore the original.

```text filename:In-place%20transpose%20touches%20the%20upper%20triangle%20only
 1   2   3   4         diagonal stays; each ↔ pair is swapped once
 5   6   7   8         (0,1)↔(1,0)  (0,2)↔(2,0)  (0,3)↔(3,0)
 9  10  11  12         (1,2)↔(2,1)  (1,3)↔(3,1)
13  14  15  16         (2,3)↔(3,2)
```

```python filename:Python
def transpose(mat):
    N = len(mat)
    for i in range(N):
        for j in range(i + 1, N):            # upper triangle only
            mat[i][j], mat[j][i] = mat[j][i], mat[i][j]

mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
transpose(mat)
for row in mat:
    print(*row)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <utility>
using namespace std;

void transpose(vector<vector<int>>& mat) {
    int N = mat.size();
    for (int i = 0; i < N; i++)
        for (int j = i + 1; j < N; j++)          // upper triangle only
            swap(mat[i][j], mat[j][i]);
}

int main() {
    vector<vector<int>> mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
    transpose(mat);
    for (auto& row : mat) {
        for (int x : row) cout << x << " ";
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static void transpose(int[][] mat) {
        int N = mat.length;
        for (int i = 0; i < N; i++)
            for (int j = i + 1; j < N; j++) {        // upper triangle only
                int t = mat[i][j]; mat[i][j] = mat[j][i]; mat[j][i] = t;
            }
    }

    public static void main(String[] args) {
        int[][] mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
        transpose(mat);
        for (int[] row : mat) {
            StringBuilder sb = new StringBuilder();
            for (int x : row) sb.append(x).append(' ');
            System.out.println(sb.toString().trim());
        }
    }
}
```

```javascript filename:JavaScript
function transpose(mat) {
    const N = mat.length;
    for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++)          // upper triangle only
            [mat[i][j], mat[j][i]] = [mat[j][i], mat[i][j]];
}

const mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
transpose(mat);
for (const row of mat) console.log(row.join(" "));
```

```text filename:Output
1 5 9 13
2 6 10 14
3 7 11 15
4 8 12 16
```

Time O(N²) · Space O(1)

> [!NOTE] Key point
>
> A non-square `R × C` matrix cannot be transposed in place with this trick — the result is `C × R`, a different shape. Allocate the new matrix and fill `T[j][i] = mat[i][j]`.

# Rotate a matrix by 90 degrees

Rotate a square matrix <strong>anticlockwise</strong> by 90°: the last column becomes the first row, the second-last column the second row, and so on.

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]`<br><strong>Output:</strong> `4 8 12 16 / 3 7 11 15 / 2 6 10 14 / 1 5 9 13`

Naively, `temp[N-1-j][i] = mat[i][j]` into a new matrix — `O(N²)` extra space:

```python filename:Python
def rotate_copy(mat):
    N = len(mat)
    temp = [[0] * N for _ in range(N)]
    for i in range(N):
        for j in range(N):
            temp[N - 1 - j][i] = mat[i][j]   # column j → row N-1-j
    return temp

for row in rotate_copy([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]):
    print(*row)
```

```text filename:Output
4 8 12 16
3 7 11 15
2 6 10 14
1 5 9 13
```

> [!NOTE] Idea
>
> <strong>Transpose, then reverse the order of the rows.</strong> The transpose turns column `j` into row `j`; reversing the row order puts the last column first. Reversing every <em>column</em> of the transpose (the original's second method) is the same thing done cell by cell — swapping whole rows is simpler and just as in-place. For a <strong>clockwise</strong> rotation, transpose and reverse each <em>row</em> instead.

```text filename:Anticlockwise%2090%C2%B0%20%3D%20transpose%20%2B%20reverse%20the%20row%20order
 1  2  3  4      transpose     1  5  9 13      reverse rows     4  8 12 16
 5  6  7  8      ─────────▶    2  6 10 14      ────────────▶    3  7 11 15
 9 10 11 12                    3  7 11 15                       2  6 10 14
13 14 15 16                    4  8 12 16                       1  5  9 13
```

```python filename:Python
def transpose(mat):
    N = len(mat)
    for i in range(N):
        for j in range(i + 1, N):
            mat[i][j], mat[j][i] = mat[j][i], mat[i][j]

def rotate_anticlockwise(mat):
    transpose(mat)
    lo, hi = 0, len(mat) - 1
    while lo < hi:                           # reverse the order of the rows
        mat[lo], mat[hi] = mat[hi], mat[lo]
        lo += 1
        hi -= 1

mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
rotate_anticlockwise(mat)
for row in mat:
    print(*row)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <utility>
using namespace std;

void transpose(vector<vector<int>>& mat) {
    int N = mat.size();
    for (int i = 0; i < N; i++)
        for (int j = i + 1; j < N; j++) swap(mat[i][j], mat[j][i]);
}

void rotateAnticlockwise(vector<vector<int>>& mat) {
    transpose(mat);
    int lo = 0, hi = (int)mat.size() - 1;
    while (lo < hi) swap(mat[lo++], mat[hi--]);   // reverse the order of the rows
}

int main() {
    vector<vector<int>> mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
    rotateAnticlockwise(mat);
    for (auto& row : mat) {
        for (int x : row) cout << x << " ";
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static void transpose(int[][] mat) {
        int N = mat.length;
        for (int i = 0; i < N; i++)
            for (int j = i + 1; j < N; j++) {
                int t = mat[i][j]; mat[i][j] = mat[j][i]; mat[j][i] = t;
            }
    }

    static void rotateAnticlockwise(int[][] mat) {
        transpose(mat);
        int lo = 0, hi = mat.length - 1;
        while (lo < hi) {                                // reverse the order of the rows
            int[] t = mat[lo]; mat[lo] = mat[hi]; mat[hi] = t;
            lo++; hi--;
        }
    }

    public static void main(String[] args) {
        int[][] mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
        rotateAnticlockwise(mat);
        for (int[] row : mat) {
            StringBuilder sb = new StringBuilder();
            for (int x : row) sb.append(x).append(' ');
            System.out.println(sb.toString().trim());
        }
    }
}
```

```javascript filename:JavaScript
function transpose(mat) {
    const N = mat.length;
    for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++)
            [mat[i][j], mat[j][i]] = [mat[j][i], mat[i][j]];
}

function rotateAnticlockwise(mat) {
    transpose(mat);
    mat.reverse();                               // reverse the order of the rows
}

const mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
rotateAnticlockwise(mat);
for (const row of mat) console.log(row.join(" "));
```

```text filename:Output
4 8 12 16
3 7 11 15
2 6 10 14
1 5 9 13
```

Time O(N²) · Space O(1)

| Rotation | Recipe | Check with `mat[0][0] = 1` |
| --- | --- | --- |
| 90° anticlockwise | transpose, then reverse row order (or reverse each column) | `1` ends bottom-left |
| 90° clockwise | transpose, then reverse each row | `1` ends top-right |
| 180° | reverse row order, then reverse each row | `1` ends bottom-right |

# Spiral traversal of a matrix

Print the matrix in a clockwise spiral starting at the top-left corner, peeling one ring at a time.

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]`<br><strong>Output:</strong> `1 2 3 4 8 12 16 15 14 13 9 5 6 7 11 10`<br><strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]`<br><strong>Output:</strong> `1 2 3 4 8 12 11 10 9 5 6 7`

```text filename:Spiral%3A%20top%20row%2C%20right%20column%2C%20bottom%20row%2C%20left%20column%2C%20then%20the%20inner%20ring
 1 → 2 → 3 → 4
             ↓
 5 → 6 → 7   8
 ↑       ↓   ↓
 9  10 ← 11  12
 ↑           ↓
13 ← 14 ← 15 ← 16
```

> [!NOTE] Idea
>
> Keep four boundaries `top`, `bottom`, `left`, `right`. Print the top row and move `top` down, the right column and move `right` left, the bottom row (if a row is left) and move `bottom` up, the left column (if a column is left) and move `left` right. Stop when the boundaries cross. The two `if` checks matter for non-square matrices, where the last ring can be a single row or column.

1. <strong>Top row</strong>

   `left → right` along row `top`; then `top += 1`.

2. <strong>Right column</strong>

   `top → bottom` along column `right`; then `right -= 1`.

3. <strong>Bottom row</strong>

   only if `top <= bottom`: `right → left` along row `bottom`; then `bottom -= 1`.

4. <strong>Left column</strong>

   only if `left <= right`: `bottom → top` along column `left`; then `left += 1`.

```python filename:Python
def spiral(mat):
    out = []
    top, bottom = 0, len(mat) - 1
    left, right = 0, len(mat[0]) - 1
    while top <= bottom and left <= right:
        for j in range(left, right + 1):          # top row →
            out.append(mat[top][j])
        top += 1
        for i in range(top, bottom + 1):          # right column ↓
            out.append(mat[i][right])
        right -= 1
        if top <= bottom:                         # a row is still left
            for j in range(right, left - 1, -1):  # bottom row ←
                out.append(mat[bottom][j])
            bottom -= 1
        if left <= right:                         # a column is still left
            for i in range(bottom, top - 1, -1):  # left column ↑
                out.append(mat[i][left])
            left += 1
    return out

print(*spiral([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]))
print(*spiral([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void spiral(const vector<vector<int>>& mat) {
    int top = 0, bottom = (int)mat.size() - 1;
    int left = 0, right = (int)mat[0].size() - 1;
    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) cout << mat[top][j] << " ";      // top row →
        top++;
        for (int i = top; i <= bottom; i++) cout << mat[i][right] << " ";    // right column ↓
        right--;
        if (top <= bottom) {                                                 // a row is still left
            for (int j = right; j >= left; j--) cout << mat[bottom][j] << " ";   // bottom row ←
            bottom--;
        }
        if (left <= right) {                                                 // a column is still left
            for (int i = bottom; i >= top; i--) cout << mat[i][left] << " ";     // left column ↑
            left++;
        }
    }
    cout << "\n";
}

int main() {
    spiral({{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}});
    spiral({{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}});
}
```

```java filename:Java
public class Main {
    static void spiral(int[][] mat) {
        StringBuilder sb = new StringBuilder();
        int top = 0, bottom = mat.length - 1;
        int left = 0, right = mat[0].length - 1;
        while (top <= bottom && left <= right) {
            for (int j = left; j <= right; j++) sb.append(mat[top][j]).append(' ');      // top row →
            top++;
            for (int i = top; i <= bottom; i++) sb.append(mat[i][right]).append(' ');    // right column ↓
            right--;
            if (top <= bottom) {                                                         // a row is still left
                for (int j = right; j >= left; j--) sb.append(mat[bottom][j]).append(' ');   // bottom row ←
                bottom--;
            }
            if (left <= right) {                                                         // a column is still left
                for (int i = bottom; i >= top; i--) sb.append(mat[i][left]).append(' ');     // left column ↑
                left++;
            }
        }
        System.out.println(sb.toString().trim());
    }

    public static void main(String[] args) {
        spiral(new int[][]{{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}});
        spiral(new int[][]{{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}});
    }
}
```

```javascript filename:JavaScript
function spiral(mat) {
    const out = [];
    let top = 0, bottom = mat.length - 1;
    let left = 0, right = mat[0].length - 1;
    while (top <= bottom && left <= right) {
        for (let j = left; j <= right; j++) out.push(mat[top][j]);      // top row →
        top++;
        for (let i = top; i <= bottom; i++) out.push(mat[i][right]);    // right column ↓
        right--;
        if (top <= bottom) {                                            // a row is still left
            for (let j = right; j >= left; j--) out.push(mat[bottom][j]);   // bottom row ←
            bottom--;
        }
        if (left <= right) {                                            // a column is still left
            for (let i = bottom; i >= top; i--) out.push(mat[i][left]);     // left column ↑
            left++;
        }
    }
    return out;
}

console.log(spiral([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]).join(" "));
console.log(spiral([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]).join(" "));
```

```text filename:Output
1 2 3 4 8 12 16 15 14 13 9 5 6 7 11 10
1 2 3 4 8 12 11 10 9 5 6 7
```

Time O(R · C) · Space O(1) besides the output

> [!WARNING] Pitfall
>
> The original notes looped the right column with `range(top, bottom - 1)`, which skips the last two cells of the column — the 4 × 4 example only printed correctly by accident. The range must be `top..bottom` inclusive. Also, dropping the two `if` guards prints the middle row of a `3 × 4` matrix twice (`… 5 6 7 7 6 5`).

# Search in a row-wise and column-wise sorted matrix

Every row is sorted left to right and every column top to bottom. Find `x`, or report that it is absent.

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]], x = 11`<br><strong>Output:</strong> `Found at (2, 2)`<br><strong>Input:</strong> `x = 10`<br><strong>Output:</strong> `Found at (2, 1)`<br><strong>Input:</strong> `x = 17`<br><strong>Output:</strong> `Not found`

A full scan is `O(R · C)`. Binary-searching each row is `O(R log C)`. The staircase search below is `O(R + C)` and needs no binary search at all.

> [!NOTE] Idea
>
> <strong>Staircase search.</strong> Start at the <strong>top-right</strong> corner. Everything to its left is smaller, everything below it is larger. So if `mat[i][j] > x`, column `j` can be discarded (move left); if `mat[i][j] < x`, row `i` can be discarded (move down). Each step eliminates a whole row or column, so at most `R + C` steps are taken.

```text filename:Each%20comparison%20discards%20a%20row%20or%20a%20column
 1   2   3  [4]      x = 11: start at 4   (4 < 11 → down)
 5   6   7  [8]                 8 < 11 → down
 9  10 [11] 12                 12 > 11 → left,  11 found at (2, 2)
13  14  15  16
```

```python filename:Python
def search(mat, x):
    R, C = len(mat), len(mat[0])
    i, j = 0, C - 1                      # top-right corner
    while i < R and j >= 0:
        if mat[i][j] == x:
            return f"Found at ({i}, {j})"
        if mat[i][j] > x:
            j -= 1                       # whole column j is too big
        else:
            i += 1                       # whole row i is too small
    return "Not found"

mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
for x in (11, 10, 17):
    print(search(mat, x))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <string>
using namespace std;

string search(const vector<vector<int>>& mat, int x) {
    int R = mat.size(), C = mat[0].size();
    int i = 0, j = C - 1;                        // top-right corner
    while (i < R && j >= 0) {
        if (mat[i][j] == x) return "Found at (" + to_string(i) + ", " + to_string(j) + ")";
        if (mat[i][j] > x) j--;                  // whole column j is too big
        else i++;                                // whole row i is too small
    }
    return "Not found";
}

int main() {
    vector<vector<int>> mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
    for (int x : {11, 10, 17}) cout << search(mat, x) << "\n";
}
```

```java filename:Java
public class Main {
    static String search(int[][] mat, int x) {
        int R = mat.length, C = mat[0].length;
        int i = 0, j = C - 1;                        // top-right corner
        while (i < R && j >= 0) {
            if (mat[i][j] == x) return "Found at (" + i + ", " + j + ")";
            if (mat[i][j] > x) j--;                  // whole column j is too big
            else i++;                                // whole row i is too small
        }
        return "Not found";
    }

    public static void main(String[] args) {
        int[][] mat = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}};
        for (int x : new int[]{11, 10, 17}) System.out.println(search(mat, x));
    }
}
```

```javascript filename:JavaScript
function search(mat, x) {
    const R = mat.length, C = mat[0].length;
    let i = 0, j = C - 1;                        // top-right corner
    while (i < R && j >= 0) {
        if (mat[i][j] === x) return `Found at (${i}, ${j})`;
        if (mat[i][j] > x) j--;                  // whole column j is too big
        else i++;                                // whole row i is too small
    }
    return "Not found";
}

const mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
for (const x of [11, 10, 17]) console.log(search(mat, x));
```

```text filename:Output
Found at (2, 2)
Found at (2, 1)
Not found
```

Time O(R + C) · Space O(1)

> [!NOTE] Key point
>
> Starting at the <strong>bottom-left</strong> corner works symmetrically (smaller → up, larger → right). Starting at the top-left or bottom-right does <em>not</em>: both neighbours there move in the same direction, so a comparison cannot discard anything.

# Median of a row-wise sorted matrix

Each row is sorted, but the rows are unrelated to each other. Find the median of all `R × C` elements (assume `R × C` is odd).

> [!TIP] Example
>
> <strong>Input:</strong> `mat = [[1, 3, 5], [2, 6, 9], [3, 6, 9]]`<br><strong>Output:</strong> `5`<br><strong>Input:</strong> `mat = [[5, 10, 20, 30, 40], [1, 2, 3, 4, 6], [11, 13, 15, 17, 19]]`<br><strong>Output:</strong> `11`

Naively, copy everything into one array, sort it and take the middle — `O(RC log RC)` time and `O(RC)` space:

```python filename:Python
def median_naive(mat):
    flat = sorted(x for row in mat for x in row)
    return flat[len(flat) // 2]              # middle of an odd-length sorted list

print(median_naive([[1, 3, 5], [2, 6, 9], [3, 6, 9]]))
```

```text filename:Output
5
```

> [!NOTE] Idea
>
> <strong>Binary search on the answer.</strong> The median is the smallest value `m` such that at least `(R·C + 1) / 2` elements are `≤ m`. The count of elements `≤ m` is monotonic in `m` and, because every row is sorted, it can be computed with one `upper_bound` per row in `O(R log C)`. Binary-search `m` between the smallest first-column value and the largest last-column value.

1. <strong>Bounds</strong>

   `lo` = min of the first column, `hi` = max of the last column — the median lies between them.

2. <strong>Count</strong>

   For `mid = (lo + hi) / 2`, count how many elements are `≤ mid`: `upper_bound` in each row.

3. <strong>Narrow</strong>

   If `count < (R·C + 1) / 2`, the median is larger: `lo = mid + 1`; otherwise `hi = mid`.

4. <strong>Answer</strong>

   When `lo == hi` it is the median — it is guaranteed to be an element of the matrix.

```python filename:Python
from bisect import bisect_right

def median(mat):
    R, C = len(mat), len(mat[0])
    lo = min(row[0] for row in mat)
    hi = max(row[-1] for row in mat)
    target = (R * C + 1) // 2                        # rank of the median
    while lo < hi:
        mid = (lo + hi) // 2
        count = sum(bisect_right(row, mid) for row in mat)   # elements <= mid
        if count < target:
            lo = mid + 1                             # median is bigger
        else:
            hi = mid                                 # mid could be the median
    return lo

print(median([[1, 3, 5], [2, 6, 9], [3, 6, 9]]))
print(median([[5, 10, 20, 30, 40], [1, 2, 3, 4, 6], [11, 13, 15, 17, 19]]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int median(const vector<vector<int>>& mat) {
    int R = mat.size(), C = mat[0].size();
    int lo = mat[0][0], hi = mat[0][C - 1];
    for (int i = 1; i < R; i++) {
        lo = min(lo, mat[i][0]);
        hi = max(hi, mat[i][C - 1]);
    }
    int target = (R * C + 1) / 2;                           // rank of the median
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        int count = 0;
        for (const auto& row : mat)                          // elements <= mid
            count += upper_bound(row.begin(), row.end(), mid) - row.begin();
        if (count < target) lo = mid + 1;                    // median is bigger
        else hi = mid;                                       // mid could be the median
    }
    return lo;
}

int main() {
    cout << median({{1, 3, 5}, {2, 6, 9}, {3, 6, 9}}) << "\n";
    cout << median({{5, 10, 20, 30, 40}, {1, 2, 3, 4, 6}, {11, 13, 15, 17, 19}}) << "\n";
}
```

```java filename:Java
public class Main {
    static int upperBound(int[] row, int x) {        // first index with row[idx] > x
        int lo = 0, hi = row.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (row[mid] <= x) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    static int median(int[][] mat) {
        int R = mat.length, C = mat[0].length;
        int lo = mat[0][0], hi = mat[0][C - 1];
        for (int i = 1; i < R; i++) {
            lo = Math.min(lo, mat[i][0]);
            hi = Math.max(hi, mat[i][C - 1]);
        }
        int target = (R * C + 1) / 2;                 // rank of the median
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            int count = 0;
            for (int[] row : mat) count += upperBound(row, mid);   // elements <= mid
            if (count < target) lo = mid + 1;         // median is bigger
            else hi = mid;                            // mid could be the median
        }
        return lo;
    }

    public static void main(String[] args) {
        System.out.println(median(new int[][]{{1, 3, 5}, {2, 6, 9}, {3, 6, 9}}));
        System.out.println(median(new int[][]{{5, 10, 20, 30, 40}, {1, 2, 3, 4, 6}, {11, 13, 15, 17, 19}}));
    }
}
```

```javascript filename:JavaScript
function upperBound(row, x) {                    // first index with row[idx] > x
    let lo = 0, hi = row.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (row[mid] <= x) lo = mid + 1; else hi = mid;
    }
    return lo;
}

function median(mat) {
    const R = mat.length, C = mat[0].length;
    let lo = Math.min(...mat.map(row => row[0]));
    let hi = Math.max(...mat.map(row => row[C - 1]));
    const target = Math.floor((R * C + 1) / 2);  // rank of the median
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        let count = 0;
        for (const row of mat) count += upperBound(row, mid);   // elements <= mid
        if (count < target) lo = mid + 1;        // median is bigger
        else hi = mid;                           // mid could be the median
    }
    return lo;
}

console.log(median([[1, 3, 5], [2, 6, 9], [3, 6, 9]]));
console.log(median([[5, 10, 20, 30, 40], [1, 2, 3, 4, 6], [11, 13, 15, 17, 19]]));
```

```text filename:Output
5
11
```

Time O(R · log C · log(max − min)) · Space O(1)

> [!WARNING] Pitfall
>
> The original notes ran this on the 4 × 4 matrix `1..16` and claimed the output `20` — an even count has no single middle element and `20` is not even in the matrix. For an even `R × C`, run the search twice for ranks `RC/2` and `RC/2 + 1` and average the two values.

> [!NOTE] Key point
>
> `upper_bound` (count of elements `≤ mid`) is what makes duplicates work: with `bisect_left` / `lower_bound` the count would exclude copies of `mid` itself and the search could overshoot.

# Interview Q&amp;A

```question
How do you rotate a square matrix 90° in place?

---

Transpose it (swap `mat[i][j]` with `mat[j][i]` for `j > i`), then reverse the row order for an anticlockwise rotation or reverse each row for a clockwise one. Both steps are `O(N²)` time and `O(1)` extra space. A non-square matrix changes shape, so it needs a new `C × R` array.
```

```question
Why does the staircase search start at the top-right (or bottom-left) corner?

---

At the top-right corner the two possible moves point in opposite directions in terms of value: left is smaller, down is larger. One comparison therefore discards a whole row or column. At the top-left corner both right and down are larger, so a comparison cannot eliminate anything.
```

```question
What is the time complexity of the staircase search and why?

---

`O(R + C)`. Every step moves either one column left or one row down, and neither pointer ever reverses, so there are at most `C` left moves and `R` down moves.
```

```question
How does binary search on the answer find the median of a row-wise sorted matrix?

---

The predicate 'at least `(RC+1)/2` elements are `≤ m`' is false for small `m` and true for large `m`, so binary search over the value range `[min, max]` finds the smallest `m` that satisfies it — the median. Each probe costs `O(R log C)` using `upper_bound` on every row, giving `O(R · log C · log(max − min))` overall with `O(1)` extra space.
```

```question
What goes wrong with \[\[0\] \* cols\] \* rows in Python?

---

The outer `*` copies the <em>reference</em> to a single inner list, so all rows alias the same object and `mat[0][0] = 1` changes column 0 of every row. Use a comprehension, `[[0] * cols for _ in range(rows)]`, which creates a fresh list per row. JavaScript's `Array(rows).fill([])` has the same bug.
```

```question
How would you print a matrix in spiral order without the boundary-crossing bugs?

---

Keep `top`, `bottom`, `left`, `right`. Print the top row and right column unconditionally, then print the bottom row only if `top <= bottom` and the left column only if `left <= right`. Those two guards prevent re-printing the middle row or column of a non-square matrix on its last ring.
```
