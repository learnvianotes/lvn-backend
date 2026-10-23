---
id: 3585fdc9-bdd2-7e4e-a6c8-c50497c22d35
key: topic:dsa-advanced/dp
subject: dsa-advanced
topic: dp
title: Dynamic Programming
slug: dynamic-programming
order: 1
---

Dynamic Programming (DP) solves a problem by combining the solutions of its <strong>overlapping subproblems</strong>, computing each subproblem only once — either top-down with <strong>memoization</strong> or bottom-up with <strong>tabulation</strong>. It turns exponential recursions into polynomial algorithms.

> [!INFO]
>
> <strong>Dynamic Programming</strong> — an optimisation over plain recursion: when the same subproblem is reached again and again, store its answer the first time and reuse it instead of recomputing it. The stored answers form the <em>DP table</em>.

A problem is a DP problem when it has both of the following properties. Without overlapping subproblems you only have divide and conquer (merge sort); without optimal substructure the stored answers cannot be combined into a correct result.

> [!NOTE] Overlapping subproblems
>
> The recursion solves the same smaller instance many times — `fib(n-1)` and `fib(n-2)` both need `fib(n-3)`. Caching pays off only because of this repetition.

> [!NOTE] Optimal substructure
>
> The optimal answer for the whole problem is built from optimal answers of its subproblems: the shortest path `A→C` through `B` is a shortest path `A→B` plus a shortest path `B→C`.

# Memoization vs tabulation

Both techniques fill the same table; they differ in <em>who</em> decides the order of filling it.

|  | Memoization (top-down) | Tabulation (bottom-up) |
| --- | --- | --- |
| How | Keep the recursive function; before computing, look the state up in a memo; store the answer before returning | Replace recursion with loops that fill `dp[]` from the smallest states upwards |
| Order of states | Decided by the recursion — only states that are actually needed are computed | Fixed by the programmer — every state in the table is computed |
| Overhead | Function-call overhead and recursion depth (Python's limit is 1000 frames) | None — tight loops, cache-friendly, easy to space-optimise |
| When to prefer | Hard-to-order states (intervals, bitmasks), sparse state space | Most interview problems; when you need the whole table (printing the LCS, reconstructing the knapsack) |

1. <strong>Define the state</strong>

   What does `dp[i]` (or `dp[i][j]`) mean in words? e.g. `dp[i][j]` = length of the LCS of the first `i` characters of `s1` and the first `j` of `s2`.

2. <strong>Write the recurrence</strong>

   Express `dp[state]` through smaller states by looking at the <em>last choice</em> (take or skip the last item, match or not the last character).

3. <strong>Fix the base cases</strong>

   The smallest states whose answers are known without recursion: empty string, zero capacity, one element.

4. <strong>Pick an order</strong>

   Tabulate so every state's dependencies are already filled (increasing `i`, increasing length of interval), or memoize and let recursion choose.

5. <strong>Read the answer and optimise space</strong>

   The answer is usually `dp[n]` or `dp[n][m]`; if each row depends only on the previous one, keep two rows (or one).

# Where DP is used

> [!NOTE] Bellman-Ford
>
> Shortest paths with negative edges — `dist[v]` after `k` edges is built from `dist[u]` after `k-1` edges (see Graphs).

> [!NOTE] Floyd-Warshall
>
> All-pairs shortest paths — `d[i][j]` allowing intermediate vertices `0..k` uses the answers for `0..k-1`.

> [!NOTE] diff utility
>
> `git diff` / `diff` compute a <strong>Longest Common Subsequence</strong> and print the lines that are not in it.

> [!NOTE] Spell checking
>
> Suggesting the closest word is a small <strong>Edit Distance</strong> between the typed word and dictionary words.

> [!NOTE] Resource allocation
>
> Choosing projects within a budget for maximum profit is <strong>0-1 Knapsack</strong>.

> [!NOTE] Sequence alignment
>
> DNA / protein alignment in bioinformatics is edit distance with a scoring matrix.

# Fibonacci: the plain recursion

> [!TIP] Example
>
> <strong>Input:</strong> `n = 3`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `n = 10`<br><strong>Output:</strong> `55`

`fib(n) = fib(n-1) + fib(n-2)` with `fib(0) = 0`, `fib(1) = 1`. The direct recursive translation is correct but recomputes the same values over and over.

```python filename:Python
calls = 0

def fib(n):
    global calls
    calls += 1
    if n == 0 or n == 1:
        return n
    return fib(n - 1) + fib(n - 2)

print("fib(3) =", fib(3))
print("fib(5) =", fib(5), "with", calls - 5, "calls")      # calls made by fib(5) alone
calls = 0
print("fib(10) =", fib(10), "with", calls, "calls")
```

```text filename:Output
fib(3) = 2
fib(5) = 5 with 15 calls
fib(10) = 55 with 177 calls
```

```text filename:Recursion%20tree%20of%20fib(5)%3A%20fib(3)%20is%20computed%202%20times%2C%20fib(2)%203%20times%2C%20fib(1)%205%20times%20%E2%80%94%2015%20calls%20for%20a%205-number%20answer
                        fib(5)
                   /             \
              fib(4)              fib(3)
             /      \             /     \
         fib(3)    fib(2)      fib(2)   fib(1)
        /     \    /    \      /    \
    fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
    /    \
fib(1)  fib(0)
```

Observations on the tree: the same subproblems appear repeatedly (`fib(3)` twice, `fib(2)` three times), and the number of calls roughly doubles with every extra level — `O(2^n)` time, `fib(40)` already needs about 330 million calls.

`T(n) = T(n-1) + T(n-2) + O(1) ⇒ T(n) = O(φⁿ) ≈ O(1.618ⁿ)`

# Fibonacci with memoization (top-down)

> [!NOTE] Idea
>
> Keep the recursion, but <strong>store every answer the first time it is computed</strong> and check the memo before recursing. Each `fib(k)` is then computed once, and every other call to it returns immediately, so there are at most `2n-1` calls instead of `O(2^n)`.

```python filename:Python
memo = [-1] * 100           # -1 = not computed yet
calls = 0

def fib(n):
    global calls
    calls += 1
    if memo[n] != -1:        # already solved → reuse
        return memo[n]
    if n == 0 or n == 1:
        memo[n] = n
    else:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print("fib(3) =", fib(3))
memo = [-1] * 100
calls = 0
print("fib(10) =", fib(10), "with", calls, "calls")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<long long> memo(100, -1);   // -1 = not computed yet
int calls = 0;

long long fib(int n) {
    calls++;
    if (memo[n] != -1) return memo[n];       // already solved → reuse
    if (n == 0 || n == 1) memo[n] = n;
    else memo[n] = fib(n - 1) + fib(n - 2);
    return memo[n];
}

int main() {
    cout << "fib(3) = " << fib(3) << "\n";
    memo.assign(100, -1);
    calls = 0;
    cout << "fib(10) = " << fib(10) << " with " << calls << " calls\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static long[] memo = new long[100];   // -1 = not computed yet
    static int calls = 0;

    static long fib(int n) {
        calls++;
        if (memo[n] != -1) return memo[n];   // already solved → reuse
        if (n == 0 || n == 1) memo[n] = n;
        else memo[n] = fib(n - 1) + fib(n - 2);
        return memo[n];
    }

    public static void main(String[] args) {
        Arrays.fill(memo, -1);
        System.out.println("fib(3) = " + fib(3));
        Arrays.fill(memo, -1);
        calls = 0;
        System.out.println("fib(10) = " + fib(10) + " with " + calls + " calls");
    }
}
```

```javascript filename:JavaScript
let memo = new Array(100).fill(-1);   // -1 = not computed yet
let calls = 0;

function fib(n) {
    calls++;
    if (memo[n] !== -1) return memo[n];   // already solved → reuse
    if (n === 0 || n === 1) memo[n] = n;
    else memo[n] = fib(n - 1) + fib(n - 2);
    return memo[n];
}

console.log("fib(3) =", fib(3));
memo = new Array(100).fill(-1);
calls = 0;
console.log(`fib(10) = ${fib(10)} with ${calls} calls`);
```

```text filename:Output
fib(3) = 2
fib(10) = 55 with 19 calls
```

Time O(n) · Space O(n) memo + O(n) recursion stack

> [!NOTE] Key point
>
> Exactly `2n-1` calls for `n ≥ 1`: one <em>computing</em> call per value `fib(0)..fib(n)` (`n+1` calls) plus one <em>memo hit</em> for each of the `n-1` second children. For `n = 10` that is 19 calls instead of 177.

# Fibonacci with tabulation (bottom-up)

> [!NOTE] Idea
>
> Fill `dp[0..n]` from the smallest value upwards: `dp[i] = dp[i-1] + dp[i-2]`. No recursion, no memo lookups — just one loop, and because only the last two values are read you can shrink the table to two variables.

```python filename:Python
def fib_table(n):
    dp = [0] * (n + 1)
    dp[0] = 0
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]     # each value is computed exactly once
    return dp

def fib_space(n):                         # keep only the last two values
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

dp = fib_table(10)
print("dp:", " ".join(str(x) for x in dp))
print("fib(10) =", dp[10])
print("fib(10) with O(1) space =", fib_space(10))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<long long> fibTable(int n) {
    vector<long long> dp(n + 1);
    dp[0] = 0;
    dp[1] = 1;
    for (int i = 2; i <= n; i++)
        dp[i] = dp[i - 1] + dp[i - 2];    // each value is computed exactly once
    return dp;
}

long long fibSpace(int n) {               // keep only the last two values
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) { long long t = a + b; a = b; b = t; }
    return a;
}

int main() {
    vector<long long> dp = fibTable(10);
    cout << "dp:";
    for (long long x : dp) cout << " " << x;
    cout << "\n";
    cout << "fib(10) = " << dp[10] << "\n";
    cout << "fib(10) with O(1) space = " << fibSpace(10) << "\n";
}
```

```java filename:Java
public class Main {
    static long[] fibTable(int n) {
        long[] dp = new long[n + 1];
        dp[0] = 0;
        dp[1] = 1;
        for (int i = 2; i <= n; i++)
            dp[i] = dp[i - 1] + dp[i - 2];    // each value is computed exactly once
        return dp;
    }

    static long fibSpace(int n) {             // keep only the last two values
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
        return a;
    }

    public static void main(String[] args) {
        long[] dp = fibTable(10);
        StringBuilder sb = new StringBuilder("dp:");
        for (long x : dp) sb.append(" ").append(x);
        System.out.println(sb);
        System.out.println("fib(10) = " + dp[10]);
        System.out.println("fib(10) with O(1) space = " + fibSpace(10));
    }
}
```

```javascript filename:JavaScript
function fibTable(n) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = 0;
    dp[1] = 1;
    for (let i = 2; i <= n; i++)
        dp[i] = dp[i - 1] + dp[i - 2];    // each value is computed exactly once
    return dp;
}

function fibSpace(n) {                    // keep only the last two values
    let a = 0, b = 1;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
}

const dp = fibTable(10);
console.log("dp:", dp.join(" "));
console.log("fib(10) =", dp[10]);
console.log("fib(10) with O(1) space =", fibSpace(10));
```

```text filename:Output
dp: 0 1 1 2 3 5 8 13 21 34 55
fib(10) = 55
fib(10) with O(1) space = 55
```

Time O(n) · Space O(n) for the table, O(1) with two variables

> [!WARNING] Pitfall
>
> `dp[1] = 1` fails with an index error when `n = 0` (the table has one cell). Guard tiny inputs before touching the table — base cases are where most DP bugs live.

# Longest Common Subsequence (LCS)

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "ABCDGH", s2 = "AEDFHR"`<br><strong>Output:</strong> `3 (the subsequence "ADH")`<br><strong>Input:</strong> `s1 = "xyz", s2 = "xyz"`<br><strong>Output:</strong> `3`

A <em>subsequence</em> keeps the relative order but need not be contiguous. The LCS of two strings is the longest string that is a subsequence of both. It is the heart of `diff`, of plagiarism checkers and of DNA alignment.

> [!NOTE] Idea
>
> Look at the <strong>last characters</strong>. If they are equal, they belong to the LCS and the problem shrinks on both sides. If not, at least one of them is not in the LCS — drop the last character of `s1` <em>or</em> of `s2` and take the better result. `lcs(n, m)` means the LCS of the first `n` characters of `s1` and the first `m` of `s2`.

`lcs(n, m) = 0 if n = 0 or m = 0; = 1 + lcs(n-1, m-1) if s1[n-1] = s2[m-1]; = max(lcs(n-1, m), lcs(n, m-1)) otherwise`

The plain recursion is exponential (`O(2^(n+m))`) because `lcs(n-1, m)` and `lcs(n, m-1)` both call `lcs(n-1, m-1)` — the overlapping subproblems that DP removes. There are only `(n+1)(m+1)` distinct states.

```python filename:Python
def lcs_rec(s1, s2, n, m):
    if n == 0 or m == 0:
        return 0
    if s1[n - 1] == s2[m - 1]:
        return 1 + lcs_rec(s1, s2, n - 1, m - 1)
    return max(lcs_rec(s1, s2, n - 1, m), lcs_rec(s1, s2, n, m - 1))

print(lcs_rec("ABCDGH", "AEDFHR", 6, 6))
print(lcs_rec("xyz", "xyz", 3, 3))
```

```text filename:Output
3
3
```

<strong>Memoization</strong> keeps this function and adds a 2-D memo indexed by `(n, m)`; `-1` marks a state that has not been computed.

```python filename:Python
def lcs_memo(s1, s2):
    n, m = len(s1), len(s2)
    memo = [[-1] * (m + 1) for _ in range(n + 1)]

    def solve(i, j):
        if memo[i][j] != -1:
            return memo[i][j]
        if i == 0 or j == 0:
            memo[i][j] = 0
        elif s1[i - 1] == s2[j - 1]:
            memo[i][j] = 1 + solve(i - 1, j - 1)
        else:
            memo[i][j] = max(solve(i - 1, j), solve(i, j - 1))
        return memo[i][j]

    return solve(n, m)

for a, b in [("ABCDGH", "AEDFHR"), ("xyz", "xyz")]:
    print(f"LCS({a}, {b}) = {lcs_memo(a, b)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

string s1, s2;
vector<vector<int>> memo;

int solve(int i, int j) {
    if (memo[i][j] != -1) return memo[i][j];
    if (i == 0 || j == 0) memo[i][j] = 0;
    else if (s1[i - 1] == s2[j - 1]) memo[i][j] = 1 + solve(i - 1, j - 1);
    else memo[i][j] = max(solve(i - 1, j), solve(i, j - 1));
    return memo[i][j];
}

int lcsMemo(const string& a, const string& b) {
    s1 = a; s2 = b;
    memo.assign(a.size() + 1, vector<int>(b.size() + 1, -1));
    return solve((int)a.size(), (int)b.size());
}

int main() {
    cout << "LCS(ABCDGH, AEDFHR) = " << lcsMemo("ABCDGH", "AEDFHR") << "\n";
    cout << "LCS(xyz, xyz) = " << lcsMemo("xyz", "xyz") << "\n";
}
```

```java filename:Java
public class Main {
    static String s1, s2;
    static int[][] memo;

    static int solve(int i, int j) {
        if (memo[i][j] != -1) return memo[i][j];
        if (i == 0 || j == 0) memo[i][j] = 0;
        else if (s1.charAt(i - 1) == s2.charAt(j - 1)) memo[i][j] = 1 + solve(i - 1, j - 1);
        else memo[i][j] = Math.max(solve(i - 1, j), solve(i, j - 1));
        return memo[i][j];
    }

    static int lcsMemo(String a, String b) {
        s1 = a; s2 = b;
        memo = new int[a.length() + 1][b.length() + 1];
        for (int[] row : memo) java.util.Arrays.fill(row, -1);
        return solve(a.length(), b.length());
    }

    public static void main(String[] args) {
        System.out.println("LCS(ABCDGH, AEDFHR) = " + lcsMemo("ABCDGH", "AEDFHR"));
        System.out.println("LCS(xyz, xyz) = " + lcsMemo("xyz", "xyz"));
    }
}
```

```javascript filename:JavaScript
function lcsMemo(s1, s2) {
    const n = s1.length, m = s2.length;
    const memo = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1));

    function solve(i, j) {
        if (memo[i][j] !== -1) return memo[i][j];
        if (i === 0 || j === 0) memo[i][j] = 0;
        else if (s1[i - 1] === s2[j - 1]) memo[i][j] = 1 + solve(i - 1, j - 1);
        else memo[i][j] = Math.max(solve(i - 1, j), solve(i, j - 1));
        return memo[i][j];
    }

    return solve(n, m);
}

