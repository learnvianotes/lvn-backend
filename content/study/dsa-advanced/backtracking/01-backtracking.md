---
id: be3bca30-e697-743e-a62b-7f7d214667a1
key: topic:dsa-advanced/backtracking
subject: dsa-advanced
topic: backtracking
title: Backtracking
slug: backtracking
order: 1
---

Backtracking explores a space of candidate solutions by building them step by step and <strong>abandoning a partial solution the moment it can no longer lead to a valid answer</strong> — pruning whole branches of the recursion tree instead of generating every combination.

> [!INFO]
>
> <strong>Backtracking</strong> — a refinement of brute-force recursion: at each step <em>choose</em> one option, <em>explore</em> what follows, and if it fails <em>un-choose</em> it and try the next option. The key ingredient is a feasibility check that rejects a partial solution early.

```text filename:Recursion%20tree%20for%20permutations%20of%20ABC%20without%20the%20substring%20%22AB%22%20%E2%80%94%20two%20branches%20are%20cut%20before%20they%20are%20expanded
               ( )                         choose a value for position 0
      ┌─────────┼─────────┐
     (A)       (B)       (C)
  ┌───┴───┐  ┌──┴──┐   ┌──┴──┐
(AB)   (AC) (BA) (BC) (CA) (CB)         choose a value for position 1
  ✘      │    │    │    ✘    │           ✘ = "AB" appeared → prune this branch
       (ACB)(BAC)(BCA)     (CBA)         every surviving leaf is a solution
```

# The template: choose, explore, un-choose

Every backtracking solution is the same recursive function. Only the three parts in the comments change from problem to problem.

```text filename:The%20backtracking%20template%20%E2%80%94%20undo%20must%20perfectly%20reverse%20apply
solve(state):
    if state is a complete solution:       # base case
        record / print it
        return

    for each option in candidates(state):  # the branching
        if not feasible(option, state):    # ← pruning: skip dead branches early
            continue
        apply(option, state)               # choose
        solve(state)                       # explore
        undo(option, state)                # un-choose (restore the state exactly)
```

1. <strong>Choose</strong>

   Place a queen, step onto a cell, write a digit — mutate the shared state.

2. <strong>Explore</strong>

   Recurse to fill the next position. If it returns success and you only want one solution, return immediately.

3. <strong>Un-choose</strong>

   Undo the mutation so the loop can try the next option on a clean state. Forgetting this step is the #1 bug.

| Technique | Explores | Prunes? | Reuses sub-results? | Typical problems |
| --- | --- | --- | --- | --- |
| Plain recursion / brute force | every candidate | no | no | generate all subsets or permutations |
| <strong>Backtracking</strong> | candidates in a DFS order | <strong>yes</strong> — as soon as a partial solution is infeasible | no | N-Queens, Sudoku, maze paths, constraint satisfaction |
| Dynamic programming | overlapping sub-problems | no | <strong>yes</strong> — memoised | optimisation with optimal substructure |
| Branch and bound | candidates in a best-first order | yes — by a cost bound | no | optimisation (TSP, 0/1 knapsack exact) |

> [!NOTE] Key point
>
> Backtracking does not change the <strong>worst-case</strong> complexity — N-Queens is still exponential — but the pruning makes the <em>typical</em> running time dramatically smaller than brute force. Whenever a yes/no feasibility test can be applied to a <em>partial</em> solution, backtracking applies.

# Permutations without "AB" as a substring

Given a string, print all permutations that do <strong>not</strong> contain `"AB"` as a substring. The brute-force version generates all `n!` permutations and filters them at the leaves; backtracking checks the constraint <em>while</em> the permutation is being built and never expands a prefix that already contains `"AB"`.

> [!TIP] Example
>
> <strong>Input:</strong> `str = "ABC"`<br><strong>Output:</strong> `ACB BAC BCA CBA`