for (const [a, b] of [["ABCDGH", "AEDFHR"], ["xyz", "xyz"]])
    console.log(`LCS(${a}, ${b}) = ${lcsMemo(a, b)}`);
```

```text filename:Output
LCS(ABCDGH, AEDFHR) = 3
LCS(xyz, xyz) = 3
```

Time O(n·m) · Space O(n·m) memo + O(n+m) recursion depth

<strong>Tabulation</strong> fills the same table row by row. `dp[i][j]` is the LCS length of `s1[0..i)` and `s2[0..j)`; row 0 and column 0 are the empty-prefix base cases, and every cell is derived from its upper-left, upper or left neighbour.

```text filename:LCS%20table%20for%20s1%20%3D%20%22ABCDGH%22%20(rows)%20and%20s2%20%3D%20%22AEDFHR%22%20(columns)%3A%20the%201%2C%202%2C%203%20steps%20appear%20at%20the%20matches%20A%2C%20D%2C%20H
     ""   A   E   D   F   H   R
""    0   0   0   0   0   0   0
 A    0   1   1   1   1   1   1
 B    0   1   1   1   1   1   1
 C    0   1   1   1   1   1   1
 D    0   1   1   2   2   2   2
 G    0   1   1   2   2   2   2
 H    0   1   1   2   2   3   3   ← dp[6][6] = 3
```

```python filename:Python
def lcs(s1, s2):
    n, m = len(s1), len(s2)
    dp = [[0] * (m + 1) for _ in range(n + 1)]    # row 0 / column 0 stay 0 (empty prefix)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if s1[i - 1] == s2[j - 1]:              # table is 1-indexed, strings 0-indexed
                dp[i][j] = 1 + dp[i - 1][j - 1]
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[n][m]

for a, b in [("ABCDGH", "AEDFHR"), ("xyz", "xyz"), ("AGGTAB", "GXTXAYB")]:
    print(f"LCS({a}, {b}) = {lcs(a, b)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int lcs(const string& s1, const string& s2) {
    int n = s1.size(), m = s2.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));   // row 0 / column 0 stay 0
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            if (s1[i - 1] == s2[j - 1])                       // table 1-indexed, strings 0-indexed
                dp[i][j] = 1 + dp[i - 1][j - 1];
            else
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
    return dp[n][m];
}

int main() {
    pair<string, string> tests[] = {{"ABCDGH", "AEDFHR"}, {"xyz", "xyz"}, {"AGGTAB", "GXTXAYB"}};
    for (auto& [a, b] : tests)
        cout << "LCS(" << a << ", " << b << ") = " << lcs(a, b) << "\n";
}
```

```java filename:Java
public class Main {
    static int lcs(String s1, String s2) {
        int n = s1.length(), m = s2.length();
        int[][] dp = new int[n + 1][m + 1];          // row 0 / column 0 stay 0 (empty prefix)
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= m; j++)
                if (s1.charAt(i - 1) == s2.charAt(j - 1))   // table 1-indexed, strings 0-indexed
                    dp[i][j] = 1 + dp[i - 1][j - 1];
                else
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        return dp[n][m];
    }

    public static void main(String[] args) {
        String[][] tests = {{"ABCDGH", "AEDFHR"}, {"xyz", "xyz"}, {"AGGTAB", "GXTXAYB"}};
        for (String[] t : tests)
            System.out.println("LCS(" + t[0] + ", " + t[1] + ") = " + lcs(t[0], t[1]));
    }
}
```

```javascript filename:JavaScript
function lcs(s1, s2) {
    const n = s1.length, m = s2.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0)); // row 0 / column 0 stay 0
    for (let i = 1; i <= n; i++)
        for (let j = 1; j <= m; j++)
            if (s1[i - 1] === s2[j - 1])                 // table 1-indexed, strings 0-indexed
                dp[i][j] = 1 + dp[i - 1][j - 1];
            else
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    return dp[n][m];
}

for (const [a, b] of [["ABCDGH", "AEDFHR"], ["xyz", "xyz"], ["AGGTAB", "GXTXAYB"]])
    console.log(`LCS(${a}, ${b}) = ${lcs(a, b)}`);
```

```text filename:Output
LCS(ABCDGH, AEDFHR) = 3
LCS(xyz, xyz) = 3
LCS(AGGTAB, GXTXAYB) = 4
```

Time O(n·m) · Space O(n·m), or O(min(n, m)) keeping two rows

> [!WARNING] Pitfall
>
> The table has one extra row and column for the empty prefix, so `dp[i][j]` compares `s1[i-1]` with `s2[j-1]` — <strong>not</strong> `s1[i]`. Mixing the 1-indexed table with the 0-indexed strings is the most common LCS bug (and the reason the original edit-distance notes compared `s1[m-1]` with `s2[m-1]`).

# Printing the LCS

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "ABCDGH", s2 = "AEDFHR"`<br><strong>Output:</strong> `"ADH"`<br><strong>Input:</strong> `s1 = "AGGTAB", s2 = "GXTXAYB"`<br><strong>Output:</strong> `"GTAB"`

> [!NOTE] Idea
>
> The filled table remembers <em>how</em> each cell was produced. Walk back from `dp[n][m]`: if the characters match, that character is in the LCS — move diagonally; otherwise move to whichever neighbour (up or left) holds the larger value. The characters collected in reverse form the LCS.

```python filename:Python
def print_lcs(s1, s2):
    n, m = len(s1), len(s2)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = 1 + dp[i - 1][j - 1]
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    res = []
    i, j = n, m
    while i > 0 and j > 0:                 # walk back from the bottom-right cell
        if s1[i - 1] == s2[j - 1]:
            res.append(s1[i - 1])          # match → part of the LCS
            i -= 1; j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1                         # came from above
        else:
            j -= 1                         # came from the left
    return "".join(reversed(res))

print("LCS of ABCDGH and AEDFHR:", print_lcs("ABCDGH", "AEDFHR"))
print("LCS of AGGTAB and GXTXAYB:", print_lcs("AGGTAB", "GXTXAYB"))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

string printLcs(const string& s1, const string& s2) {
    int n = s1.size(), m = s2.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            dp[i][j] = s1[i - 1] == s2[j - 1] ? 1 + dp[i - 1][j - 1] : max(dp[i - 1][j], dp[i][j - 1]);
    string res;
    int i = n, j = m;
    while (i > 0 && j > 0) {                   // walk back from the bottom-right cell
        if (s1[i - 1] == s2[j - 1]) { res += s1[i - 1]; i--; j--; }   // match → part of the LCS
        else if (dp[i - 1][j] >= dp[i][j - 1]) i--;                  // came from above
        else j--;                                                    // came from the left
    }
    reverse(res.begin(), res.end());
    return res;
}

int main() {
    cout << "LCS of ABCDGH and AEDFHR: " << printLcs("ABCDGH", "AEDFHR") << "\n";
    cout << "LCS of AGGTAB and GXTXAYB: " << printLcs("AGGTAB", "GXTXAYB") << "\n";
}
```

```java filename:Java
public class Main {
    static String printLcs(String s1, String s2) {
        int n = s1.length(), m = s2.length();
        int[][] dp = new int[n + 1][m + 1];
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= m; j++)
                dp[i][j] = s1.charAt(i - 1) == s2.charAt(j - 1) ? 1 + dp[i - 1][j - 1]
                                                                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        StringBuilder res = new StringBuilder();
        int i = n, j = m;
        while (i > 0 && j > 0) {                    // walk back from the bottom-right cell
            if (s1.charAt(i - 1) == s2.charAt(j - 1)) { res.append(s1.charAt(i - 1)); i--; j--; }
            else if (dp[i - 1][j] >= dp[i][j - 1]) i--;   // came from above
            else j--;                                     // came from the left
        }
        return res.reverse().toString();
    }

    public static void main(String[] args) {
        System.out.println("LCS of ABCDGH and AEDFHR: " + printLcs("ABCDGH", "AEDFHR"));
        System.out.println("LCS of AGGTAB and GXTXAYB: " + printLcs("AGGTAB", "GXTXAYB"));
    }
}
```

```javascript filename:JavaScript
function printLcs(s1, s2) {
    const n = s1.length, m = s2.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++)
        for (let j = 1; j <= m; j++)
            dp[i][j] = s1[i - 1] === s2[j - 1] ? 1 + dp[i - 1][j - 1] : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const res = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {                    // walk back from the bottom-right cell
        if (s1[i - 1] === s2[j - 1]) { res.push(s1[i - 1]); i--; j--; }   // match → part of the LCS
        else if (dp[i - 1][j] >= dp[i][j - 1]) i--;                      // came from above
        else j--;                                                        // came from the left
    }
    return res.reverse().join("");
}

console.log("LCS of ABCDGH and AEDFHR:", printLcs("ABCDGH", "AEDFHR"));
console.log("LCS of AGGTAB and GXTXAYB:", printLcs("AGGTAB", "GXTXAYB"));
```

```text filename:Output
LCS of ABCDGH and AEDFHR: ADH
LCS of AGGTAB and GXTXAYB: GTAB
```

Time O(n·m) · Space O(n·m) — the full table is needed to walk back

# Variations of LCS

Many string problems are LCS in disguise. Compute the LCS length `L` (or the table) and derive the answer:

| Problem | Reduction |
| --- | --- |
| diff utility | Lines that are not part of the LCS of the two files are the lines that were added or removed |
| Minimum insertions and deletions to convert `s1` into `s2` | deletions = `len(s1) - L`, insertions = `len(s2) - L` — keep the LCS, remove everything else of `s1`, insert the rest of `s2` |
| Shortest common supersequence | length = `len(s1) + len(s2) - L` (the LCS characters are shared, everything else is interleaved) |
| Longest palindromic subsequence | `LCS(s, reverse(s))` |
| Longest repeating subsequence | `LCS(s, s)` with the extra rule that a character may not match itself (`i != j`) |
| Space-optimised LCS | Each row needs only the previous row: two arrays of size `m+1`, `O(min(n, m))` space |
| Printing the LCS | Walk back through the table from `dp[n][m]` as shown above |

# Coin Change: count the ways

> [!TIP] Example
>
> <strong>Input:</strong> `coins = [1, 2, 3], sum = 4`<br><strong>Output:</strong> `4 → 1+1+1+1, 1+1+2, 2+2, 1+3`<br><strong>Input:</strong> `coins = [2, 5, 3, 6], sum = 10`<br><strong>Output:</strong> `5`

Count the number of <strong>combinations</strong> (order does not matter) of the given coins — each usable any number of times — that add up to `sum`.

> [!NOTE] Idea
>
> For the last coin there are two choices: <strong>use it</strong> (sum shrinks by its value, the same coin stays available) or <strong>never use it again</strong> (move to the previous coin). The answer is the sum of the two. `ways(n, s)` = number of ways to make `s` with the first `n` coins.

`ways(n, s) = ways(n, s - coins[n-1]) + ways(n-1, s); ways(n, 0) = 1, ways(0, s>0) = 0, ways(n, s<0) = 0`

```python filename:Python
def count_ways(coins, n, s):
    if s == 0:
        return 1              # one way to make 0: take nothing
    if s < 0 or n == 0:
        return 0
    return count_ways(coins, n, s - coins[n - 1]) + count_ways(coins, n - 1, s)

print(count_ways([1, 2, 3], 3, 4))
```

```text filename:Output
4
```

Tabulated: `dp[i][j]` = ways to make `j` using the first `i` coins. Column 0 is 1 for every row (the empty combination). The “use it” term reads the <em>same</em> row `dp[i][j - coin]` because the coin stays available — that is what makes this the <em>unbounded</em> version.

```text filename:dp%5Bi%5D%5Bj%5D%20%3D%20dp%5Bi-1%5D%5Bj%5D%20%2B%20dp%5Bi%5D%5Bj%20-%20coin%5D%3A%20e.g.%20dp%5B3%5D%5B4%5D%20%3D%20dp%5B2%5D%5B4%5D%20%2B%20dp%5B3%5D%5B1%5D%20%3D%203%20%2B%201
               sum:  0   1   2   3   4
no coins              1   0   0   0   0
{1}                   1   1   1   1   1
{1,2}                 1   1   2   2   3
{1,2,3}               1   1   2   3   4   ← dp[3][4] = 4
```

```python filename:Python
def count_ways(coins, s):
    n = len(coins)
    dp = [[0] * (s + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = 1                               # sum 0: the empty combination
    for i in range(1, n + 1):
        for j in range(1, s + 1):
            dp[i][j] = dp[i - 1][j]                # skip coin i
            if j >= coins[i - 1]:
                dp[i][j] += dp[i][j - coins[i - 1]]   # use coin i (same row: unlimited supply)
    return dp[n][s]

for coins, s in [([1, 2, 3], 4), ([2, 5, 3, 6], 10)]:
    print("coins", " ".join(map(str, coins)) + ", sum", str(s) + ":", count_ways(coins, s), "ways")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

long long countWays(const vector<int>& coins, int s) {
    int n = coins.size();
    vector<vector<long long>> dp(n + 1, vector<long long>(s + 1, 0));
    for (int i = 0; i <= n; i++) dp[i][0] = 1;          // sum 0: the empty combination
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= s; j++) {
            dp[i][j] = dp[i - 1][j];                    // skip coin i
            if (j >= coins[i - 1]) dp[i][j] += dp[i][j - coins[i - 1]];   // use coin i (same row)
        }
    return dp[n][s];
}

void show(const vector<int>& coins, int s) {
    cout << "coins";
    for (int c : coins) cout << " " << c;
    cout << ", sum " << s << ": " << countWays(coins, s) << " ways\n";
}

int main() {
    show({1, 2, 3}, 4);
    show({2, 5, 3, 6}, 10);
}
```