> [!NOTE] Idea
>
> Fix the characters position by position by <strong>swapping</strong> `chars[i]` into position `l` (choose), recursing on `l + 1` (explore), and swapping back (un-choose). Right after a swap, if `chars[l-1] == 'A'` and `chars[l] == 'B'` the prefix is already invalid — skip the recursion for that choice.

```python filename:Python
def permute(chars, l, found):
    n = len(chars)
    if l == n:                                           # every position fixed — a complete permutation
        found.append("".join(chars))
        return
    for i in range(l, n):
        chars[l], chars[i] = chars[i], chars[l]          # choose: put chars[i] at position l
        if not (l > 0 and chars[l - 1] == 'A' and chars[l] == 'B'):   # prune: "AB" just appeared
            permute(chars, l + 1, found)                 # explore
        chars[l], chars[i] = chars[i], chars[l]          # un-choose

found = []
permute(list("ABC"), 0, found)
print(" ".join(found))
print("count:", len(found))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

void permute(string& s, int l, vector<string>& found) {
    int n = s.size();
    if (l == n) { found.push_back(s); return; }          // every position fixed — a complete permutation
    for (int i = l; i < n; i++) {
        swap(s[l], s[i]);                                  // choose: put s[i] at position l
        if (!(l > 0 && s[l - 1] == 'A' && s[l] == 'B'))    // prune: "AB" just appeared
            permute(s, l + 1, found);                      // explore
        swap(s[l], s[i]);                                  // un-choose
    }
}

int main() {
    string s = "ABC";
    vector<string> found;
    permute(s, 0, found);
    for (size_t i = 0; i < found.size(); i++) cout << (i ? " " : "") << found[i];
    cout << "\ncount: " << found.size() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void permute(char[] s, int l, List<String> found) {
        if (l == s.length) { found.add(new String(s)); return; }   // every position fixed
        for (int i = l; i < s.length; i++) {
            char t = s[l]; s[l] = s[i]; s[i] = t;                 // choose: put s[i] at position l
            if (!(l > 0 && s[l - 1] == 'A' && s[l] == 'B'))        // prune: "AB" just appeared
                permute(s, l + 1, found);                          // explore
            t = s[l]; s[l] = s[i]; s[i] = t;                      // un-choose
        }
    }

    public static void main(String[] args) {
        List<String> found = new ArrayList<>();
        permute("ABC".toCharArray(), 0, found);
        System.out.println(String.join(" ", found));
        System.out.println("count: " + found.size());
    }
}
```

```javascript filename:JavaScript
function permute(chars, l, found) {
    if (l === chars.length) { found.push(chars.join("")); return; }   // every position fixed
    for (let i = l; i < chars.length; i++) {
        [chars[l], chars[i]] = [chars[i], chars[l]];                  // choose: put chars[i] at position l
        if (!(l > 0 && chars[l - 1] === 'A' && chars[l] === 'B'))     // prune: "AB" just appeared
            permute(chars, l + 1, found);                             // explore
        [chars[l], chars[i]] = [chars[i], chars[l]];                  // un-choose
    }
}

const found = [];
permute([..."ABC"], 0, found);
console.log(found.join(" "));
console.log("count:", found.length);
```

```text filename:Output
ACB BAC BCA CBA
count: 4
```

Time O(n · n!) worst case — far fewer nodes are visited thanks to pruning · Space O(n) recursion depth

> [!WARNING] Pitfall
>
> Checking the constraint only at the leaves (`if "AB" not in result`) is still correct but it is <strong>not backtracking</strong> — it is brute force with a filter, and it visits all `n!` leaves. The pruning line is what turns the recursion tree into something smaller.

# Rat in a maze

A rat starts in the top-left cell `(0, 0)` of an `N × N` maze and must reach the bottom-right cell `(N-1, N-1)`. A `1` is an open cell, a `0` is a wall. Only two moves are allowed: <strong>down</strong> and <strong>right</strong>. Print the path as a matrix of `1`s, or report that no path exists.

> [!TIP] Example
>
> <strong>Input:</strong> `maze = [[1,0,0,0], [1,1,0,1], [0,1,0,0], [0,1,1,1]]`<br><strong>Output:</strong> `1 0 0 0 / 1 1 0 0 / 0 1 0 0 / 0 1 1 1 (path marked with 1s)`

```text filename:The%20rat%20may%20only%20move%20down%20or%20right%3B%20dead%20ends%20are%20un-marked%20when%20the%20recursion%20backs%20out
maze              path found
1 0 0 0           1 0 0 0        (0,0) ↓ (1,0) → (1,1) ↓ (2,1) ↓ (3,1) → (3,2) → (3,3)
1 1 0 1           1 1 0 0
0 1 0 0           0 1 0 0        the 1 at (1,3) is open but unreachable with down/right moves
0 1 1 1           0 1 1 1
```

> [!NOTE] Idea
>
> Mark the current cell as part of the path (choose), try to reach the goal via the cell below, then via the cell to the right (explore). If neither works, this cell is a dead end — clear the mark (un-choose) and return `false` so the caller tries its other move.

1. <strong>Reject</strong>

   Outside the grid, or the cell is a wall → return `false`.

2. <strong>Mark</strong>

   `path[r][c] = 1`. If this is the destination → return `true`.

3. <strong>Try down, then right</strong>

   If either recursive call succeeds, keep the mark and return `true`.

4. <strong>Backtrack</strong>

   Neither move led anywhere: `path[r][c] = 0`, return `false`.

```python filename:Python
def solve_maze(maze):
    n = len(maze)
    path = [[0] * n for _ in range(n)]

    def solve(r, c):
        if r >= n or c >= n or maze[r][c] == 0:      # off the grid or a wall
            return False
        path[r][c] = 1                               # choose: step on this cell
        if r == n - 1 and c == n - 1:                # reached the destination
            return True
        if solve(r + 1, c) or solve(r, c + 1):       # explore: down first, then right
            return True
        path[r][c] = 0                               # un-choose: dead end
        return False

    return path if solve(0, 0) else None

maze = [[1, 0, 0, 0],
        [1, 1, 0, 1],
        [0, 1, 0, 0],
        [0, 1, 1, 1]]
path = solve_maze(maze)
if path is None:
    print("No path exists")
else:
    print("path:")
    for row in path:
        print(" ".join(map(str, row)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool solve(const vector<vector<int>>& maze, int r, int c, vector<vector<int>>& path) {
    int n = maze.size();
    if (r >= n || c >= n || maze[r][c] == 0) return false;   // off the grid or a wall
    path[r][c] = 1;                                           // choose: step on this cell
    if (r == n - 1 && c == n - 1) return true;                // reached the destination
    if (solve(maze, r + 1, c, path) || solve(maze, r, c + 1, path)) return true;   // explore: down, then right
    path[r][c] = 0;                                           // un-choose: dead end
    return false;
}

int main() {
    vector<vector<int>> maze = {{1, 0, 0, 0},
                                {1, 1, 0, 1},
                                {0, 1, 0, 0},
                                {0, 1, 1, 1}};
    int n = maze.size();
    vector<vector<int>> path(n, vector<int>(n, 0));
    if (!solve(maze, 0, 0, path)) { cout << "No path exists\n"; return 0; }
    cout << "path:\n";
    for (auto& row : path) {
        for (int j = 0; j < n; j++) cout << (j ? " " : "") << row[j];
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static boolean solve(int[][] maze, int r, int c, int[][] path) {
        int n = maze.length;
        if (r >= n || c >= n || maze[r][c] == 0) return false;   // off the grid or a wall
        path[r][c] = 1;                                           // choose: step on this cell
        if (r == n - 1 && c == n - 1) return true;                // reached the destination
        if (solve(maze, r + 1, c, path) || solve(maze, r, c + 1, path)) return true;   // explore: down, then right
        path[r][c] = 0;                                           // un-choose: dead end
        return false;
    }

    public static void main(String[] args) {
        int[][] maze = {{1, 0, 0, 0},
                        {1, 1, 0, 1},
                        {0, 1, 0, 0},
                        {0, 1, 1, 1}};
        int n = maze.length;
        int[][] path = new int[n][n];
        if (!solve(maze, 0, 0, path)) { System.out.println("No path exists"); return; }
        System.out.println("path:");
        for (int[] row : path) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < n; j++) sb.append(j > 0 ? " " : "").append(row[j]);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function solveMaze(maze) {
    const n = maze.length;
    const path = Array.from({ length: n }, () => Array(n).fill(0));

    function solve(r, c) {
        if (r >= n || c >= n || maze[r][c] === 0) return false;   // off the grid or a wall
        path[r][c] = 1;                                           // choose: step on this cell
        if (r === n - 1 && c === n - 1) return true;              // reached the destination
        if (solve(r + 1, c) || solve(r, c + 1)) return true;      // explore: down first, then right
        path[r][c] = 0;                                           // un-choose: dead end
        return false;
    }

    return solve(0, 0) ? path : null;
}

const maze = [[1, 0, 0, 0],
              [1, 1, 0, 1],
              [0, 1, 0, 0],
              [0, 1, 1, 1]];
const path = solveMaze(maze);
if (path === null) {
    console.log("No path exists");
} else {
    console.log("path:");
    for (const row of path) console.log(row.join(" "));
}
```