```java filename:Java
public class Main {
    static long countWays(int[] coins, int s) {
        int n = coins.length;
        long[][] dp = new long[n + 1][s + 1];
        for (int i = 0; i <= n; i++) dp[i][0] = 1;      // sum 0: the empty combination
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= s; j++) {
                dp[i][j] = dp[i - 1][j];                // skip coin i
                if (j >= coins[i - 1]) dp[i][j] += dp[i][j - coins[i - 1]];   // use coin i (same row)
            }
        return dp[n][s];
    }

    static void show(int[] coins, int s) {
        StringBuilder sb = new StringBuilder("coins");
        for (int c : coins) sb.append(" ").append(c);
        System.out.println(sb + ", sum " + s + ": " + countWays(coins, s) + " ways");
    }

    public static void main(String[] args) {
        show(new int[]{1, 2, 3}, 4);
        show(new int[]{2, 5, 3, 6}, 10);
    }
}
```

```javascript filename:JavaScript
function countWays(coins, s) {
    const n = coins.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(s + 1).fill(0));
    for (let i = 0; i <= n; i++) dp[i][0] = 1;          // sum 0: the empty combination
    for (let i = 1; i <= n; i++)
        for (let j = 1; j <= s; j++) {
            dp[i][j] = dp[i - 1][j];                    // skip coin i
            if (j >= coins[i - 1]) dp[i][j] += dp[i][j - coins[i - 1]];   // use coin i (same row)
        }
    return dp[n][s];
}

for (const [coins, s] of [[[1, 2, 3], 4], [[2, 5, 3, 6], 10]])
    console.log(`coins ${coins.join(" ")}, sum ${s}: ${countWays(coins, s)} ways`);
```

```text filename:Output
coins 1 2 3, sum 4: 4 ways
coins 2 5 3 6, sum 10: 5 ways
```

Time O(n·sum) · Space O(n·sum), or O(sum) with one row

> [!WARNING] Pitfall
>
> With a single 1-D array the <strong>loop order matters</strong>: coins outer, sums inner counts <em>combinations</em> (`{1,3}` once); sums outer, coins inner counts <em>permutations</em> (`1+3` and `3+1` separately). Interviewers ask exactly this.

# Edit Distance

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "CAT", s2 = "CUT"`<br><strong>Output:</strong> `1 (replace A with U)`<br><strong>Input:</strong> `s1 = "sunday", s2 = "saturday"`<br><strong>Output:</strong> `3`

The minimum number of single-character <strong>insertions, deletions and replacements</strong> that turn `s1` into `s2` (Levenshtein distance). It powers spell checkers and fuzzy search.

> [!NOTE] Idea
>
> Compare the last characters. Equal → they cost nothing, solve for both prefixes. Different → one operation is needed, and it is one of: insert (`s2` shrinks), delete (`s1` shrinks) or replace (both shrink); take the cheapest. Turning a string into an empty one costs its length.

`ed(m, n) = ed(m-1, n-1) if s1[m-1] = s2[n-1]; = 1 + min(ed(m, n-1), ed(m-1, n), ed(m-1, n-1)) otherwise; ed(m, 0) = m, ed(0, n) = n`

```text filename:Edit-distance%20table%20for%20%22CAT%22%20%E2%86%92%20%22CUT%22%3A%20row%200%20%2F%20column%200%20are%20the%20lengths%3B%20the%20diagonal%200%20%E2%86%92%201%20%E2%86%92%201%20shows%20C%20matches%2C%20A%20is%20replaced%2C%20T%20matches
     ""   C   U   T
""    0   1   2   3
 C    1   0   1   2
 A    2   1   1   2
 T    3   2   2   1   ← dp[3][3] = 1
```

```python filename:Python
def edit_distance(s1, s2):
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i                          # delete all i characters
    for j in range(n + 1):
        dp[0][j] = j                          # insert all j characters
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]   # free match
            else:                             # insert, delete, replace
                dp[i][j] = 1 + min(dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1])
    return dp[m][n]

for a, b in [("CAT", "CUT"), ("sunday", "saturday"), ("kitten", "sitting")]:
    print(f"{a} -> {b}: {edit_distance(a, b)}")
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int editDistance(const string& s1, const string& s2) {
    int m = s1.size(), n = s2.size();
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));
    for (int i = 0; i <= m; i++) dp[i][0] = i;     // delete all i characters
    for (int j = 0; j <= n; j++) dp[0][j] = j;     // insert all j characters
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            if (s1[i - 1] == s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];    // free match
            else dp[i][j] = 1 + min({dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1]});   // insert, delete, replace
    return dp[m][n];
}

int main() {
    pair<string, string> tests[] = {{"CAT", "CUT"}, {"sunday", "saturday"}, {"kitten", "sitting"}};
    for (auto& [a, b] : tests) cout << a << " -> " << b << ": " << editDistance(a, b) << "\n";
}
```

```java filename:Java
public class Main {
    static int editDistance(String s1, String s2) {
        int m = s1.length(), n = s2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;     // delete all i characters
        for (int j = 0; j <= n; j++) dp[0][j] = j;     // insert all j characters
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++)
                if (s1.charAt(i - 1) == s2.charAt(j - 1)) dp[i][j] = dp[i - 1][j - 1];   // free match
                else dp[i][j] = 1 + Math.min(dp[i][j - 1], Math.min(dp[i - 1][j], dp[i - 1][j - 1]));
        return dp[m][n];
    }

    public static void main(String[] args) {
        String[][] tests = {{"CAT", "CUT"}, {"sunday", "saturday"}, {"kitten", "sitting"}};
        for (String[] t : tests) System.out.println(t[0] + " -> " + t[1] + ": " + editDistance(t[0], t[1]));
    }
}
```

```javascript filename:JavaScript
function editDistance(s1, s2) {
    const m = s1.length, n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;     // delete all i characters
    for (let j = 0; j <= n; j++) dp[0][j] = j;     // insert all j characters
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];   // free match
            else dp[i][j] = 1 + Math.min(dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1]);   // insert, delete, replace
    return dp[m][n];
}

for (const [a, b] of [["CAT", "CUT"], ["sunday", "saturday"], ["kitten", "sitting"]])
    console.log(`${a} -> ${b}: ${editDistance(a, b)}`);
```

```text filename:Output
CAT -> CUT: 1
sunday -> saturday: 3
kitten -> sitting: 3
```

Time O(m·n) · Space O(m·n), or O(n) with two rows

> [!WARNING] Pitfall
>
> The original notes compared `s1[m-1]` with `s2[m-1]` in the recursive version — a classic copy-paste slip that only shows up when the strings have different lengths. Always index `s1` with the first dimension and `s2` with the second.

# Longest Increasing Subsequence (LIS)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 4, 2, 8, 10]`<br><strong>Output:</strong> `4 (3, 4, 8, 10)`<br><strong>Input:</strong> `arr = [10, 9, 2, 5, 3, 7, 101, 18]`<br><strong>Output:</strong> `4 (2, 3, 7, 101)`

> [!NOTE] Idea
>
> Let `lis[i]` be the length of the longest increasing subsequence that <strong>ends exactly at index </strong><strong>`i`</strong>. Every such subsequence either consists of `arr[i]` alone (length 1) or extends a subsequence ending at some earlier `j` with `arr[j] < arr[i]`. The answer is the largest `lis[i]`, not `lis[n-1]`.

`lis[i] = 1 + max{ lis[j] : j < i and arr[j] < arr[i] } (or 1 if no such j); answer = max lis[i]`

```text filename:lis%5B3%5D%20%3D%203%20because%208%20extends%20the%20subsequence%20ending%20at%204%20(lis%20%3D%202)%3B%20lis%5B2%5D%20%3D%201%20because%20nothing%20before%202%20is%20smaller
index:  0   1   2   3   4
arr:    3   4   2   8  10
lis:    1   2   1   3   4   ← max = 4
```

```python filename:Python
def lis(arr):
    n = len(arr)
    dp = [1] * n                              # every element alone is a subsequence
    for i in range(1, n):
        for j in range(i):
            if arr[j] < arr[i]:               # arr[i] can extend the LIS ending at j
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)                            # the LIS can end anywhere

for arr in [[3, 4, 2, 8, 10], [10, 9, 2, 5, 3, 7, 101, 18]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", lis(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int lis(const vector<int>& arr) {
    int n = arr.size();
    vector<int> dp(n, 1);                     // every element alone is a subsequence
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i])              // arr[i] can extend the LIS ending at j
                dp[i] = max(dp[i], dp[j] + 1);
    return *max_element(dp.begin(), dp.end());   // the LIS can end anywhere
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << lis(arr) << "\n";
}

int main() {
    show({3, 4, 2, 8, 10});
    show({10, 9, 2, 5, 3, 7, 101, 18});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int lis(int[] arr) {
        int n = arr.length;
        int[] dp = new int[n];
        Arrays.fill(dp, 1);                       // every element alone is a subsequence
        int best = 1;
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++)
                if (arr[j] < arr[i])              // arr[i] can extend the LIS ending at j
                    dp[i] = Math.max(dp[i], dp[j] + 1);
            best = Math.max(best, dp[i]);         // the LIS can end anywhere
        }
        return best;
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 4, 2, 8, 10}, {10, 9, 2, 5, 3, 7, 101, 18}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + lis(arr));
    }
}
```

```javascript filename:JavaScript
function lis(arr) {
    const n = arr.length;
    const dp = new Array(n).fill(1);          // every element alone is a subsequence
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (arr[j] < arr[i])              // arr[i] can extend the LIS ending at j
                dp[i] = Math.max(dp[i], dp[j] + 1);
    return Math.max(...dp);                   // the LIS can end anywhere
}

for (const arr of [[3, 4, 2, 8, 10], [10, 9, 2, 5, 3, 7, 101, 18]])
    console.log(`[${arr.join(", ")}] -> ${lis(arr)}`);
```

```text filename:Output
[3, 4, 2, 8, 10] -> 4
[10, 9, 2, 5, 3, 7, 101, 18] -> 4
```

Time O(n²) · Space O(n)

> [!WARNING] Pitfall
>
> Returning `dp[n-1]` instead of `max(dp)` — the longest subsequence does not have to end at the last element (`[1, 2, 3, 0]` has LIS 3 but `dp[3] = 1`).

# LIS in O(n log n)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [8, 100, 150, 10, 12, 14, 110]`<br><strong>Output:</strong> `5 (8, 10, 12, 14, 110)`<br><strong>Input:</strong> `arr = [3, 4, 2, 8, 10]`<br><strong>Output:</strong> `4`

> [!NOTE] Idea
>
> Keep an array `tail` where `tail[k]` is the <strong>smallest possible last element of an increasing subsequence of length </strong><strong>`k+1`</strong>. Scan the array: if `x` is larger than every tail, it extends the longest subsequence — append it; otherwise it replaces the first tail that is `≥ x` (found by binary search, a <em>ceiling</em> / `lower_bound`), because a smaller tail of that length makes future extensions easier. `tail` stays sorted, and its length is the LIS length.

```text filename:tail%5B%5D%20is%20not%20the%20LIS%20itself%20(8%2C10%2C12%2C14%2C110%20happens%20to%20be%20one%20here)%20%E2%80%94%20only%20its%20length%20is%20guaranteed
x = 8    → tail = [8]
x = 100  → tail = [8, 100]
x = 150  → tail = [8, 100, 150]
x = 10   → replaces 100  → tail = [8, 10, 150]
x = 12   → replaces 150  → tail = [8, 10, 12]
x = 14   → extends       → tail = [8, 10, 12, 14]
x = 110  → extends       → tail = [8, 10, 12, 14, 110]   → length 5
```

```python filename:Python
def ceil_index(tail, x):             # first position with tail[pos] >= x (lower_bound)
    lo, hi = 0, len(tail) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if tail[mid] >= x:
            hi = mid
        else:
            lo = mid + 1
    return lo

def lis(arr):
    tail = [arr[0]]
    for x in arr[1:]:
        if x > tail[-1]:
            tail.append(x)           # extends the longest subsequence
        else:
            tail[ceil_index(tail, x)] = x   # a smaller tail for that length
    return len(tail)

for arr in [[8, 100, 150, 10, 12, 14, 110], [3, 4, 2, 8, 10]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", lis(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int lis(const vector<int>& arr) {
    vector<int> tail;
    for (int x : arr) {
        auto it = lower_bound(tail.begin(), tail.end(), x);   // first tail >= x
        if (it == tail.end()) tail.push_back(x);              // extends the longest subsequence
        else *it = x;                                         // a smaller tail for that length
    }
    return tail.size();
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << lis(arr) << "\n";
}

int main() {
    show({8, 100, 150, 10, 12, 14, 110});
    show({3, 4, 2, 8, 10});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int ceilIndex(int[] tail, int len, int x) {   // first position with tail[pos] >= x
        int lo = 0, hi = len - 1;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (tail[mid] >= x) hi = mid; else lo = mid + 1;
        }
        return lo;
    }

    static int lis(int[] arr) {
        int[] tail = new int[arr.length];
        int len = 1;
        tail[0] = arr[0];
        for (int i = 1; i < arr.length; i++) {
            if (arr[i] > tail[len - 1]) tail[len++] = arr[i];     // extends the longest subsequence
            else tail[ceilIndex(tail, len, arr[i])] = arr[i];     // a smaller tail for that length
        }
        return len;
    }

    public static void main(String[] args) {
        int[][] tests = {{8, 100, 150, 10, 12, 14, 110}, {3, 4, 2, 8, 10}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + lis(arr));
    }
}
```

```javascript filename:JavaScript
function ceilIndex(tail, x) {        // first position with tail[pos] >= x (lower_bound)
    let lo = 0, hi = tail.length - 1;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (tail[mid] >= x) hi = mid; else lo = mid + 1;
    }
    return lo;
}

function lis(arr) {
    const tail = [arr[0]];
    for (const x of arr.slice(1)) {
        if (x > tail[tail.length - 1]) tail.push(x);   // extends the longest subsequence
        else tail[ceilIndex(tail, x)] = x;              // a smaller tail for that length
    }
    return tail.length;
}

for (const arr of [[8, 100, 150, 10, 12, 14, 110], [3, 4, 2, 8, 10]])
    console.log(`[${arr.join(", ")}] -> ${lis(arr)}`);
```

```text filename:Output
[8, 100, 150, 10, 12, 14, 110] -> 5
[3, 4, 2, 8, 10] -> 4
```

Time O(n log n) · Space O(n)

> [!WARNING] Pitfall
>
> The binary search must find the first tail `>= x` (ceiling). Writing `mid = (lo + (hi - lo)) // 2` — as the original notes did — is just `hi // 2` and loops forever or returns the wrong slot. For a <em>non-decreasing</em> subsequence use the first tail `> x` (`upper_bound`) instead.

# Variations of LIS

The `O(n²)` LIS loop is a template: change the comparison or what `dp[i]` accumulates and you solve a whole family of problems.

| Problem | What changes |
| --- | --- |
| Minimum deletions to make the array sorted | Keep the LIS, delete the rest: `n - LIS` |
| Maximum sum increasing subsequence | `dp[i]` holds a <em>sum</em> instead of a length: `dp[i] = arr[i] + max dp[j]` |
| Maximum length bitonic subsequence | LIS from the left + LDS (longest decreasing) from the right, `max(lis[i] + lds[i] - 1)` |
| Building bridges | Sort pairs by one bank, LIS on the other bank — non-crossing bridges are an increasing subsequence |
| The longest chain of pairs | Sort by first value; a pair extends a chain when its first value is greater than the previous pair's second |

# Minimum deletions to make an array sorted

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [4, 3, 2, 6, 7, 8]`<br><strong>Output:</strong> `2 (delete 4 and 3 — or 3 and 2)`<br><strong>Input:</strong> `arr = [5, 4, 3, 2, 1]`<br><strong>Output:</strong> `4`

> [!NOTE] Idea
>
> The elements that <em>stay</em> form an increasing subsequence, and we want to keep as many as possible — so keep the LIS and delete everything else: `n - LIS`.

`minDeletions = n − LIS(arr)`

```python filename:Python
def min_deletions(arr):
    n = len(arr)
    lis = [1] * n
    for i in range(1, n):
        for j in range(i):
            if arr[j] < arr[i] and lis[j] + 1 > lis[i]:
                lis[i] = lis[j] + 1
    return n - max(lis)                 # everything outside the LIS goes

for arr in [[4, 3, 2, 6, 7, 8], [5, 4, 3, 2, 1]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", min_deletions(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int minDeletions(const vector<int>& arr) {
    int n = arr.size();
    vector<int> lis(n, 1);
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i]) lis[i] = max(lis[i], lis[j] + 1);
    return n - *max_element(lis.begin(), lis.end());   // everything outside the LIS goes
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << minDeletions(arr) << "\n";
}

int main() {
    show({4, 3, 2, 6, 7, 8});
    show({5, 4, 3, 2, 1});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int minDeletions(int[] arr) {
        int n = arr.length, best = 1;
        int[] lis = new int[n];
        Arrays.fill(lis, 1);
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++)
                if (arr[j] < arr[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
            best = Math.max(best, lis[i]);
        }
        return n - best;                          // everything outside the LIS goes
    }

    public static void main(String[] args) {
        int[][] tests = {{4, 3, 2, 6, 7, 8}, {5, 4, 3, 2, 1}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + minDeletions(arr));
    }
}
```

```javascript filename:JavaScript
function minDeletions(arr) {
    const n = arr.length;
    const lis = new Array(n).fill(1);
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (arr[j] < arr[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
    return n - Math.max(...lis);              // everything outside the LIS goes
}

for (const arr of [[4, 3, 2, 6, 7, 8], [5, 4, 3, 2, 1]])
    console.log(`[${arr.join(", ")}] -> ${minDeletions(arr)}`);
```

```text filename:Output
[4, 3, 2, 6, 7, 8] -> 2
[5, 4, 3, 2, 1] -> 4
```

Time O(n²) · Space O(n)

# Maximum sum increasing subsequence

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 101, 2, 3, 100, 4, 5]`<br><strong>Output:</strong> `106 (1 + 2 + 3 + 100)`<br><strong>Input:</strong> `arr = [3, 4, 5, 10]`<br><strong>Output:</strong> `22`

> [!NOTE] Idea
>
> Same loop as LIS, but `msis[i]` stores the <strong>maximum sum</strong> of an increasing subsequence ending at `i`. Initialise with `arr[i]` (the element alone) and extend with `msis[j] + arr[i]` whenever `arr[j] < arr[i]`.

`msis[i] = arr[i] + max{ msis[j] : j < i, arr[j] < arr[i] } (or arr[i] alone)`

```python filename:Python
def max_sum_increasing(arr):
    n = len(arr)
    msis = arr[:]                              # each element alone
    for i in range(1, n):
        for j in range(i):
            if arr[j] < arr[i] and msis[j] + arr[i] > msis[i]:
                msis[i] = msis[j] + arr[i]     # extend the best sum ending at j
    return max(msis)

for arr in [[1, 101, 2, 3, 100, 4, 5], [3, 4, 5, 10]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", max_sum_increasing(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int maxSumIncreasing(const vector<int>& arr) {
    int n = arr.size();
    vector<int> msis(arr);                        // each element alone
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i]) msis[i] = max(msis[i], msis[j] + arr[i]);   // extend the best sum ending at j
    return *max_element(msis.begin(), msis.end());
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << maxSumIncreasing(arr) << "\n";
}

int main() {
    show({1, 101, 2, 3, 100, 4, 5});
    show({3, 4, 5, 10});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int maxSumIncreasing(int[] arr) {
        int n = arr.length;
        int[] msis = arr.clone();                     // each element alone
        int best = msis[0];
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++)
                if (arr[j] < arr[i]) msis[i] = Math.max(msis[i], msis[j] + arr[i]);   // extend the best sum ending at j
            best = Math.max(best, msis[i]);
        }
        return best;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 101, 2, 3, 100, 4, 5}, {3, 4, 5, 10}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + maxSumIncreasing(arr));
    }
}
```

```javascript filename:JavaScript
function maxSumIncreasing(arr) {
    const n = arr.length;
    const msis = [...arr];                        // each element alone
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (arr[j] < arr[i]) msis[i] = Math.max(msis[i], msis[j] + arr[i]);   // extend the best sum ending at j
    return Math.max(...msis);
}

for (const arr of [[1, 101, 2, 3, 100, 4, 5], [3, 4, 5, 10]])
    console.log(`[${arr.join(", ")}] -> ${maxSumIncreasing(arr)}`);
```

```text filename:Output
[1, 101, 2, 3, 100, 4, 5] -> 106
[3, 4, 5, 10] -> 22
```

Time O(n²) · Space O(n)

# Maximum length bitonic subsequence

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 11, 2, 10, 4, 5, 2, 1]`<br><strong>Output:</strong> `6 (1, 2, 10, 4, 2, 1)`<br><strong>Input:</strong> `arr = [12, 11, 40, 5, 3, 1]`<br><strong>Output:</strong> `5`

> [!NOTE] Idea
>
> A bitonic subsequence first increases, then decreases. For every index `i` compute `lis[i]` (longest increasing ending at `i`, scanning left to right) and `lds[i]` (longest decreasing <em>starting</em> at `i`, scanning right to left). With `i` as the peak the length is `lis[i] + lds[i] - 1` (the peak is counted twice).

`answer = max over i of ( lis[i] + lds[i] − 1 )`

```text filename:lds%5B1%5D%20%3D%205%20because%2011%2C%2010%2C%204%2C%202%2C%201%20decreases%20from%20index%201
arr:  1  11   2  10   4   5   2   1
lis:  1   2   2   3   3   4   2   1
lds:  1   5   2   4   3   3   2   1
sum-1: 1  6   3   6   5   6   3   1   ← 6
```

```python filename:Python
def max_bitonic(arr):
    n = len(arr)
    lis = [1] * n
    for i in range(1, n):
        for j in range(i):
            if arr[j] < arr[i]:
                lis[i] = max(lis[i], lis[j] + 1)
    lds = [1] * n
    for i in range(n - 2, -1, -1):              # right to left: decreasing from i
        for j in range(i + 1, n):
            if arr[j] < arr[i]:
                lds[i] = max(lds[i], lds[j] + 1)
    return max(lis[i] + lds[i] - 1 for i in range(n))   # i is the peak

for arr in [[1, 11, 2, 10, 4, 5, 2, 1], [12, 11, 40, 5, 3, 1]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", max_bitonic(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int maxBitonic(const vector<int>& arr) {
    int n = arr.size();
    vector<int> lis(n, 1), lds(n, 1);
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i]) lis[i] = max(lis[i], lis[j] + 1);
    for (int i = n - 2; i >= 0; i--)              // right to left: decreasing from i
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[i]) lds[i] = max(lds[i], lds[j] + 1);
    int best = 0;
    for (int i = 0; i < n; i++) best = max(best, lis[i] + lds[i] - 1);   // i is the peak
    return best;
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << maxBitonic(arr) << "\n";
}