```text filename:Output
path:
1 0 0 0
1 1 0 0
0 1 0 0
0 1 1 1
```

Time O(2^(N²)) worst case — each cell branches two ways · Space O(N²) for the path matrix, O(N) recursion depth

> [!NOTE] Four-direction variant
>
> If all four moves (up, down, left, right) are allowed, the same code loops forever bouncing between two cells. Add the condition `path[r][c] == 1 → return false` (already visited) so a cell is never entered twice on the same path.

# N-Queens problem

Place `N` queens on an `N × N` chessboard so that <strong>no two queens attack each other</strong> — no two share a row, a column or a diagonal. For `N = 4` there are exactly two solutions (mirror images of each other).

> [!TIP] Example
>
> <strong>Input:</strong> `N = 4`<br><strong>Output:</strong> `. Q . . / . . . Q / Q . . . / . . Q . — 2 solutions in total`

| Approach | Idea | Configurations examined |
| --- | --- | --- |
| Super naive | Choose any `N` of the `N²` cells, check each configuration | `C(N², N)` — 1820 for N = 4, \~4.4 × 10⁹ for N = 8 |
| Naive | One queen per row: try every permutation of column numbers, check diagonals | `N!` — 24 for N = 4, 40 320 for N = 8 |
| <strong>Backtracking</strong> | Place row by row; before placing in `(r, c)` check it against the queens already placed and <strong>cut the branch</strong> on the first conflict | far fewer — 15 placements tried for N = 4, \~2 000 for N = 8 |

> [!NOTE] Idea
>
> Since every row holds exactly one queen, the state is just `cols[r]` = the column of the queen in row `r`. A new queen at `(r, c)` is safe iff for every earlier row `pr`: `cols[pr] != c` (column) and `|cols[pr] − c| != r − pr` (both diagonals). Place, recurse to the next row, un-place.

```text filename:The%20first%20solution%20found%20for%20N%20%3D%204
row 0:  . Q . .        cols = [1, 3, 0, 2]
row 1:  . . . Q        row 0 tried col 0 first: rows 1–2 could be filled (0,2,?) but row 3 had no safe
row 2:  Q . . .        column → backtracked all the way to row 0 and moved the first queen to col 1
row 3:  . . Q .
```

```python filename:Python
def solve_n_queens(n):
    cols = [-1] * n                     # cols[r] = column of the queen in row r
    solutions = []

    def safe(r, c):
        for pr in range(r):             # compare with every queen already placed
            pc = cols[pr]
            if pc == c or abs(pc - c) == r - pr:      # same column or same diagonal
                return False
        return True

    def place(r):
        if r == n:                      # all rows filled — a solution
            solutions.append(cols[:])
            return
        for c in range(n):
            if safe(r, c):              # prune: skip attacked squares
                cols[r] = c             # choose
                place(r + 1)            # explore
                cols[r] = -1            # un-choose

    place(0)
    return solutions

n = 4
sols = solve_n_queens(n)
for c in sols[0]:
    print(" ".join("Q" if j == c else "." for j in range(n)))
print("solutions:", len(sols))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <cstdlib>
using namespace std;

bool safe(const vector<int>& cols, int r, int c) {
    for (int pr = 0; pr < r; pr++) {                     // compare with every queen already placed
        int pc = cols[pr];
        if (pc == c || abs(pc - c) == r - pr) return false;   // same column or same diagonal
    }
    return true;
}

void place(int r, int n, vector<int>& cols, vector<vector<int>>& solutions) {
    if (r == n) { solutions.push_back(cols); return; }   // all rows filled — a solution
    for (int c = 0; c < n; c++) {
        if (!safe(cols, r, c)) continue;                 // prune: skip attacked squares
        cols[r] = c;                                     // choose
        place(r + 1, n, cols, solutions);                // explore
        cols[r] = -1;                                    // un-choose
    }
}

int main() {
    int n = 4;
    vector<int> cols(n, -1);                             // cols[r] = column of the queen in row r
    vector<vector<int>> solutions;
    place(0, n, cols, solutions);
    for (int c : solutions[0]) {
        for (int j = 0; j < n; j++) cout << (j ? " " : "") << (j == c ? "Q" : ".");
        cout << "\n";
    }
    cout << "solutions: " << solutions.size() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static boolean safe(int[] cols, int r, int c) {
        for (int pr = 0; pr < r; pr++) {                     // compare with every queen already placed
            int pc = cols[pr];
            if (pc == c || Math.abs(pc - c) == r - pr) return false;   // same column or same diagonal
        }
        return true;
    }

    static void place(int r, int n, int[] cols, List<int[]> solutions) {
        if (r == n) { solutions.add(cols.clone()); return; }   // all rows filled — a solution
        for (int c = 0; c < n; c++) {
            if (!safe(cols, r, c)) continue;                 // prune: skip attacked squares
            cols[r] = c;                                     // choose
            place(r + 1, n, cols, solutions);                // explore
            cols[r] = -1;                                    // un-choose
        }
    }

    public static void main(String[] args) {
        int n = 4;
        int[] cols = new int[n];                             // cols[r] = column of the queen in row r
        java.util.Arrays.fill(cols, -1);
        List<int[]> solutions = new ArrayList<>();
        place(0, n, cols, solutions);
        for (int c : solutions.get(0)) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < n; j++) sb.append(j > 0 ? " " : "").append(j == c ? "Q" : ".");
            System.out.println(sb);
        }
        System.out.println("solutions: " + solutions.size());
    }
}
```

```javascript filename:JavaScript
function solveNQueens(n) {
    const cols = Array(n).fill(-1);          // cols[r] = column of the queen in row r
    const solutions = [];

    function safe(r, c) {
        for (let pr = 0; pr < r; pr++) {     // compare with every queen already placed
            const pc = cols[pr];
            if (pc === c || Math.abs(pc - c) === r - pr) return false;   // same column or same diagonal
        }
        return true;
    }

    function place(r) {
        if (r === n) { solutions.push([...cols]); return; }   // all rows filled — a solution
        for (let c = 0; c < n; c++) {
            if (!safe(r, c)) continue;       // prune: skip attacked squares
            cols[r] = c;                     // choose
            place(r + 1);                    // explore
            cols[r] = -1;                    // un-choose
        }
    }

    place(0);
    return solutions;
}

const n = 4;
const sols = solveNQueens(n);
for (const c of sols[0])
    console.log(Array.from({ length: n }, (_, j) => (j === c ? "Q" : ".")).join(" "));
console.log("solutions:", sols.length);
```

```text filename:Output
. Q . .
. . . Q
Q . . .
. . Q .
solutions: 2
```