int main() {
    show({1, 11, 2, 10, 4, 5, 2, 1});
    show({12, 11, 40, 5, 3, 1});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int maxBitonic(int[] arr) {
        int n = arr.length;
        int[] lis = new int[n], lds = new int[n];
        Arrays.fill(lis, 1);
        Arrays.fill(lds, 1);
        for (int i = 1; i < n; i++)
            for (int j = 0; j < i; j++)
                if (arr[j] < arr[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
        for (int i = n - 2; i >= 0; i--)          // right to left: decreasing from i
            for (int j = i + 1; j < n; j++)
                if (arr[j] < arr[i]) lds[i] = Math.max(lds[i], lds[j] + 1);
        int best = 0;
        for (int i = 0; i < n; i++) best = Math.max(best, lis[i] + lds[i] - 1);   // i is the peak
        return best;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 11, 2, 10, 4, 5, 2, 1}, {12, 11, 40, 5, 3, 1}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + maxBitonic(arr));
    }
}
```

```javascript filename:JavaScript
function maxBitonic(arr) {
    const n = arr.length;
    const lis = new Array(n).fill(1), lds = new Array(n).fill(1);
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (arr[j] < arr[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
    for (let i = n - 2; i >= 0; i--)              // right to left: decreasing from i
        for (let j = i + 1; j < n; j++)
            if (arr[j] < arr[i]) lds[i] = Math.max(lds[i], lds[j] + 1);
    let best = 0;
    for (let i = 0; i < n; i++) best = Math.max(best, lis[i] + lds[i] - 1);   // i is the peak
    return best;
}

for (const arr of [[1, 11, 2, 10, 4, 5, 2, 1], [12, 11, 40, 5, 3, 1]])
    console.log(`[${arr.join(", ")}] -> ${maxBitonic(arr)}`);
```

```text filename:Output
[1, 11, 2, 10, 4, 5, 2, 1] -> 6
[12, 11, 40, 5, 3, 1] -> 5
```

Time O(n²) · Space O(n)

# Building bridges

> [!TIP] Example
>
> <strong>Input:</strong> `pairs = [(8,1), (1,2), (4,3), (3,4), (6,5), (5,6)] (north bank, south bank)`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `pairs = [(6,2), (4,3), (2,6), (1,5)]`<br><strong>Output:</strong> `2`

> [!NOTE] Idea
>
> Cities on the north bank are paired with cities on the south bank; a bridge joins a pair, and bridges may not cross. Sort the pairs by their north coordinate. Two bridges `(a1, b1)`, `(a2, b2)` with `a1 < a2` do not cross exactly when `b1 < b2` — so the maximum set of non-crossing bridges is the <strong>LIS of the south coordinates</strong> after sorting.

`sort by north; answer = LIS( south coordinates )`

```python filename:Python
def building_bridges(pairs):
    pairs = sorted(pairs)                     # by north bank, then south
    south = [b for _, b in pairs]
    n = len(south)
    lis = [1] * n
    for i in range(1, n):
        for j in range(i):
            if south[j] < south[i]:          # non-crossing ⇔ increasing on the other bank
                lis[i] = max(lis[i], lis[j] + 1)
    return pairs, max(lis)

pairs, best = building_bridges([(8, 1), (1, 2), (4, 3), (3, 4), (6, 5), (5, 6)])
print("sorted by north:", " ".join(f"({a},{b})" for a, b in pairs))
print("max bridges:", best)
print("second set:", building_bridges([(6, 2), (4, 3), (2, 6), (1, 5)])[1])
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int buildingBridges(vector<pair<int, int>> pairs, bool show) {
    sort(pairs.begin(), pairs.end());             // by north bank, then south
    if (show) {
        cout << "sorted by north:";
        for (auto& [a, b] : pairs) cout << " (" << a << "," << b << ")";
        cout << "\n";
    }
    int n = pairs.size(), best = 1;
    vector<int> lis(n, 1);
    for (int i = 1; i < n; i++) {
        for (int j = 0; j < i; j++)
            if (pairs[j].second < pairs[i].second)   // non-crossing ⇔ increasing on the other bank
                lis[i] = max(lis[i], lis[j] + 1);
        best = max(best, lis[i]);
    }
    return best;
}

int main() {
    int best = buildingBridges({{8, 1}, {1, 2}, {4, 3}, {3, 4}, {6, 5}, {5, 6}}, true);
    cout << "max bridges: " << best << "\n";
    cout << "second set: " << buildingBridges({{6, 2}, {4, 3}, {2, 6}, {1, 5}}, false) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int buildingBridges(int[][] pairs, boolean show) {
        Arrays.sort(pairs, (x, y) -> x[0] != y[0] ? x[0] - y[0] : x[1] - y[1]);   // by north, then south
        if (show) {
            StringBuilder sb = new StringBuilder("sorted by north:");
            for (int[] p : pairs) sb.append(" (").append(p[0]).append(",").append(p[1]).append(")");
            System.out.println(sb);
        }
        int n = pairs.length, best = 1;
        int[] lis = new int[n];
        Arrays.fill(lis, 1);
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++)
                if (pairs[j][1] < pairs[i][1])        // non-crossing ⇔ increasing on the other bank
                    lis[i] = Math.max(lis[i], lis[j] + 1);
            best = Math.max(best, lis[i]);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println("max bridges: " + buildingBridges(new int[][]{{8, 1}, {1, 2}, {4, 3}, {3, 4}, {6, 5}, {5, 6}}, true));
        System.out.println("second set: " + buildingBridges(new int[][]{{6, 2}, {4, 3}, {2, 6}, {1, 5}}, false));
    }
}
```

```javascript filename:JavaScript
function buildingBridges(pairs, show) {
    pairs = [...pairs].sort((x, y) => x[0] - y[0] || x[1] - y[1]);   // by north bank, then south
    if (show) console.log("sorted by north:", pairs.map(([a, b]) => `(${a},${b})`).join(" "));
    const n = pairs.length;
    const lis = new Array(n).fill(1);
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (pairs[j][1] < pairs[i][1])            // non-crossing ⇔ increasing on the other bank
                lis[i] = Math.max(lis[i], lis[j] + 1);
    return Math.max(...lis);
}

console.log("max bridges:", buildingBridges([[8, 1], [1, 2], [4, 3], [3, 4], [6, 5], [5, 6]], true));
console.log("second set:", buildingBridges([[6, 2], [4, 3], [2, 6], [1, 5]], false));
```

```text filename:Output
sorted by north: (1,2) (3,4) (4,3) (5,6) (6,5) (8,1)
max bridges: 3
second set: 2
```

Time O(n²) (O(n log n) with the tail-array LIS) · Space O(n)

# The longest chain of pairs

> [!TIP] Example
>
> <strong>Input:</strong> `pairs = [(5,24), (15,25), (27,40), (50,60)]`<br><strong>Output:</strong> `3 ((5,24) → (27,40) → (50,60))`<br><strong>Input:</strong> `pairs = [(5,10), (1,11)]`<br><strong>Output:</strong> `1`

> [!NOTE] Idea
>
> Pair `(c, d)` can follow `(a, b)` in a chain when `b < c`. Sort the pairs by their first element; then a chain is a subsequence and the LIS recurrence applies with the comparison `pairs[j].second < pairs[i].first`.

`dp[i] = 1 + max{ dp[j] : j < i, pairs[j].second < pairs[i].first }`

```python filename:Python
def longest_chain(pairs):
    pairs = sorted(pairs)
    n = len(pairs)
    dp = [1] * n
    for i in range(1, n):
        for j in range(i):
            if pairs[j][1] < pairs[i][0]:          # (a,b) then (c,d) needs b < c
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

print("longest chain:", longest_chain([(5, 24), (15, 25), (27, 40), (50, 60)]))
print("second set:", longest_chain([(5, 10), (1, 11)]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int longestChain(vector<pair<int, int>> pairs) {
    sort(pairs.begin(), pairs.end());
    int n = pairs.size(), best = 1;
    vector<int> dp(n, 1);
    for (int i = 1; i < n; i++) {
        for (int j = 0; j < i; j++)
            if (pairs[j].second < pairs[i].first)   // (a,b) then (c,d) needs b < c
                dp[i] = max(dp[i], dp[j] + 1);
        best = max(best, dp[i]);
    }
    return best;
}

int main() {
    cout << "longest chain: " << longestChain({{5, 24}, {15, 25}, {27, 40}, {50, 60}}) << "\n";
    cout << "second set: " << longestChain({{5, 10}, {1, 11}}) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int longestChain(int[][] pairs) {
        Arrays.sort(pairs, (x, y) -> x[0] != y[0] ? x[0] - y[0] : x[1] - y[1]);
        int n = pairs.length, best = 1;
        int[] dp = new int[n];
        Arrays.fill(dp, 1);
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++)
                if (pairs[j][1] < pairs[i][0])        // (a,b) then (c,d) needs b < c
                    dp[i] = Math.max(dp[i], dp[j] + 1);
            best = Math.max(best, dp[i]);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println("longest chain: " + longestChain(new int[][]{{5, 24}, {15, 25}, {27, 40}, {50, 60}}));
        System.out.println("second set: " + longestChain(new int[][]{{5, 10}, {1, 11}}));
    }
}
```

```javascript filename:JavaScript
function longestChain(pairs) {
    pairs = [...pairs].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const n = pairs.length;
    const dp = new Array(n).fill(1);
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (pairs[j][1] < pairs[i][0])            // (a,b) then (c,d) needs b < c
                dp[i] = Math.max(dp[i], dp[j] + 1);
    return Math.max(...dp);
}

console.log("longest chain:", longestChain([[5, 24], [15, 25], [27, 40], [50, 60]]));
console.log("second set:", longestChain([[5, 10], [1, 11]]));
```

```text filename:Output
longest chain: 3
second set: 1
```

Time O(n²) · Space O(n)

> [!NOTE] Key point
>
> Sorting by the <em>second</em> element and greedily taking every pair that starts after the current end solves the same problem in `O(n log n)` — it is the activity-selection problem from Greedy. The DP version is what you need when pairs carry weights.

# Minimum coins to make a value

> [!TIP] Example
>
> <strong>Input:</strong> `coins = [25, 10, 5], value = 30`<br><strong>Output:</strong> `2 (25 + 5)`<br><strong>Input:</strong> `coins = [1, 2, 5], value = 11`<br><strong>Output:</strong> `3 (5 + 5 + 1)`<br><strong>Input:</strong> `coins = [2], value = 3`<br><strong>Output:</strong> `-1 (impossible)`

> [!NOTE] Idea
>
> `dp[v]` = fewest coins that make value `v`. The last coin used is some `c ≤ v`, after which `v - c` remains and must itself be made with the fewest coins — try every coin and take the best. `dp[0] = 0`; unreachable values stay at infinity.

`dp[v] = 1 + min{ dp[v − c] : c ∈ coins, c ≤ v }; dp[0] = 0; answer = dp[value] (−1 if still ∞)`

The recursive version tries every coin as the <em>first</em> coin and recurses on the remaining value; it is exponential because `mCoins(v - a - b)` and `mCoins(v - b - a)` are the same subproblem.

```python filename:Python
def min_coins_rec(coins, val):
    if val == 0:
        return 0
    res = -1                                  # -1 = impossible
    for c in coins:
        if c <= val:
            sub = min_coins_rec(coins, val - c)
            if sub != -1 and (res == -1 or sub + 1 < res):
                res = sub + 1
    return res

print(min_coins_rec([25, 10, 5], 30))
print(min_coins_rec([1, 2, 5], 11))
```

```text filename:Output
2
3
```

```python filename:Python
def min_coins(coins, val):
    INF = float("inf")
    dp = [INF] * (val + 1)
    dp[0] = 0                                  # zero coins make 0
    for v in range(1, val + 1):
        for c in coins:
            if c <= v and dp[v - c] + 1 < dp[v]:
                dp[v] = dp[v - c] + 1          # c is the last coin
    return -1 if dp[val] == INF else dp[val]

for coins, val in [([25, 10, 5], 30), ([1, 2, 5], 11), ([2], 3)]:
    print("coins", " ".join(map(str, coins)) + ", value", str(val) + ":", min_coins(coins, val))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int minCoins(const vector<int>& coins, int val) {
    const int INF = 1e9;
    vector<int> dp(val + 1, INF);
    dp[0] = 0;                                     // zero coins make 0
    for (int v = 1; v <= val; v++)
        for (int c : coins)
            if (c <= v && dp[v - c] + 1 < dp[v])
                dp[v] = dp[v - c] + 1;             // c is the last coin
    return dp[val] == INF ? -1 : dp[val];
}

void show(const vector<int>& coins, int val) {
    cout << "coins";
    for (int c : coins) cout << " " << c;
    cout << ", value " << val << ": " << minCoins(coins, val) << "\n";
}

int main() {
    show({25, 10, 5}, 30);
    show({1, 2, 5}, 11);
    show({2}, 3);
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int minCoins(int[] coins, int val) {
        final int INF = 1_000_000_000;
        int[] dp = new int[val + 1];
        Arrays.fill(dp, INF);
        dp[0] = 0;                                 // zero coins make 0
        for (int v = 1; v <= val; v++)
            for (int c : coins)
                if (c <= v && dp[v - c] + 1 < dp[v])
                    dp[v] = dp[v - c] + 1;         // c is the last coin
        return dp[val] == INF ? -1 : dp[val];
    }

    static void show(int[] coins, int val) {
        StringBuilder sb = new StringBuilder("coins");
        for (int c : coins) sb.append(" ").append(c);
        System.out.println(sb + ", value " + val + ": " + minCoins(coins, val));
    }

    public static void main(String[] args) {
        show(new int[]{25, 10, 5}, 30);
        show(new int[]{1, 2, 5}, 11);
        show(new int[]{2}, 3);
    }
}
```

```javascript filename:JavaScript
function minCoins(coins, val) {
    const INF = Infinity;
    const dp = new Array(val + 1).fill(INF);
    dp[0] = 0;                                     // zero coins make 0
    for (let v = 1; v <= val; v++)
        for (const c of coins)
            if (c <= v && dp[v - c] + 1 < dp[v])
                dp[v] = dp[v - c] + 1;             // c is the last coin
    return dp[val] === INF ? -1 : dp[val];
}

for (const [coins, val] of [[[25, 10, 5], 30], [[1, 2, 5], 11], [[2], 3]])
    console.log(`coins ${coins.join(" ")}, value ${val}: ${minCoins(coins, val)}`);
```

```text filename:Output
coins 25 10 5, value 30: 2
coins 1 2 5, value 11: 3
coins 2, value 3: -1
```

Time O(n·value) · Space O(value)

> [!WARNING] Pitfall
>
> Greedy (always take the largest coin) works for 25/10/5 but fails in general: for `coins = [1, 3, 4]` and value 6 greedy gives `4+1+1` (3 coins) while DP finds `3+3`. Use DP unless the coin system is known to be canonical.

# Minimum jumps to reach the end

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 4, 2, 1, 2, 1]`<br><strong>Output:</strong> `2 (3 → 1 → end)`<br><strong>Input:</strong> `arr = [2, 3, 1, 1, 2, 4, 2, 0, 1, 1]`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `arr = [1, 0, 2]`<br><strong>Output:</strong> `-1 (stuck at index 1)`

`arr[i]` is the maximum number of positions you can jump forward from index `i`. Find the minimum number of jumps from index `0` to the last index.

> [!NOTE] Idea
>
> `dp[i]` = fewest jumps to reach index `i`. Index `i` is reached from any earlier `j` whose jump range covers it (`j + arr[j] ≥ i`), so take the best such `j` and add one jump. `dp[0] = 0`; an index no `j` can reach stays infinite.

`dp[i] = 1 + min{ dp[j] : j < i, j + arr[j] ≥ i }; dp[0] = 0`

```python filename:Python
def min_jumps(arr):
    n = len(arr)
    INF = float("inf")
    dp = [INF] * n
    dp[0] = 0
    for i in range(1, n):
        for j in range(i):
            if j + arr[j] >= i and dp[j] != INF:    # j can reach i
                dp[i] = min(dp[i], dp[j] + 1)
    return -1 if dp[n - 1] == INF else dp[n - 1]

for arr in [[3, 4, 2, 1, 2, 1], [2, 3, 1, 1, 2, 4, 2, 0, 1, 1], [1, 0, 2]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", min_jumps(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int minJumps(const vector<int>& arr) {
    int n = arr.size();
    const int INF = 1e9;
    vector<int> dp(n, INF);
    dp[0] = 0;
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (j + arr[j] >= i && dp[j] != INF)      // j can reach i
                dp[i] = min(dp[i], dp[j] + 1);
    return dp[n - 1] == INF ? -1 : dp[n - 1];
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << minJumps(arr) << "\n";
}

int main() {
    show({3, 4, 2, 1, 2, 1});
    show({2, 3, 1, 1, 2, 4, 2, 0, 1, 1});
    show({1, 0, 2});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int minJumps(int[] arr) {
        int n = arr.length;
        final int INF = 1_000_000_000;
        int[] dp = new int[n];
        Arrays.fill(dp, INF);
        dp[0] = 0;
        for (int i = 1; i < n; i++)
            for (int j = 0; j < i; j++)
                if (j + arr[j] >= i && dp[j] != INF)   // j can reach i
                    dp[i] = Math.min(dp[i], dp[j] + 1);
        return dp[n - 1] == INF ? -1 : dp[n - 1];
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 4, 2, 1, 2, 1}, {2, 3, 1, 1, 2, 4, 2, 0, 1, 1}, {1, 0, 2}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + minJumps(arr));
    }
}
```

```javascript filename:JavaScript
function minJumps(arr) {
    const n = arr.length;
    const dp = new Array(n).fill(Infinity);
    dp[0] = 0;
    for (let i = 1; i < n; i++)
        for (let j = 0; j < i; j++)
            if (j + arr[j] >= i && dp[j] !== Infinity)   // j can reach i
                dp[i] = Math.min(dp[i], dp[j] + 1);
    return dp[n - 1] === Infinity ? -1 : dp[n - 1];
}

for (const arr of [[3, 4, 2, 1, 2, 1], [2, 3, 1, 1, 2, 4, 2, 0, 1, 1], [1, 0, 2]])
    console.log(`[${arr.join(", ")}] -> ${minJumps(arr)}`);
```

```text filename:Output
[3, 4, 2, 1, 2, 1] -> 2
[2, 3, 1, 1, 2, 4, 2, 0, 1, 1] -> 4
[1, 0, 2] -> -1
```

Time O(n²) · Space O(n)

> [!NOTE] Key point
>
> Because `dp` is non-decreasing along the array, the first `j` that reaches `i` already gives the minimum — the original notes used that fact to `break` out of the inner loop. A BFS-style greedy (track the farthest index reachable with the current number of jumps) solves it in `O(n)`.

# 0-1 Knapsack

> [!TIP] Example
>
> <strong>Input:</strong> `values = [10, 40, 30, 50], weights = [5, 4, 6, 3], capacity = 10`<br><strong>Output:</strong> `90 (items with weights 4 and 3 → 40 + 50)`<br><strong>Input:</strong> `values = [60, 100, 120], weights = [10, 20, 30], capacity = 50`<br><strong>Output:</strong> `220`

Each item can be taken <strong>at most once</strong> (0 or 1 copies). Maximise the total value without exceeding the capacity. Taking the best value-per-weight items greedily fails here — that greedy only works for the <em>fractional</em> knapsack.

> [!NOTE] Idea
>
> Look at the last item. Either it does not fit, or we choose the better of <strong>skipping it</strong> (`dp[i-1][w]`) and <strong>taking it</strong> (`val + dp[i-1][w - wt]`). The “take” branch reads the <em>previous</em> row, so each item is used at most once — the one-line difference from the unbounded coin problems.

`dp[i][w] = max( dp[i−1][w], val[i−1] + dp[i−1][w − wt[i−1]] ) if wt[i−1] ≤ w; else dp[i−1][w]; dp[0][w] = dp[i][0] = 0`

```python filename:Python
def knapsack_rec(W, wt, val, n):
    if n == 0 or W == 0:
        return 0
    if wt[n - 1] > W:                              # does not fit → skip
        return knapsack_rec(W, wt, val, n - 1)
    return max(val[n - 1] + knapsack_rec(W - wt[n - 1], wt, val, n - 1),   # take
               knapsack_rec(W, wt, val, n - 1))                            # skip

print(knapsack_rec(10, [5, 4, 6, 3], [10, 40, 30, 50], 4))
print(knapsack_rec(50, [10, 20, 30], [60, 100, 120], 3))
```

```text filename:Output
90
220
```

```text filename:dp%5B4%5D%5B7%5D%20%3D%20max(dp%5B3%5D%5B7%5D%20%3D%2040%2C%2050%20%2B%20dp%5B3%5D%5B4%5D%20%3D%2090)%20%E2%80%94%20taking%20the%20weight-3%20item%20leaves%20capacity%204%20for%20the%20weight-4%20item
capacity w:        0   1   2   3   4   5   6   7   8   9  10
no items           0   0   0   0   0   0   0   0   0   0   0
+ (v10, w5)        0   0   0   0   0  10  10  10  10  10  10
+ (v40, w4)        0   0   0   0  40  40  40  40  40  50  50
+ (v30, w6)        0   0   0   0  40  40  40  40  40  50  70
+ (v50, w3)        0   0   0  50  50  50  50  90  90  90  90   ← dp[4][10] = 90
```

```python filename:Python
def knapsack(W, wt, val):
    n = len(val)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]                       # skip item i
            if wt[i - 1] <= w:                            # take item i (previous row: at most once)
                dp[i][w] = max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]])
    return dp[n][W]

print("capacity 10:", knapsack(10, [5, 4, 6, 3], [10, 40, 30, 50]))
print("capacity 50:", knapsack(50, [10, 20, 30], [60, 100, 120]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int knapsack(int W, const vector<int>& wt, const vector<int>& val) {
    int n = val.size();
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i - 1][w];                          // skip item i
            if (wt[i - 1] <= w)                               // take item i (previous row: at most once)
                dp[i][w] = max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]]);
        }
    return dp[n][W];
}

int main() {
    cout << "capacity 10: " << knapsack(10, {5, 4, 6, 3}, {10, 40, 30, 50}) << "\n";
    cout << "capacity 50: " << knapsack(50, {10, 20, 30}, {60, 100, 120}) << "\n";
}
```

```java filename:Java
public class Main {
    static int knapsack(int W, int[] wt, int[] val) {
        int n = val.length;
        int[][] dp = new int[n + 1][W + 1];
        for (int i = 1; i <= n; i++)
            for (int w = 0; w <= W; w++) {
                dp[i][w] = dp[i - 1][w];                      // skip item i
                if (wt[i - 1] <= w)                           // take item i (previous row: at most once)
                    dp[i][w] = Math.max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]]);
            }
        return dp[n][W];
    }

    public static void main(String[] args) {
        System.out.println("capacity 10: " + knapsack(10, new int[]{5, 4, 6, 3}, new int[]{10, 40, 30, 50}));
        System.out.println("capacity 50: " + knapsack(50, new int[]{10, 20, 30}, new int[]{60, 100, 120}));
    }
}
```

```javascript filename:JavaScript
function knapsack(W, wt, val) {
    const n = val.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));
    for (let i = 1; i <= n; i++)
        for (let w = 0; w <= W; w++) {
            dp[i][w] = dp[i - 1][w];                          // skip item i
            if (wt[i - 1] <= w)                               // take item i (previous row: at most once)
                dp[i][w] = Math.max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]]);
        }
    return dp[n][W];
}

console.log("capacity 10:", knapsack(10, [5, 4, 6, 3], [10, 40, 30, 50]));
console.log("capacity 50:", knapsack(50, [10, 20, 30], [60, 100, 120]));
```

```text filename:Output
capacity 10: 90
capacity 50: 220
```

Time O(n·W) · Space O(n·W), or O(W) with one row

> [!WARNING] Pitfall
>
> With a single 1-D row, iterate the capacity <strong>downwards</strong> (`w = W … wt`) so that `dp[w - wt]` still holds the previous item's value; iterating upwards reuses the same item and silently turns the problem into <em>unbounded</em> knapsack. Note also that `O(n·W)` is <em>pseudo-polynomial</em> — it depends on the numeric value of `W`, not its number of digits.

# Optimal strategy for a game

> [!TIP] Example
>
> <strong>Input:</strong> `coins = [2, 3, 15, 7]`<br><strong>Output:</strong> `17 (take 2, the opponent takes 7, take 15)`<br><strong>Input:</strong> `coins = [8, 15, 3, 7]`<br><strong>Output:</strong> `22`

A row of an even number of coins. Two players alternately take a coin from either <strong>end</strong>; you move first and both play optimally. Maximise your total.

> [!NOTE] Idea
>
> `dp[i][j]` = the most the player to move can collect from coins `i..j`. If you take `coins[i]`, the opponent then plays optimally on `i+1..j` and leaves you the <strong>worse</strong> of the two remaining positions (`dp[i+2][j]` or `dp[i+1][j-1]`); symmetrically for `coins[j]`. Take the better of the two choices. Fill by increasing interval length.

`dp[i][j] = max( coins[i] + min(dp[i+2][j], dp[i+1][j−1]), coins[j] + min(dp[i+1][j−1], dp[i][j−2]) ); dp[i][i] = coins[i], dp[i][i+1] = max(coins[i], coins[i+1])`

For `[2, 3, 15, 7]`: taking 7 forces the opponent to choose from `[2, 3, 15]`; they take 15, and you get the better of 2 and 3 → `7 + 3 = 10`. Taking 2 leaves `[3, 15, 7]`; the opponent takes 7 (if they took 3 you would take 15), you take 15 → `2 + 15 = 17`. So the first move is the <em>smaller</em> end coin — exactly what greedy gets wrong.

```python filename:Python
def optimal_strategy(coins):
    n = len(coins)
    dp = [[0] * n for _ in range(n)]
    for length in range(1, n + 1):                   # intervals by increasing length
        for i in range(n - length + 1):
            j = i + length - 1
            if i == j:
                dp[i][j] = coins[i]
            elif i + 1 == j:
                dp[i][j] = max(coins[i], coins[j])
            else:
                take_left = coins[i] + min(dp[i + 2][j], dp[i + 1][j - 1])    # opponent leaves the worse one
                take_right = coins[j] + min(dp[i + 1][j - 1], dp[i][j - 2])
                dp[i][j] = max(take_left, take_right)
    return dp[0][n - 1]

for coins in [[2, 3, 15, 7], [8, 15, 3, 7], [20, 30, 2, 2, 2, 10]]:
    print("[" + ", ".join(map(str, coins)) + "] ->", optimal_strategy(coins))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int optimalStrategy(const vector<int>& coins) {
    int n = coins.size();
    vector<vector<int>> dp(n, vector<int>(n, 0));
    for (int len = 1; len <= n; len++)                   // intervals by increasing length
        for (int i = 0; i + len - 1 < n; i++) {
            int j = i + len - 1;
            if (i == j) dp[i][j] = coins[i];
            else if (i + 1 == j) dp[i][j] = max(coins[i], coins[j]);
            else {
                int takeLeft = coins[i] + min(dp[i + 2][j], dp[i + 1][j - 1]);   // opponent leaves the worse one
                int takeRight = coins[j] + min(dp[i + 1][j - 1], dp[i][j - 2]);
                dp[i][j] = max(takeLeft, takeRight);
            }
        }
    return dp[0][n - 1];
}

void show(const vector<int>& coins) {
    cout << "[";
    for (int i = 0; i < (int)coins.size(); i++) cout << (i ? ", " : "") << coins[i];
    cout << "] -> " << optimalStrategy(coins) << "\n";
}

int main() {
    show({2, 3, 15, 7});
    show({8, 15, 3, 7});
    show({20, 30, 2, 2, 2, 10});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int optimalStrategy(int[] coins) {
        int n = coins.length;
        int[][] dp = new int[n][n];
        for (int len = 1; len <= n; len++)               // intervals by increasing length
            for (int i = 0; i + len - 1 < n; i++) {
                int j = i + len - 1;
                if (i == j) dp[i][j] = coins[i];
                else if (i + 1 == j) dp[i][j] = Math.max(coins[i], coins[j]);
                else {
                    int takeLeft = coins[i] + Math.min(dp[i + 2][j], dp[i + 1][j - 1]);   // opponent leaves the worse one
                    int takeRight = coins[j] + Math.min(dp[i + 1][j - 1], dp[i][j - 2]);
                    dp[i][j] = Math.max(takeLeft, takeRight);
                }
            }
        return dp[0][n - 1];
    }

    public static void main(String[] args) {
        int[][] tests = {{2, 3, 15, 7}, {8, 15, 3, 7}, {20, 30, 2, 2, 2, 10}};
        for (int[] coins : tests) System.out.println(Arrays.toString(coins) + " -> " + optimalStrategy(coins));
    }
}
```

```javascript filename:JavaScript
function optimalStrategy(coins) {
    const n = coins.length;
    const dp = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let len = 1; len <= n; len++)                   // intervals by increasing length
        for (let i = 0; i + len - 1 < n; i++) {
            const j = i + len - 1;
            if (i === j) dp[i][j] = coins[i];
            else if (i + 1 === j) dp[i][j] = Math.max(coins[i], coins[j]);
            else {
                const takeLeft = coins[i] + Math.min(dp[i + 2][j], dp[i + 1][j - 1]);   // opponent leaves the worse one
                const takeRight = coins[j] + Math.min(dp[i + 1][j - 1], dp[i][j - 2]);
                dp[i][j] = Math.max(takeLeft, takeRight);
            }
        }
    return dp[0][n - 1];
}

for (const coins of [[2, 3, 15, 7], [8, 15, 3, 7], [20, 30, 2, 2, 2, 10]])
    console.log(`[${coins.join(", ")}] -> ${optimalStrategy(coins)}`);
```

```text filename:Output
[2, 3, 15, 7] -> 17
[8, 15, 3, 7] -> 22
[20, 30, 2, 2, 2, 10] -> 42
```

Time O(n²) · Space O(n²)

> [!NOTE] Key point
>
> An equivalent recurrence uses the interval sum: `dp[i][j] = sum(i..j) − min(dp[i+1][j], dp[i][j−1])` — whatever the opponent collects from the rest, you get the remainder. It needs only `O(1)` work per cell with prefix sums and no special case for `len = 2`.

# Egg dropping puzzle

> [!TIP] Example
>
> <strong>Input:</strong> `eggs = 1, floors = 10`<br><strong>Output:</strong> `10 (test every floor from the bottom)`<br><strong>Input:</strong> `eggs = 2, floors = 10`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `eggs = 2, floors = 36`<br><strong>Output:</strong> `8`

Find the <strong>highest safe floor</strong> of a building with `f` floors using `e` eggs, in the minimum number of drops <em>in the worst case</em>. Rules: an egg may break from the 1st floor; it may survive the top floor; if it breaks from floor `x` it breaks from every higher floor, and a surviving egg can be reused.

> [!NOTE] Idea
>
> Drop from floor `x`. If it <strong>breaks</strong>, the answer is below: `e-1` eggs, `x-1` floors. If it <strong>survives</strong>, the answer is above: `e` eggs, `f-x` floors. The adversary picks the worse outcome, so this choice costs `1 + max(...)`; we choose the `x` that minimises it. With one egg we must scan floor by floor (`f` drops).

`dp[e][f] = 1 + min over x = 1..f of max( dp[e−1][x−1], dp[e][f−x] ); dp[e][0] = 0, dp[e][1] = 1, dp[1][f] = f`

```python filename:Python
def egg_drop(e, f):
    dp = [[0] * (f + 1) for _ in range(e + 1)]
    for j in range(f + 1):
        dp[1][j] = j                                  # one egg: linear scan
    for i in range(2, e + 1):
        dp[i][1] = 1
        for j in range(2, f + 1):
            best = float("inf")
            for x in range(1, j + 1):                 # drop from floor x
                worst = 1 + max(dp[i - 1][x - 1], dp[i][j - x])   # breaks / survives
                best = min(best, worst)
            dp[i][j] = best
    return dp[e][f]

for e, f in [(1, 10), (2, 10), (2, 36), (3, 14)]:
    print(f"eggs {e}, floors {f}: {egg_drop(e, f)}")
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int eggDrop(int e, int f) {
    vector<vector<int>> dp(e + 1, vector<int>(f + 1, 0));
    for (int j = 0; j <= f; j++) dp[1][j] = j;          // one egg: linear scan
    for (int i = 2; i <= e; i++) {
        dp[i][1] = 1;
        for (int j = 2; j <= f; j++) {
            int best = 1e9;
            for (int x = 1; x <= j; x++)                  // drop from floor x
                best = min(best, 1 + max(dp[i - 1][x - 1], dp[i][j - x]));   // breaks / survives
            dp[i][j] = best;
        }
    }
    return dp[e][f];
}

int main() {
    int tests[][2] = {{1, 10}, {2, 10}, {2, 36}, {3, 14}};
    for (auto& t : tests) cout << "eggs " << t[0] << ", floors " << t[1] << ": " << eggDrop(t[0], t[1]) << "\n";
}
```

```java filename:Java
public class Main {
    static int eggDrop(int e, int f) {
        int[][] dp = new int[e + 1][f + 1];
        for (int j = 0; j <= f; j++) dp[1][j] = j;      // one egg: linear scan
        for (int i = 2; i <= e; i++) {
            dp[i][1] = 1;
            for (int j = 2; j <= f; j++) {
                int best = Integer.MAX_VALUE;
                for (int x = 1; x <= j; x++)              // drop from floor x
                    best = Math.min(best, 1 + Math.max(dp[i - 1][x - 1], dp[i][j - x]));   // breaks / survives
                dp[i][j] = best;
            }
        }
        return dp[e][f];
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 10}, {2, 10}, {2, 36}, {3, 14}};
        for (int[] t : tests) System.out.println("eggs " + t[0] + ", floors " + t[1] + ": " + eggDrop(t[0], t[1]));
    }
}
```

```javascript filename:JavaScript
function eggDrop(e, f) {
    const dp = Array.from({ length: e + 1 }, () => new Array(f + 1).fill(0));
    for (let j = 0; j <= f; j++) dp[1][j] = j;          // one egg: linear scan
    for (let i = 2; i <= e; i++) {
        dp[i][1] = 1;
        for (let j = 2; j <= f; j++) {
            let best = Infinity;
            for (let x = 1; x <= j; x++)                  // drop from floor x
                best = Math.min(best, 1 + Math.max(dp[i - 1][x - 1], dp[i][j - x]));   // breaks / survives
            dp[i][j] = best;
        }
    }
    return dp[e][f];
}

for (const [e, f] of [[1, 10], [2, 10], [2, 36], [3, 14]])
    console.log(`eggs ${e}, floors ${f}: ${eggDrop(e, f)}`);
```

```text filename:Output
eggs 1, floors 10: 10
eggs 2, floors 10: 4
eggs 2, floors 36: 8
eggs 3, floors 14: 4
```

Time O(e·f²) · Space O(e·f)

> [!NOTE] Key point
>
> Why 4 for 2 eggs and 10 floors: drop from floor 4 — if it breaks, scan 1-3 (3 more drops); if not, drop from 7, then 9, then 10. The classic 2-egg/100-floor answer is 14. Flipping the state to `moves[m][e]` = <em>how many floors can be covered</em> with `m` moves and `e` eggs gives an `O(e·log f)` solution.

# Count BSTs with n keys (Catalan numbers)

> [!TIP] Example
>
> <strong>Input:</strong> `n = 1`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `n = 3`<br><strong>Output:</strong> `5`<br><strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `42`

> [!NOTE] Idea
>
> Pick key `j` (`1..n`) as the root: the `j-1` smaller keys form the left subtree and the `n-j` larger keys the right, independently. So `count(n)` is the sum over all roots of `count(left) × count(right)` — the recurrence of the <strong>Catalan numbers</strong>. The same count answers “how many binary trees with `n` nodes” and “how many ways to parenthesise `n+1` factors”.

`C(n) = Σ_{j=0}^{n−1} C(j) · C(n−1−j); C(0) = C(1) = 1; closed form C(n) = (2n)! / ((n+1)! · n!)`

```text filename:The%20two%20shapes%20with%20root%201%3A%20the%20right%20subtree%20%7B2%2C%203%7D%20can%20be%20either%20chain%3B%20root%202%20gives%20one%20shape%3B%20root%203%20mirrors%20root%201
n = 3, keys {1, 2, 3}:

root 1: left {}    × right {2,3} → C(0)·C(2) = 1 × 2 = 2        1          1
root 2: left {1}   × right {3}   → C(1)·C(1) = 1 × 1 = 1         \                  root 3: left {1,2} × right {}    → C(2)·C(0) = 2 × 1 = 2          2          3
                                              total  5             \        /
                                                                    3      2
```

```python filename:Python
def count_bst(n):
    dp = [0] * (n + 1)
    dp[0] = dp[1] = 1
    for i in range(2, n + 1):
        for j in range(i):                           # j keys on the left, i-1-j on the right
            dp[i] += dp[j] * dp[i - 1 - j]
    return dp

dp = count_bst(6)
print("C(0..6):", " ".join(map(str, dp)))
for n in (1, 3, 5):
    print(f"BSTs with {n} keys: {dp[n]}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

vector<long long> countBst(int n) {
    vector<long long> dp(n + 1, 0);
    dp[0] = dp[1] = 1;
    for (int i = 2; i <= n; i++)
        for (int j = 0; j < i; j++)                      // j keys on the left, i-1-j on the right
            dp[i] += dp[j] * dp[i - 1 - j];
    return dp;
}

int main() {
    vector<long long> dp = countBst(6);
    cout << "C(0..6):";
    for (long long x : dp) cout << " " << x;
    cout << "\n";
    for (int n : {1, 3, 5}) cout << "BSTs with " << n << " keys: " << dp[n] << "\n";
}
```

```java filename:Java
public class Main {
    static long[] countBst(int n) {
        long[] dp = new long[n + 1];
        dp[0] = dp[1] = 1;
        for (int i = 2; i <= n; i++)
            for (int j = 0; j < i; j++)                  // j keys on the left, i-1-j on the right
                dp[i] += dp[j] * dp[i - 1 - j];
        return dp;
    }

    public static void main(String[] args) {
        long[] dp = countBst(6);
        StringBuilder sb = new StringBuilder("C(0..6):");
        for (long x : dp) sb.append(" ").append(x);
        System.out.println(sb);
        for (int n : new int[]{1, 3, 5}) System.out.println("BSTs with " + n + " keys: " + dp[n]);
    }
}
```

```javascript filename:JavaScript
function countBst(n) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = dp[1] = 1;
    for (let i = 2; i <= n; i++)
        for (let j = 0; j < i; j++)                      // j keys on the left, i-1-j on the right
            dp[i] += dp[j] * dp[i - 1 - j];
    return dp;
}

const dp = countBst(6);
console.log("C(0..6):", dp.join(" "));
for (const n of [1, 3, 5]) console.log(`BSTs with ${n} keys: ${dp[n]}`);
```

```text filename:Output
C(0..6): 1 1 2 5 14 42 132
BSTs with 1 keys: 1
BSTs with 3 keys: 5
BSTs with 5 keys: 42
```

Time O(n²) · Space O(n)

> [!NOTE] Key point
>
> Catalan numbers grow fast (`C(19) = 1,767,263,190` is the last one that fits in a 32-bit `int`) — use 64-bit integers in C++/Java.

# Maximum sum with no two consecutive elements

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 10, 2]`<br><strong>Output:</strong> `10`<br><strong>Input:</strong> `arr = [8, 7, 6, 10]`<br><strong>Output:</strong> `18 (8 + 10)`<br><strong>Input:</strong> `arr = [5, 5, 10, 100, 10, 5]`<br><strong>Output:</strong> `110 (5 + 100 + 5)`

> [!NOTE] Idea
>
> Consider the last element. Either it is <strong>in</strong> the answer — then the one before it is not, and we add the best for the first `n-2` — or it is <strong>out</strong>, and the answer is the best for the first `n-1`. `dp[i]` = best sum using the first `i` elements. Only the last two values are needed, so two variables suffice.

`dp[i] = max( dp[i−1], dp[i−2] + arr[i−1] ); dp[1] = arr[0], dp[2] = max(arr[0], arr[1])`

```python filename:Python
def max_sum_no_adjacent(arr):
    n = len(arr)
    if n == 1:
        return arr[0]
    prev2 = arr[0]                      # dp[i-2]
    prev1 = max(arr[0], arr[1])         # dp[i-1]
    for i in range(2, n):
        cur = max(prev1, prev2 + arr[i])   # skip arr[i] / take arr[i]
        prev2, prev1 = prev1, cur
    return prev1

for arr in [[1, 10, 2], [8, 7, 6, 10], [5, 5, 10, 100, 10, 5]]:
    print("[" + ", ".join(map(str, arr)) + "] ->", max_sum_no_adjacent(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int maxSumNoAdjacent(const vector<int>& arr) {
    int n = arr.size();
    if (n == 1) return arr[0];
    int prev2 = arr[0];                           // dp[i-2]
    int prev1 = max(arr[0], arr[1]);              // dp[i-1]
    for (int i = 2; i < n; i++) {
        int cur = max(prev1, prev2 + arr[i]);     // skip arr[i] / take arr[i]
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}

void show(const vector<int>& arr) {
    cout << "[";
    for (int i = 0; i < (int)arr.size(); i++) cout << (i ? ", " : "") << arr[i];
    cout << "] -> " << maxSumNoAdjacent(arr) << "\n";
}

int main() {
    show({1, 10, 2});
    show({8, 7, 6, 10});
    show({5, 5, 10, 100, 10, 5});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int maxSumNoAdjacent(int[] arr) {
        int n = arr.length;
        if (n == 1) return arr[0];
        int prev2 = arr[0];                       // dp[i-2]
        int prev1 = Math.max(arr[0], arr[1]);     // dp[i-1]
        for (int i = 2; i < n; i++) {
            int cur = Math.max(prev1, prev2 + arr[i]);   // skip arr[i] / take arr[i]
            prev2 = prev1;
            prev1 = cur;
        }
        return prev1;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 10, 2}, {8, 7, 6, 10}, {5, 5, 10, 100, 10, 5}};
        for (int[] arr : tests) System.out.println(Arrays.toString(arr) + " -> " + maxSumNoAdjacent(arr));
    }
}
```

```javascript filename:JavaScript
function maxSumNoAdjacent(arr) {
    const n = arr.length;
    if (n === 1) return arr[0];
    let prev2 = arr[0];                           // dp[i-2]
    let prev1 = Math.max(arr[0], arr[1]);         // dp[i-1]
    for (let i = 2; i < n; i++) {
        const cur = Math.max(prev1, prev2 + arr[i]);   // skip arr[i] / take arr[i]
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}

for (const arr of [[1, 10, 2], [8, 7, 6, 10], [5, 5, 10, 100, 10, 5]])
    console.log(`[${arr.join(", ")}] -> ${maxSumNoAdjacent(arr)}`);
```

```text filename:Output
[1, 10, 2] -> 10
[8, 7, 6, 10] -> 18
[5, 5, 10, 100, 10, 5] -> 110
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> The notes' table version sets `dp[2] = max(arr[0], arr[1])` unconditionally — it crashes on a single-element array. Handle `n == 1` first. This is the “House Robber” problem on LeetCode; the circular variant runs the same routine twice (without the first and without the last house).

# Subset sum

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 34, 4, 12, 5, 2], sum = 9`<br><strong>Output:</strong> `Yes (4 + 5)`<br><strong>Input:</strong> `arr = [3, 34, 4, 12, 5, 2], sum = 30`<br><strong>Output:</strong> `No`

Decide whether some subset of the array adds up exactly to `sum`. It is 0-1 knapsack with “fits” replaced by “exists”: every element is used at most once and there is no value to maximise.

> [!NOTE] Idea
>
> `dp[i][j]` is `true` when some subset of the first `i` elements sums to `j`. Either the `i`-th element is not used (`dp[i-1][j]`) or it is (`dp[i-1][j - arr[i-1]]`). Sum 0 is always reachable (the empty subset). The table is boolean, so a single row updated right-to-left is enough.

`dp[i][j] = dp[i−1][j] OR dp[i−1][j − arr[i−1]] (if arr[i−1] ≤ j); dp[i][0] = true, dp[0][j>0] = false`

```python filename:Python
def subset_sum(arr, target):
    dp = [False] * (target + 1)
    dp[0] = True                                  # the empty subset
    for x in arr:
        for j in range(target, x - 1, -1):        # right to left: each x used at most once
            if dp[j - x]:
                dp[j] = True
    return dp[target]

arr = [3, 34, 4, 12, 5, 2]
for s in (9, 30, 0):
    print(f"sum {s}:", "Yes" if subset_sum(arr, s) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

bool subsetSum(const vector<int>& arr, int target) {
    vector<bool> dp(target + 1, false);
    dp[0] = true;                                      // the empty subset
    for (int x : arr)
        for (int j = target; j >= x; j--)              // right to left: each x used at most once
            if (dp[j - x]) dp[j] = true;
    return dp[target];
}

int main() {
    vector<int> arr = {3, 34, 4, 12, 5, 2};
    for (int s : {9, 30, 0})
        cout << "sum " << s << ": " << (subsetSum(arr, s) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean subsetSum(int[] arr, int target) {
        boolean[] dp = new boolean[target + 1];
        dp[0] = true;                                  // the empty subset
        for (int x : arr)
            for (int j = target; j >= x; j--)          // right to left: each x used at most once
                if (dp[j - x]) dp[j] = true;
        return dp[target];
    }

    public static void main(String[] args) {
        int[] arr = {3, 34, 4, 12, 5, 2};
        for (int s : new int[]{9, 30, 0})
            System.out.println("sum " + s + ": " + (subsetSum(arr, s) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function subsetSum(arr, target) {
    const dp = new Array(target + 1).fill(false);
    dp[0] = true;                                      // the empty subset
    for (const x of arr)
        for (let j = target; j >= x; j--)              // right to left: each x used at most once
            if (dp[j - x]) dp[j] = true;
    return dp[target];
}

const arr = [3, 34, 4, 12, 5, 2];
for (const s of [9, 30, 0])
    console.log(`sum ${s}:`, subsetSum(arr, s) ? "Yes" : "No");
```

```text filename:Output
sum 9: Yes
sum 30: No
sum 0: Yes
```

Time O(n·sum) · Space O(sum)

<strong>Counting</strong> the subsets instead of deciding is the same table with `+` instead of `OR` — the version in the original notes:

```python filename:Python
def count_subsets(arr, target):
    n = len(arr)
    dp = [[0] * (target + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = 1                                   # the empty subset
    for i in range(1, n + 1):
        for j in range(1, target + 1):
            dp[i][j] = dp[i - 1][j]                    # without arr[i-1]
            if arr[i - 1] <= j:
                dp[i][j] += dp[i - 1][j - arr[i - 1]]  # with arr[i-1]
    return dp[n][target]

print(count_subsets([1, 2, 3, 4, 5, 6, 7, 8], 10))     # 1+2+3+4, 1+2+7, 1+3+6, 1+4+5, 2+3+5, 2+8, 3+7, 4+6
print(count_subsets([2, 3, 5, 6, 8, 10], 10))          # 2+8, 2+3+5, 10
```

```text filename:Output
8
3
```

> [!NOTE] Key point
>
> Related: <strong>Partition equal subset sum</strong> (is there a subset with sum `total/2`?) and <strong>minimum subset-sum difference</strong> (find the reachable sum closest to `total/2`). Both are this table read differently. Subset sum is NP-complete in general; the DP is pseudo-polynomial because it depends on the magnitude of `sum`.

# Matrix chain multiplication

> [!TIP] Example
>
> <strong>Input:</strong> `dims = [2, 1, 3] (a 2×1 matrix times a 1×3 matrix)`<br><strong>Output:</strong> `6`<br><strong>Input:</strong> `dims = [40, 20, 30, 10, 30]`<br><strong>Output:</strong> `26000`<br><strong>Input:</strong> `dims = [10, 20, 30, 40, 30]`<br><strong>Output:</strong> `30000`

Multiplying a `p×q` matrix by a `q×r` matrix costs `p·q·r` scalar multiplications. Matrix multiplication is associative, so a chain `A1·A2·…·An` can be parenthesised in many ways with wildly different costs. `dims[i-1] × dims[i]` is the size of matrix `Ai`; find the cheapest order.

```text filename:Same%20product%2C%20different%20parenthesisation%3A%20the%20cost%20almost%20doubles
dims = [40, 20, 30, 10, 30]  →  A1: 40×20   A2: 20×30   A3: 30×10   A4: 10×30

(A1·(A2·A3))·A4 :  A2·A3 = 20·30·10 = 6000,  A1·(…) = 40·20·10 = 8000,  (…)·A4 = 40·10·30 = 12000  → 26000  ✓
((A1·A2)·A3)·A4 :  A1·A2 = 40·20·30 = 24000, (…)·A3 = 40·30·10 = 12000, (…)·A4 = 40·10·30 = 12000  → 48000
```

> [!NOTE] Idea
>
> `dp[i][j]` = minimum cost of multiplying matrices `Ai..Aj`. The <strong>last</strong> multiplication splits the chain at some `k`: `(Ai..Ak) · (Ak+1..Aj)`, costing the two halves plus `dims[i-1] · dims[k] · dims[j]` for the final product. Try every `k`; a single matrix costs 0. Fill by increasing chain length so both halves are ready.

`dp[i][j] = min over i ≤ k < j of ( dp[i][k] + dp[k+1][j] + dims[i−1]·dims[k]·dims[j] ); dp[i][i] = 0`

```python filename:Python
def matrix_chain(dims):
    n = len(dims)                                  # matrices are 1..n-1
    dp = [[0] * n for _ in range(n)]
    for length in range(2, n):                     # number of matrices in the chain
        for i in range(1, n - length + 1):
            j = i + length - 1
            dp[i][j] = float("inf")
            for k in range(i, j):                  # last split: (i..k)(k+1..j)
                cost = dp[i][k] + dp[k + 1][j] + dims[i - 1] * dims[k] * dims[j]
                dp[i][j] = min(dp[i][j], cost)
    return dp[1][n - 1]

for dims in [[2, 1, 3], [40, 20, 30, 10, 30], [10, 20, 30, 40, 30]]:
    print("[" + ", ".join(map(str, dims)) + "] ->", matrix_chain(dims))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

long long matrixChain(const vector<int>& dims) {
    int n = dims.size();                                     // matrices are 1..n-1
    vector<vector<long long>> dp(n, vector<long long>(n, 0));
    for (int len = 2; len < n; len++)                        // number of matrices in the chain
        for (int i = 1; i + len - 1 < n; i++) {
            int j = i + len - 1;
            dp[i][j] = 1e18;
            for (int k = i; k < j; k++)                      // last split: (i..k)(k+1..j)
                dp[i][j] = min(dp[i][j], dp[i][k] + dp[k + 1][j] + (long long)dims[i - 1] * dims[k] * dims[j]);
        }
    return dp[1][n - 1];
}

void show(const vector<int>& dims) {
    cout << "[";
    for (int i = 0; i < (int)dims.size(); i++) cout << (i ? ", " : "") << dims[i];
    cout << "] -> " << matrixChain(dims) << "\n";
}

int main() {
    show({2, 1, 3});
    show({40, 20, 30, 10, 30});
    show({10, 20, 30, 40, 30});
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static long matrixChain(int[] dims) {
        int n = dims.length;                                 // matrices are 1..n-1
        long[][] dp = new long[n][n];
        for (int len = 2; len < n; len++)                    // number of matrices in the chain
            for (int i = 1; i + len - 1 < n; i++) {
                int j = i + len - 1;
                dp[i][j] = Long.MAX_VALUE;
                for (int k = i; k < j; k++)                  // last split: (i..k)(k+1..j)
                    dp[i][j] = Math.min(dp[i][j], dp[i][k] + dp[k + 1][j] + (long) dims[i - 1] * dims[k] * dims[j]);
            }
        return dp[1][n - 1];
    }

    public static void main(String[] args) {
        int[][] tests = {{2, 1, 3}, {40, 20, 30, 10, 30}, {10, 20, 30, 40, 30}};
        for (int[] dims : tests) System.out.println(Arrays.toString(dims) + " -> " + matrixChain(dims));
    }
}
```

```javascript filename:JavaScript
function matrixChain(dims) {
    const n = dims.length;                                   // matrices are 1..n-1
    const dp = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let len = 2; len < n; len++)                        // number of matrices in the chain
        for (let i = 1; i + len - 1 < n; i++) {
            const j = i + len - 1;
            dp[i][j] = Infinity;
            for (let k = i; k < j; k++)                      // last split: (i..k)(k+1..j)
                dp[i][j] = Math.min(dp[i][j], dp[i][k] + dp[k + 1][j] + dims[i - 1] * dims[k] * dims[j]);
        }
    return dp[1][n - 1];
}

for (const dims of [[2, 1, 3], [40, 20, 30, 10, 30], [10, 20, 30, 40, 30]])
    console.log(`[${dims.join(", ")}] -> ${matrixChain(dims)}`);
```

```text filename:Output
[2, 1, 3] -> 6
[40, 20, 30, 10, 30] -> 26000
[10, 20, 30, 40, 30] -> 30000
```

Time O(n³) · Space O(n²)

> [!WARNING] Pitfall
>
> Off-by-one in the dimensions: matrix `Ai` is `dims[i-1] × dims[i]`, so the final product of `(i..k)(k+1..j)` costs `dims[i-1]·dims[k]·dims[j]` — not `dims[i]·dims[k]·dims[j]`. Check with `[2, 1, 3]`: one multiplication, `2·1·3 = 6`.

# Palindrome partitioning

> [!TIP] Example
>
> <strong>Input:</strong> `s = "geek"`<br><strong>Output:</strong> `2 (g | ee | k)`<br><strong>Input:</strong> `s = "abbac"`<br><strong>Output:</strong> `1 (abba | c)`<br><strong>Input:</strong> `s = "aab"`<br><strong>Output:</strong> `1 (aa | b)`

Find the <strong>minimum number of cuts</strong> so that every piece of the string is a palindrome. A string that is already a palindrome needs 0 cuts.

> [!NOTE] Idea
>
> Two tables. `pal[i][j]` says whether `s[i..j]` is a palindrome — `s[i] == s[j]` and the inside is a palindrome (any string of length ≤ 2 with equal ends qualifies). `cuts[j]` = minimum cuts for the prefix `s[0..j]`: if some `s[i..j]` is a palindrome, the prefix `s[0..i-1]` plus one more cut is a candidate; `i = 0` means the whole prefix is a palindrome → 0 cuts.

`cuts[j] = min over i ≤ j with pal[i][j] of ( 0 if i = 0 else cuts[i−1] + 1 ); pal[i][j] = s[i] = s[j] AND (j − i ≤ 2 OR pal[i+1][j−1])`

The straightforward recursion tries every cut position of every substring and recomputes the palindrome checks each time — `O(2^n)`:

```python filename:Python
def is_pal(s, i, j):
    while i < j:
        if s[i] != s[j]:
            return False
        i += 1; j -= 1
    return True

def min_cuts_rec(s, i, j):
    if is_pal(s, i, j):
        return 0                                   # whole piece is a palindrome
    best = float("inf")
    for k in range(i, j):                          # cut after position k
        best = min(best, 1 + min_cuts_rec(s, i, k) + min_cuts_rec(s, k + 1, j))
    return best

print(min_cuts_rec("geek", 0, 3))
print(min_cuts_rec("abbac", 0, 4))
```

```text filename:Output
2
1
```

```python filename:Python
def min_cuts(s):
    n = len(s)
    pal = [[False] * n for _ in range(n)]
    cuts = [0] * n
    for j in range(n):                                  # end of the prefix
        best = float("inf")
        for i in range(j + 1):                          # candidate last piece s[i..j]
            if s[i] == s[j] and (j - i <= 2 or pal[i + 1][j - 1]):
                pal[i][j] = True
                best = 0 if i == 0 else min(best, cuts[i - 1] + 1)
        cuts[j] = best
    return cuts[n - 1]

for s in ["geek", "abbac", "aab", "ababbbabbababa"]:
    print(s, "->", min_cuts(s))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int minCuts(const string& s) {
    int n = s.size();
    vector<vector<bool>> pal(n, vector<bool>(n, false));
    vector<int> cuts(n, 0);
    for (int j = 0; j < n; j++) {                           // end of the prefix
        int best = 1e9;
        for (int i = 0; i <= j; i++)                        // candidate last piece s[i..j]
            if (s[i] == s[j] && (j - i <= 2 || pal[i + 1][j - 1])) {
                pal[i][j] = true;
                best = i == 0 ? 0 : min(best, cuts[i - 1] + 1);
            }
        cuts[j] = best;
    }
    return cuts[n - 1];
}

int main() {
    for (string s : {"geek", "abbac", "aab", "ababbbabbababa"})
        cout << s << " -> " << minCuts(s) << "\n";
}
```

```java filename:Java
public class Main {
    static int minCuts(String s) {
        int n = s.length();
        boolean[][] pal = new boolean[n][n];
        int[] cuts = new int[n];
        for (int j = 0; j < n; j++) {                       // end of the prefix
            int best = Integer.MAX_VALUE;
            for (int i = 0; i <= j; i++)                    // candidate last piece s[i..j]
                if (s.charAt(i) == s.charAt(j) && (j - i <= 2 || pal[i + 1][j - 1])) {
                    pal[i][j] = true;
                    best = i == 0 ? 0 : Math.min(best, cuts[i - 1] + 1);
                }
            cuts[j] = best;
        }
        return cuts[n - 1];
    }

    public static void main(String[] args) {
        for (String s : new String[]{"geek", "abbac", "aab", "ababbbabbababa"})
            System.out.println(s + " -> " + minCuts(s));
    }
}
```

```javascript filename:JavaScript
function minCuts(s) {
    const n = s.length;
    const pal = Array.from({ length: n }, () => new Array(n).fill(false));
    const cuts = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {                           // end of the prefix
        let best = Infinity;
        for (let i = 0; i <= j; i++)                        // candidate last piece s[i..j]
            if (s[i] === s[j] && (j - i <= 2 || pal[i + 1][j - 1])) {
                pal[i][j] = true;
                best = i === 0 ? 0 : Math.min(best, cuts[i - 1] + 1);
            }
        cuts[j] = best;
    }
    return cuts[n - 1];
}

for (const s of ["geek", "abbac", "aab", "ababbbabbababa"])
    console.log(s, "->", minCuts(s));
```

```text filename:Output
geek -> 2
abbac -> 1
aab -> 1
ababbbabbababa -> 3
```

Time O(n²) · Space O(n²) for the palindrome table

> [!WARNING] Pitfall
>
> Once `i == 0` makes the whole prefix a palindrome, `best` must become 0 and stay 0 — do not `min` it with later candidates (they can only be ≥ 0 anyway, but writing `best = min(best, 0)` hides the intent). Also note `pal[i+1][j-1]` is only read when `j - i > 2`, so the indices never go out of range.

# Allocate minimum pages

> [!TIP] Example
>
> <strong>Input:</strong> `pages = [12, 34, 67, 90], students = 2`<br><strong>Output:</strong> `113 ([12, 34, 67] | [90])`<br><strong>Input:</strong> `pages = [10, 20, 30, 40], students = 2`<br><strong>Output:</strong> `60 ([10, 20, 30] | [40])`

Books are in a fixed order and each student gets a <strong>contiguous</strong> block of books. Minimise the maximum number of pages any one student reads.

> [!NOTE] Idea
>
> `dp[i][j]` = the best (smallest) maximum load when the first `j` books are split among `i` students. The last student takes books `p+1..j` for some `p`; the first `p` books go to the other `i-1` students. The load of this split is the larger of `dp[i-1][p]` and `pages(p+1..j)`; take the `p` that minimises it. With one student, `dp[1][j]` is just the prefix sum.

`dp[i][j] = min over 0 < p < j of max( dp[i−1][p], prefix[j] − prefix[p] ); dp[1][j] = prefix[j]`

```python filename:Python
def min_pages(pages, k):
    n = len(pages)
    prefix = [0] * (n + 1)
    for i in range(n):
        prefix[i + 1] = prefix[i] + pages[i]            # sum of books 0..i-1
    INF = float("inf")
    dp = [[INF] * (n + 1) for _ in range(k + 1)]
    for j in range(n + 1):
        dp[1][j] = prefix[j]                             # one student reads everything
    for i in range(2, k + 1):
        for j in range(1, n + 1):
            for p in range(1, j):                        # last student takes books p..j-1
                load = max(dp[i - 1][p], prefix[j] - prefix[p])
                dp[i][j] = min(dp[i][j], load)
    return dp[k][n]

for pages, k in [([12, 34, 67, 90], 2), ([10, 20, 30, 40], 2), ([12, 34, 67, 90], 3)]:
    print("[" + ", ".join(map(str, pages)) + "] with", k, "students ->", min_pages(pages, k))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int minPages(const vector<int>& pages, int k) {
    int n = pages.size();
    vector<int> prefix(n + 1, 0);
    for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + pages[i];   // sum of books 0..i-1
    const int INF = 1e9;
    vector<vector<int>> dp(k + 1, vector<int>(n + 1, INF));
    for (int j = 0; j <= n; j++) dp[1][j] = prefix[j];                 // one student reads everything
    for (int i = 2; i <= k; i++)
        for (int j = 1; j <= n; j++)
            for (int p = 1; p < j; p++)                                  // last student takes books p..j-1
                dp[i][j] = min(dp[i][j], max(dp[i - 1][p], prefix[j] - prefix[p]));
    return dp[k][n];
}

void show(const vector<int>& pages, int k) {
    cout << "[";
    for (int i = 0; i < (int)pages.size(); i++) cout << (i ? ", " : "") << pages[i];
    cout << "] with " << k << " students -> " << minPages(pages, k) << "\n";
}

int main() {
    show({12, 34, 67, 90}, 2);
    show({10, 20, 30, 40}, 2);
    show({12, 34, 67, 90}, 3);
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int minPages(int[] pages, int k) {
        int n = pages.length;
        int[] prefix = new int[n + 1];
        for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + pages[i];   // sum of books 0..i-1
        final int INF = 1_000_000_000;
        int[][] dp = new int[k + 1][n + 1];
        for (int[] row : dp) Arrays.fill(row, INF);
        for (int j = 0; j <= n; j++) dp[1][j] = prefix[j];                 // one student reads everything
        for (int i = 2; i <= k; i++)
            for (int j = 1; j <= n; j++)
                for (int p = 1; p < j; p++)                                  // last student takes books p..j-1
                    dp[i][j] = Math.min(dp[i][j], Math.max(dp[i - 1][p], prefix[j] - prefix[p]));
        return dp[k][n];
    }

    public static void main(String[] args) {
        int[][] tests = {{12, 34, 67, 90}, {10, 20, 30, 40}, {12, 34, 67, 90}};
        int[] students = {2, 2, 3};
        for (int t = 0; t < tests.length; t++)
            System.out.println(Arrays.toString(tests[t]) + " with " + students[t] + " students -> " + minPages(tests[t], students[t]));
    }
}
```

```javascript filename:JavaScript
function minPages(pages, k) {
    const n = pages.length;
    const prefix = new Array(n + 1).fill(0);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + pages[i];   // sum of books 0..i-1
    const dp = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
    for (let j = 0; j <= n; j++) dp[1][j] = prefix[j];                 // one student reads everything
    for (let i = 2; i <= k; i++)
        for (let j = 1; j <= n; j++)
            for (let p = 1; p < j; p++)                                  // last student takes books p..j-1
                dp[i][j] = Math.min(dp[i][j], Math.max(dp[i - 1][p], prefix[j] - prefix[p]));
    return dp[k][n];
}

for (const [pages, k] of [[[12, 34, 67, 90], 2], [[10, 20, 30, 40], 2], [[12, 34, 67, 90], 3]])
    console.log(`[${pages.join(", ")}] with ${k} students -> ${minPages(pages, k)}`);
```

```text filename:Output
[12, 34, 67, 90] with 2 students -> 113
[10, 20, 30, 40] with 2 students -> 60
[12, 34, 67, 90] with 3 students -> 90
```

Time O(k·n²) · Space O(k·n)

> [!NOTE] Key point
>
> The DP is the natural first solution, but the standard interview answer is <strong>binary search on the answer</strong> (Searching topic): guess a maximum load, check greedily whether `k` students suffice, and narrow the range — `O(n log(sum))`. Know both and say why the DP is slower.

# Interview Q&amp;A

```question
What is the difference between dynamic programming and divide and conquer?

---

Both split a problem into subproblems and combine the answers. Divide and conquer (merge sort, quicksort) produces <em>independent</em> subproblems, so nothing is reused. DP applies when the subproblems <em>overlap</em> — the same instance is needed many times — and stores each answer once. Without overlap, memoization adds cost and no benefit.
```

```question
Memoization or tabulation — which should I use in an interview?

---

Start with the recursive formulation (it is how you <em>find</em> the recurrence), then add a memo — that is usually enough and hard to get wrong. Switch to tabulation when recursion depth is a risk (Python, `n` in the 10⁴ range), when you need the whole table (printing the LCS), or when a rolling row can cut space — e.g. knapsack in `O(W)` instead of `O(n·W)`.
```

```question
How do you spot that a problem is DP?

---

Three signs: it asks for an optimum (min/max), a count, or a yes/no over <em>choices</em> (take/skip, cut here/there); a brute-force recursion exists whose calls repeat; and the answer for a bigger input is built from answers for strictly smaller inputs (optimal substructure). Then name the state in words — if you cannot say what `dp[i][j]` means, you do not have a recurrence yet.
```

```question
Why is the 0-1 knapsack DP called pseudo-polynomial?

---

Its running time `O(n·W)` is polynomial in the <em>numeric value</em> of the capacity `W`, not in the number of bits used to write `W`. Doubling the number of digits of `W` squares the running time. Knapsack and subset sum remain NP-complete; the DP is only efficient when the numbers are small.
```

```question
How do you reconstruct the actual solution, not just its value?

---

Keep the table and walk back from the final cell, re-deciding at each step which branch produced the stored value — as in “Printing the LCS”. For knapsack, compare `dp[i][w]` with `dp[i-1][w]`: if they differ, item `i` was taken and `w` shrinks by its weight. Rolling-row space optimisations destroy this information, so keep the full table when you must reconstruct.
```

```question
What is the role of the order of loops in the 1-D coin change?

---

With `dp[j] += dp[j - coin]` and the coins in the <em>outer</em> loop, each coin is introduced once and the array counts combinations (`{1, 3}` once). With the sums in the outer loop and the coins inside, every ordering of the same coins is counted separately — permutations. For <em>minimum</em> coins the order does not matter because `min` is idempotent.
```