Time O(N!) worst case (with pruning far fewer nodes are visited); O(N) per safety check · Space O(N) for `cols` and the recursion

> [!NOTE] Optimisation
>
> `safe()` can be made `O(1)` with three boolean arrays: `usedCol[c]`, `diag1[r + c]` and `diag2[r − c + N − 1]`. Set them when placing and clear them when un-placing — the same choose/un-choose discipline.

> [!WARNING] Pitfall
>
> Checking only columns and the <em>main</em> diagonal is the classic omission — both `r − c` (↘) and `r + c` (↙) must be unique. The test `|pc − c| == r − pr` covers both at once.

# Sudoku solver

Fill the empty cells (`0`) of a `9 × 9` grid with digits `1–9` so that every <strong>row</strong>, every <strong>column</strong> and every <strong>3 × 3 sub-grid</strong> contains each digit exactly once.

> [!TIP] Example
>
> <strong>Input:</strong> `the standard puzzle below (51 empty cells)`<br><strong>Output:</strong> `the completed grid, printed one row per line`

- <strong>Distinct rows</strong> — a digit appears at most once in `board[row][*]`.
- <strong>Distinct columns</strong> — a digit appears at most once in `board[*][col]`.
- <strong>Distinct sub-grids</strong> — the 3 × 3 box starting at `(row − row % 3, col − col % 3)` has no repeats.

> [!NOTE] Idea
>
> Find the next empty cell. Try digits `1..9`; for each digit that passes the three checks, write it (choose) and recurse (explore). If the recursion fails, erase the digit (un-choose) and try the next. If no digit works, return `false` so the previous cell changes its digit. No empty cell left means the board is solved.

1. <strong>Find an empty cell</strong>

   Scan row-major for the first `0`. None left → solved, return `true`.

2. <strong>Try each digit 1–9</strong>

   `isSafe(row, col, d)` checks the row, the column and the 3 × 3 box.

3. <strong>Choose &amp; explore</strong>

   `board[row][col] = d`; if `solve()` returns `true`, propagate the success.

4. <strong>Un-choose</strong>

   Otherwise `board[row][col] = 0`. After all nine digits fail, return `false`.

```python filename:Python
def is_safe(board, row, col, d):
    for x in range(9):
        if board[row][x] == d or board[x][col] == d:     # same row or same column
            return False
    r0, c0 = row - row % 3, col - col % 3                # top-left corner of the 3×3 box
    for i in range(3):
        for j in range(3):
            if board[r0 + i][c0 + j] == d:
                return False
    return True

def solve(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:                     # first empty cell
                for d in range(1, 10):
                    if is_safe(board, row, col, d):
                        board[row][col] = d              # choose
                        if solve(board):                 # explore
                            return True
                        board[row][col] = 0              # un-choose
                return False                             # no digit fits here → backtrack
    return True                                          # no empty cell left — solved

board = [[5, 3, 0, 0, 7, 0, 0, 0, 0],
         [6, 0, 0, 1, 9, 5, 0, 0, 0],
         [0, 9, 8, 0, 0, 0, 0, 6, 0],
         [8, 0, 0, 0, 6, 0, 0, 0, 3],
         [4, 0, 0, 8, 0, 3, 0, 0, 1],
         [7, 0, 0, 0, 2, 0, 0, 0, 6],
         [0, 6, 0, 0, 0, 0, 2, 8, 0],
         [0, 0, 0, 4, 1, 9, 0, 0, 5],
         [0, 0, 0, 0, 8, 0, 0, 7, 9]]
if solve(board):
    for row in board:
        print(" ".join(map(str, row)))
else:
    print("No solution exists")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool isSafe(const vector<vector<int>>& b, int row, int col, int d) {
    for (int x = 0; x < 9; x++)
        if (b[row][x] == d || b[x][col] == d) return false;   // same row or same column
    int r0 = row - row % 3, c0 = col - col % 3;               // top-left corner of the 3×3 box
    for (int i = 0; i < 3; i++)
        for (int j = 0; j < 3; j++)
            if (b[r0 + i][c0 + j] == d) return false;
    return true;
}

bool solve(vector<vector<int>>& b) {
    for (int row = 0; row < 9; row++)
        for (int col = 0; col < 9; col++)
            if (b[row][col] == 0) {                           // first empty cell
                for (int d = 1; d <= 9; d++)
                    if (isSafe(b, row, col, d)) {
                        b[row][col] = d;                      // choose
                        if (solve(b)) return true;            // explore
                        b[row][col] = 0;                      // un-choose
                    }
                return false;                                 // no digit fits here → backtrack
            }
    return true;                                              // no empty cell left — solved
}

int main() {
    vector<vector<int>> board = {{5, 3, 0, 0, 7, 0, 0, 0, 0},
                                 {6, 0, 0, 1, 9, 5, 0, 0, 0},
                                 {0, 9, 8, 0, 0, 0, 0, 6, 0},
                                 {8, 0, 0, 0, 6, 0, 0, 0, 3},
                                 {4, 0, 0, 8, 0, 3, 0, 0, 1},
                                 {7, 0, 0, 0, 2, 0, 0, 0, 6},
                                 {0, 6, 0, 0, 0, 0, 2, 8, 0},
                                 {0, 0, 0, 4, 1, 9, 0, 0, 5},
                                 {0, 0, 0, 0, 8, 0, 0, 7, 9}};
    if (!solve(board)) { cout << "No solution exists\n"; return 0; }
    for (auto& row : board) {
        for (int j = 0; j < 9; j++) cout << (j ? " " : "") << row[j];
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static boolean isSafe(int[][] b, int row, int col, int d) {
        for (int x = 0; x < 9; x++)
            if (b[row][x] == d || b[x][col] == d) return false;   // same row or same column
        int r0 = row - row % 3, c0 = col - col % 3;               // top-left corner of the 3×3 box
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                if (b[r0 + i][c0 + j] == d) return false;
        return true;
    }

    static boolean solve(int[][] b) {
        for (int row = 0; row < 9; row++)
            for (int col = 0; col < 9; col++)
                if (b[row][col] == 0) {                           // first empty cell
                    for (int d = 1; d <= 9; d++)
                        if (isSafe(b, row, col, d)) {
                            b[row][col] = d;                      // choose
                            if (solve(b)) return true;            // explore
                            b[row][col] = 0;                      // un-choose
                        }
                    return false;                                 // no digit fits here → backtrack
                }
        return true;                                              // no empty cell left — solved
    }

    public static void main(String[] args) {
        int[][] board = {{5, 3, 0, 0, 7, 0, 0, 0, 0},
                         {6, 0, 0, 1, 9, 5, 0, 0, 0},
                         {0, 9, 8, 0, 0, 0, 0, 6, 0},
                         {8, 0, 0, 0, 6, 0, 0, 0, 3},
                         {4, 0, 0, 8, 0, 3, 0, 0, 1},
                         {7, 0, 0, 0, 2, 0, 0, 0, 6},
                         {0, 6, 0, 0, 0, 0, 2, 8, 0},
                         {0, 0, 0, 4, 1, 9, 0, 0, 5},
                         {0, 0, 0, 0, 8, 0, 0, 7, 9}};
        if (!solve(board)) { System.out.println("No solution exists"); return; }
        for (int[] row : board) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < 9; j++) sb.append(j > 0 ? " " : "").append(row[j]);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function isSafe(b, row, col, d) {
    for (let x = 0; x < 9; x++)
        if (b[row][x] === d || b[x][col] === d) return false;   // same row or same column
    const r0 = row - row % 3, c0 = col - col % 3;               // top-left corner of the 3×3 box
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (b[r0 + i][c0 + j] === d) return false;
    return true;
}

function solve(b) {
    for (let row = 0; row < 9; row++)
        for (let col = 0; col < 9; col++)
            if (b[row][col] === 0) {                            // first empty cell
                for (let d = 1; d <= 9; d++)
                    if (isSafe(b, row, col, d)) {
                        b[row][col] = d;                        // choose
                        if (solve(b)) return true;              // explore
                        b[row][col] = 0;                        // un-choose
                    }
                return false;                                   // no digit fits here → backtrack
            }
    return true;                                                // no empty cell left — solved
}

const board = [[5, 3, 0, 0, 7, 0, 0, 0, 0],
               [6, 0, 0, 1, 9, 5, 0, 0, 0],
               [0, 9, 8, 0, 0, 0, 0, 6, 0],
               [8, 0, 0, 0, 6, 0, 0, 0, 3],
               [4, 0, 0, 8, 0, 3, 0, 0, 1],
               [7, 0, 0, 0, 2, 0, 0, 0, 6],
               [0, 6, 0, 0, 0, 0, 2, 8, 0],
               [0, 0, 0, 4, 1, 9, 0, 0, 5],
               [0, 0, 0, 0, 8, 0, 0, 7, 9]];
if (!solve(board)) console.log("No solution exists");
else for (const row of board) console.log(row.join(" "));
```

```text filename:Output
5 3 4 6 7 8 9 1 2
6 7 2 1 9 5 3 4 8
1 9 8 3 4 2 5 6 7
8 5 9 7 6 1 4 2 3
4 2 6 8 5 3 7 9 1
7 1 3 9 2 4 8 5 6
9 6 1 5 3 7 2 8 4
2 8 7 4 1 9 6 3 5
3 4 5 2 8 6 1 7 9
```

Time O(9^m) worst case for m empty cells — pruning makes real puzzles fast · Space O(m) recursion depth

> [!NOTE] Optimisation
>
> Two cheap speed-ups: keep three `bool[9][10]` tables (`rowHas`, `colHas`, `boxHas`) so `isSafe` is `O(1)`, and fill the empty cell with the <strong>fewest candidates</strong> first (most-constrained-variable heuristic) so wrong guesses are discovered as early as possible.

> [!WARNING] Pitfall
>
> Returning `false` from the <em>loop over cells</em> only after trying all nine digits in the first empty cell is essential. A common bug is to `continue` scanning for other empty cells after the digits fail — that explores the board in the wrong order and reports unsolvable puzzles as solved.

# Interview Q&amp;A

```question
What is the difference between backtracking and plain recursion?

---

Plain recursive enumeration generates every candidate and tests complete ones. Backtracking tests <strong>partial</strong> candidates and abandons a branch as soon as it violates a constraint, so large parts of the recursion tree are never visited. Both have the same worst case; backtracking has a much better typical case.
```

```question
When is backtracking the right tool, and when is DP?

---

Backtracking fits <strong>constraint-satisfaction</strong> and <em>enumerate all solutions</em> problems: the sub-problems do not overlap and there is no optimal-substructure recurrence (N-Queens, Sudoku, subsets with a property, permutations). DP fits <strong>optimisation</strong> problems whose sub-problems overlap and can be memoised (knapsack, LCS, edit distance). If you find yourself solving the same sub-state many times in a backtracking search, memoise it — that is DP.
```

```question
Why must the state be restored exactly after the recursive call?

---

The loop that follows will try the next option on the same shared state. If a mark, a digit or a swap is left behind, later branches see a corrupted board and either miss valid solutions or report invalid ones. Rule of thumb: every mutation before the recursive call has a matching inverse right after it.
```

```question
How would you print all solutions of N-Queens rather than the first one?

---

Do not return on success — when `row == N`, record the board and simply return to the caller, which continues its loop. The code above already does this (`solutions.append(...)`), which is why it can report the count `2` for `N = 4`.
```

```question
What is the time complexity of backtracking for N-Queens?

---

Upper bound `O(N!)`: row 0 has `N` choices, row 1 at most `N − 1` columns are not attacked, and so on. The diagonal pruning removes most of those, but no polynomial bound is known — the problem of counting solutions is exponential in practice (92 solutions for N = 8, visited in a few thousand placements).
```
