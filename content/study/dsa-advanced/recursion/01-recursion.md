---
id: 86075263-b1f7-7f37-8dd6-69236a901158
key: topic:dsa-advanced/recursion
subject: dsa-advanced
topic: recursion
title: Recursion
slug: recursion
order: 1
---

Recursion solves a problem by calling itself on a <strong>smaller instance</strong> and trusting that call's answer. The problems here — rope cutting, subsets, Tower of Hanoi, Josephus, subset sum and permutations — are the templates for backtracking and dynamic programming later in the course.

> [!INFO]
>
> <strong>Recursion</strong> — a function that calls itself with an input strictly closer to a <strong>base case</strong>, which is answered directly. Each active call lives in its own stack frame, so the maximum depth of the recursion is also the auxiliary space.

# How a recursive call runs

Every call pushes a frame (parameters, locals, return address) on the <strong>call stack</strong>; the frame is popped when the call returns. Work written <em>before</em> the recursive call happens on the way <strong>down</strong>, work <em>after</em> it happens on the way <strong>up</strong> — the trace below shows both.

```python filename:Python
def trace(n):
    if n == 0:                    # base case: answered without another call
        print("base case reached")
        return
    print("enter", n)             # on the way down
    trace(n - 1)                  # smaller instance
    print("exit", n)              # on the way up, after the sub-call finished

trace(3)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void trace(int n) {
    if (n == 0) {                 // base case: answered without another call
        cout << "base case reached\n";
        return;
    }
    cout << "enter " << n << "\n";    // on the way down
    trace(n - 1);                     // smaller instance
    cout << "exit " << n << "\n";     // on the way up, after the sub-call finished
}

int main() { trace(3); }
```

```java filename:Java
public class Main {
    static void trace(int n) {
        if (n == 0) {             // base case: answered without another call
            System.out.println("base case reached");
            return;
        }
        System.out.println("enter " + n);   // on the way down
        trace(n - 1);                       // smaller instance
        System.out.println("exit " + n);    // on the way up, after the sub-call finished
    }

    public static void main(String[] args) { trace(3); }
}
```

```javascript filename:JavaScript
function trace(n) {
    if (n === 0) {                // base case: answered without another call
        console.log("base case reached");
        return;
    }
    console.log("enter", n);      // on the way down
    trace(n - 1);                 // smaller instance
    console.log("exit", n);       // on the way up, after the sub-call finished
}

trace(3);
```

```text filename:Output
enter 3
enter 2
enter 1
base case reached
exit 1
exit 2
exit 3
```

```text filename:Depth%204%20%3D%20O(n)%20auxiliary%20space%2C%20even%20though%20the%20function%20declares%20no%20arrays
trace(3)                         call stack (top is the running call)
 └ trace(2)                      ┌──────────┐
    └ trace(1)                   │ trace(0) │ ← base case, 4 frames deep
       └ trace(0)  base case     │ trace(1) │
                                 │ trace(2) │
                                 │ trace(3) │
                                 └──────────┘
```

> [!NOTE] Base case first
>
> Without it the recursion never stops: Python raises `RecursionError` at \~1000 frames, C++/Java crash with a stack overflow.

> [!NOTE] Make progress
>
> Every call must move strictly towards the base case (`n-1`, `i+1`, a shorter string).

> [!NOTE] Trust the sub-call
>
> Assume `f(n-1)` is correct and only write how to build `f(n)` from it — the <em>recursive leap of faith</em>.

> [!NOTE] Count the tree
>
> Time ≈ number of nodes in the recursion tree (branching^depth); space = its height.

# Rope cutting problem

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5, a = 2, b = 5, c = 1`<br><strong>Output:</strong> `5`<br><strong>Input:</strong> `n = 23, a = 12, b = 9, c = 11`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `n = 5, a = 4, b = 2, c = 6`<br><strong>Output:</strong> `-1`

Cut a rope of length `n` into the <strong>maximum number of pieces</strong>, each of length `a`, `b` or `c`; return `-1` if no exact division exists. For `n = 23` the best is `12 + 11` (2 pieces); for `n = 5` with `c = 1` it is five unit pieces.

> [!NOTE] Idea
>
> The first cut is `a`, `b` or `c`. Whichever it is, the rest of the rope is a smaller rope with the same question — so `maxPieces(n) = 1 + max(maxPieces(n-a), maxPieces(n-b), maxPieces(n-c))`. A rope of length `0` needs `0` more cuts (base case); a negative length means that cut overshoots and is reported as `-1`, which the `max` discards unless all three branches fail.

```text filename:Three%20branches%20per%20node%3B%20a%20negative%20length%20is%20a%20dead%20branch%20(-1)
maxPieces(5)  a=2 b=5 c=1
├── maxPieces(3)   (cut 2)
│   ├── maxPieces(1)  → ├ (-1) → -1   ├ (-4) → -1   ├ (0) → 0     ⇒ 1
│   ├── maxPieces(-2) → -1
│   └── maxPieces(2)  → … ⇒ 2
│                                          ⇒ 1 + max(1, -1, 2) = 3
├── maxPieces(0)   (cut 5)  → 0            ⇒ 0 + 1 = 1
└── maxPieces(4)   (cut 1)  → … ⇒ 4        ⇒ 5
                                           answer = max(3, 1, 5) = 5
```

```python filename:Python
def max_pieces(n, a, b, c):
    if n == 0:
        return 0                      # nothing left to cut: 0 more pieces
    if n < 0:
        return -1                     # this cut overshot the rope: invalid
    res = max(max_pieces(n - a, a, b, c),
              max_pieces(n - b, a, b, c),
              max_pieces(n - c, a, b, c))
    if res == -1:
        return -1                     # none of the three cuts can finish the rope
    return res + 1                    # +1 for the piece cut here

for n, a, b, c in ((5, 2, 5, 1), (23, 12, 9, 11), (5, 4, 2, 6)):
    print(f"n={n} a={a} b={b} c={c} ->", max_pieces(n, a, b, c))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <algorithm>
using namespace std;

int maxPieces(int n, int a, int b, int c) {
    if (n == 0) return 0;                 // nothing left to cut: 0 more pieces
    if (n < 0) return -1;                 // this cut overshot the rope: invalid
    int res = max({maxPieces(n - a, a, b, c),
                   maxPieces(n - b, a, b, c),
                   maxPieces(n - c, a, b, c)});
    if (res == -1) return -1;             // none of the three cuts can finish the rope
    return res + 1;                       // +1 for the piece cut here
}

int main() {
    int tests[3][4] = {{5, 2, 5, 1}, {23, 12, 9, 11}, {5, 4, 2, 6}};
    for (auto& t : tests)
        cout << "n=" << t[0] << " a=" << t[1] << " b=" << t[2] << " c=" << t[3]
             << " -> " << maxPieces(t[0], t[1], t[2], t[3]) << "\n";
}
```

```java filename:Java
public class Main {
    static int maxPieces(int n, int a, int b, int c) {
        if (n == 0) return 0;             // nothing left to cut: 0 more pieces
        if (n < 0) return -1;             // this cut overshot the rope: invalid
        int res = Math.max(maxPieces(n - a, a, b, c),
                  Math.max(maxPieces(n - b, a, b, c), maxPieces(n - c, a, b, c)));
        if (res == -1) return -1;         // none of the three cuts can finish the rope
        return res + 1;                   // +1 for the piece cut here
    }

    public static void main(String[] args) {
        int[][] tests = {{5, 2, 5, 1}, {23, 12, 9, 11}, {5, 4, 2, 6}};
        for (int[] t : tests)
            System.out.println("n=" + t[0] + " a=" + t[1] + " b=" + t[2] + " c=" + t[3]
                               + " -> " + maxPieces(t[0], t[1], t[2], t[3]));
    }
}
```

```javascript filename:JavaScript
function maxPieces(n, a, b, c) {
    if (n === 0) return 0;                // nothing left to cut: 0 more pieces
    if (n < 0) return -1;                 // this cut overshot the rope: invalid
    const res = Math.max(maxPieces(n - a, a, b, c),
                         maxPieces(n - b, a, b, c),
                         maxPieces(n - c, a, b, c));
    if (res === -1) return -1;            // none of the three cuts can finish the rope
    return res + 1;                       // +1 for the piece cut here
}

for (const [n, a, b, c] of [[5, 2, 5, 1], [23, 12, 9, 11], [5, 4, 2, 6]])
    console.log(`n=${n} a=${a} b=${b} c=${c} ->`, maxPieces(n, a, b, c));
```

```text filename:Output
n=5 a=2 b=5 c=1 -> 5
n=23 a=12 b=9 c=11 -> 2
n=5 a=4 b=2 c=6 -> -1
```

Time O(3^n) · Space O(n) recursion depth

> [!WARNING] Pitfall
>
> Returning `0` for a negative length (instead of `-1`) silently counts an impossible cut as valid and over-reports the answer. Also note the massive overlap in the tree — `maxPieces(2)` is computed many times. Memoising on `n` turns this into the `O(n)` dynamic-programming solution in the DP topic.

# Subsets of a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "AB"`<br><strong>Output:</strong> `"" B A AB`<br><strong>Input:</strong> `s = "ABC"`<br><strong>Output:</strong> `"" C B BC A AC AB ABC`

Generate all `2^n` subsets (subsequences keeping the original order) of a string of distinct characters.

> [!NOTE] Idea
>
> Walk the string one index at a time. For `s[i]` there are exactly two choices — <strong>leave it out</strong> or <strong>put it in</strong> — and the rest of the string is the same problem. When the index reaches the end, the accumulated `curr` is one finished subset. Two choices at each of `n` levels gives `2^n` leaves.

```text filename:Depth%20n%2C%202%5En%20leaves%20%E2%80%94%20one%20per%20subset.%20Exclude%20first%2C%20so%20the%20empty%20string%20is%20printed%20first
sub("", 0)                                       s = "ABC"
├── exclude A → sub("", 1)
│   ├── exclude B → sub("", 2)
│   │   ├── exclude C → ""      ✔
│   │   └── include C → "C"     ✔
│   └── include B → sub("B", 2)
│       ├── "B"  ✔     └── "BC" ✔
└── include A → sub("A", 1)
    ├── sub("A", 2)  → "A" ✔, "AC" ✔
    └── sub("AB", 2) → "AB" ✔, "ABC" ✔
```

```python filename:Python
def subsets(s, curr, i, out):
    if i == len(s):
        out.append(curr if curr else '""')    # a finished subset
        return
    subsets(s, curr, i + 1, out)              # exclude s[i]
    subsets(s, curr + s[i], i + 1, out)       # include s[i]

for s in ("AB", "ABC"):
    out = []
    subsets(s, "", 0, out)
    print(s, "->", " ".join(out), f"({len(out)} subsets)")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

void subsets(const string& s, string curr, int i, vector<string>& out) {
    if (i == (int)s.size()) {
        out.push_back(curr.empty() ? "\"\"" : curr);   // a finished subset
        return;
    }
    subsets(s, curr, i + 1, out);             // exclude s[i]
    subsets(s, curr + s[i], i + 1, out);      // include s[i]
}

int main() {
    for (string s : {"AB", "ABC"}) {
        vector<string> out;
        subsets(s, "", 0, out);
        cout << s << " ->";
        for (const string& x : out) cout << " " << x;
        cout << " (" << out.size() << " subsets)\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void subsets(String s, String curr, int i, List<String> out) {
        if (i == s.length()) {
            out.add(curr.isEmpty() ? "\"\"" : curr);  // a finished subset
            return;
        }
        subsets(s, curr, i + 1, out);                 // exclude s[i]
        subsets(s, curr + s.charAt(i), i + 1, out);   // include s[i]
    }

    public static void main(String[] args) {
        for (String s : new String[]{"AB", "ABC"}) {
            List<String> out = new ArrayList<>();
            subsets(s, "", 0, out);
            System.out.println(s + " -> " + String.join(" ", out) + " (" + out.size() + " subsets)");
        }
    }
}
```

```javascript filename:JavaScript
function subsets(s, curr, i, out) {
    if (i === s.length) {
        out.push(curr === "" ? '""' : curr);  // a finished subset
        return;
    }
    subsets(s, curr, i + 1, out);             // exclude s[i]
    subsets(s, curr + s[i], i + 1, out);      // include s[i]
}

for (const s of ["AB", "ABC"]) {
    const out = [];
    subsets(s, "", 0, out);
    console.log(s, "->", out.join(" "), `(${out.length} subsets)`);
}
```

```text filename:Output
AB -> "" B A AB (4 subsets)
ABC -> "" C B BC A AC AB ABC (8 subsets)
```

Time O(2^n · n) · Space O(n) recursion depth (plus the output)

> [!NOTE] Key point
>
> Swapping the two recursive calls (include first) lists `ABC AB AC A BC B C ""` instead — the set of subsets is the same, only the order changes. The iterative bitmask version of this problem is in Bit Magic → <em>Power set using bitmasks</em>. With repeated characters this prints duplicate subsets; sort the string and skip equal neighbours to avoid that.

# Tower of Hanoi

> [!TIP] Example
>
> <strong>Input:</strong> `n = 1`<br><strong>Output:</strong> `Move disc 1 from A to C`<br><strong>Input:</strong> `n = 2`<br><strong>Output:</strong> `Move disc 1 from A to B / Move disc 2 from A to C / Move disc 1 from B to C`

Move `n` discs from peg <strong>A</strong> (source) to peg <strong>C</strong> (destination) using peg <strong>B</strong> (auxiliary), under three rules:

1. Only <strong>one disc</strong> moves at a time.
2. A <strong>larger disc may never sit on a smaller</strong> one.
3. Only the <strong>top disc</strong> of a peg can be moved.

```text filename:n%20%3D%203%3A%20the%20whole%20tower%20must%20end%20on%20C%20in%20the%20same%20order
    A          B          C                 A          B          C
    |          |          |                 |          |          |
   ═╪═         |          |      →          |          |         ═╪═
  ══╪══        |          |                 |          |        ══╪══
 ═══╪═══       |          |                 |          |       ═══╪═══
────┴──────────┴──────────┴──          ────┴──────────┴──────────┴──
```

> [!NOTE] Idea
>
> To move `n` discs A → C, the biggest disc `n` can only move when the other `n-1` discs are out of the way on B. So: move `n-1` discs A → B (using C as spare), move disc `n` A → C, then move the `n-1` discs B → C (using A as spare). The recursion is the same problem with the pegs <strong>relabelled</strong> — that is why the function takes the three pegs as parameters.

1. <strong>`TOH(n-1, A, C, B)`</strong>

   Park the top `n-1` discs on the auxiliary peg B, using C as the spare.

2. <strong>Move disc </strong><strong>`n`</strong><strong> from A to C</strong>

   The largest disc makes its single move onto the empty destination.

3. <strong>`TOH(n-1, B, A, C)`</strong>

   Bring the `n-1` discs from B onto C, using A as the spare.

`moves(n) = 2 · moves(n−1) + 1 = 2^n − 1 (3 discs → 7, 10 discs → 1023, 64 discs → 1.8 × 10^19)`

```python filename:Python
def toh(n, src, aux, dst):
    if n == 0:
        return 0                              # no discs: no moves
    moves = toh(n - 1, src, dst, aux)         # park n-1 discs on the auxiliary peg
    print(f"Move disc {n} from {src} to {dst}")
    moves += 1 + toh(n - 1, aux, src, dst)    # bring them onto the destination
    return moves

for n in (2, 3):
    print("n =", n)
    print("moves:", toh(n, "A", "B", "C"))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int toh(int n, char src, char aux, char dst) {
    if (n == 0) return 0;                         // no discs: no moves
    int moves = toh(n - 1, src, dst, aux);        // park n-1 discs on the auxiliary peg
    cout << "Move disc " << n << " from " << src << " to " << dst << "\n";
    moves += 1 + toh(n - 1, aux, src, dst);       // bring them onto the destination
    return moves;
}

int main() {
    for (int n : {2, 3}) {
        cout << "n = " << n << "\n";
        int moves = toh(n, 'A', 'B', 'C');      // run first: the moves print inside
        cout << "moves: " << moves << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int toh(int n, char src, char aux, char dst) {
        if (n == 0) return 0;                     // no discs: no moves
        int moves = toh(n - 1, src, dst, aux);    // park n-1 discs on the auxiliary peg
        System.out.println("Move disc " + n + " from " + src + " to " + dst);
        moves += 1 + toh(n - 1, aux, src, dst);   // bring them onto the destination
        return moves;
    }

    public static void main(String[] args) {
        for (int n : new int[]{2, 3}) {
            System.out.println("n = " + n);
            System.out.println("moves: " + toh(n, 'A', 'B', 'C'));
        }
    }
}
```

```javascript filename:JavaScript
function toh(n, src, aux, dst) {
    if (n === 0) return 0;                        // no discs: no moves
    let moves = toh(n - 1, src, dst, aux);        // park n-1 discs on the auxiliary peg
    console.log(`Move disc ${n} from ${src} to ${dst}`);
    moves += 1 + toh(n - 1, aux, src, dst);       // bring them onto the destination
    return moves;
}

for (const n of [2, 3]) {
    console.log("n =", n);
    console.log("moves:", toh(n, "A", "B", "C"));
}
```

```text filename:Output
n = 2
Move disc 1 from A to B
Move disc 2 from A to C
Move disc 1 from B to C
moves: 3
n = 3
Move disc 1 from A to C
Move disc 2 from A to B
Move disc 1 from C to B
Move disc 3 from A to C
Move disc 1 from B to A
Move disc 2 from B to C
Move disc 1 from A to C
moves: 7
```

Time O(2^n) moves · Space O(n) recursion depth

> [!WARNING] Pitfall
>
> The classic slip is the <strong>peg order</strong> in the two recursive calls. With the signature `TOH(n, source, auxiliary, destination)` the first call is `TOH(n-1, A, C, B)` (destination becomes the spare) and the second is `TOH(n-1, B, A, C)` (source becomes the spare). Using `n == 1` as the base case also works; `n == 0` avoids a special-cased print.

# Josephus problem (elimination game)

> [!TIP] Example
>
> <strong>Input:</strong> `n = 7, k = 3`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `n = 8, k = 2`<br><strong>Output:</strong> `0`

`n` people stand in a circle numbered `0 … n-1`. Starting at `0`, every <strong>kth</strong> person is eliminated and the count restarts from the next person. Which position survives?

> [!NOTE] Idea
>
> After the first elimination (`k-1` is removed), the circle has `n-1` people and the count restarts at position `k`. If we <strong>renumber</strong> so that position `k` becomes `0`, the remaining game is exactly `josephus(n-1, k)`. Its survivor `j` in the renumbered circle sits at `(j + k) % n` in the original one — hence `jos(n, k) = (jos(n-1, k) + k) % n`, with `jos(1, k) = 0`.

```text filename:Unwinding%20the%20recursion%20from%20the%20base%20case%20up
jos(1,3) = 0
jos(2,3) = (0 + 3) % 2 = 1
jos(3,3) = (1 + 3) % 3 = 1
jos(4,3) = (1 + 3) % 4 = 0
jos(5,3) = (0 + 3) % 5 = 3
jos(6,3) = (3 + 3) % 6 = 0
jos(7,3) = (0 + 3) % 7 = 3     ← survivor for n = 7, k = 3
```

```python filename:Python
def josephus(n, k):
    if n == 1:
        return 0                          # one person left: position 0 survives
    return (josephus(n - 1, k) + k) % n   # shift the smaller game's answer back by k

for n, k in ((7, 3), (8, 2), (5, 2)):
    print(f"n={n} k={k} ->", josephus(n, k))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int josephus(int n, int k) {
    if (n == 1) return 0;                     // one person left: position 0 survives
    return (josephus(n - 1, k) + k) % n;      // shift the smaller game's answer back by k
}

int main() {
    int tests[3][2] = {{7, 3}, {8, 2}, {5, 2}};
    for (auto& t : tests)
        cout << "n=" << t[0] << " k=" << t[1] << " -> " << josephus(t[0], t[1]) << "\n";
}
```

```java filename:Java
public class Main {
    static int josephus(int n, int k) {
        if (n == 1) return 0;                 // one person left: position 0 survives
        return (josephus(n - 1, k) + k) % n;  // shift the smaller game's answer back by k
    }

    public static void main(String[] args) {
        int[][] tests = {{7, 3}, {8, 2}, {5, 2}};
        for (int[] t : tests)
            System.out.println("n=" + t[0] + " k=" + t[1] + " -> " + josephus(t[0], t[1]));
    }
}
```

```javascript filename:JavaScript
function josephus(n, k) {
    if (n === 1) return 0;                    // one person left: position 0 survives
    return (josephus(n - 1, k) + k) % n;      // shift the smaller game's answer back by k
}

for (const [n, k] of [[7, 3], [8, 2], [5, 2]])
    console.log(`n=${n} k=${k} ->`, josephus(n, k));
```

```text filename:Output
n=7 k=3 -> 3
n=8 k=2 -> 0
n=5 k=2 -> 2
```

Time O(n) · Space O(n) recursion depth — or O(1) with a loop

To <strong>see</strong> the eliminations, simulate the circle with a list: the next victim is `(idx + k - 1) % size` and the count resumes at that index.

```python filename:Python
def simulate(n, k):
    people = list(range(n))
    idx = 0
    while len(people) > 1:
        idx = (idx + k - 1) % len(people)     # count k people from idx, wrapping around
        removed = people.pop(idx)             # the next person now sits at idx
        print("remove", removed, "-> left:", " ".join(map(str, people)))
    print("survivor:", people[0])

simulate(7, 3)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

void simulate(int n, int k) {
    vector<int> people;
    for (int i = 0; i < n; i++) people.push_back(i);
    int idx = 0;
    while (people.size() > 1) {
        int size = people.size();
        idx = (idx + k - 1) % size;               // count k people from idx, wrapping around
        int removed = people[idx];
        people.erase(people.begin() + idx);       // the next person now sits at idx
        cout << "remove " << removed << " -> left:";
        for (int x : people) cout << " " << x;
        cout << "\n";
    }
    cout << "survivor: " << people[0] << "\n";
}

int main() { simulate(7, 3); }
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void simulate(int n, int k) {
        List<Integer> people = new ArrayList<>();
        for (int i = 0; i < n; i++) people.add(i);
        int idx = 0;
        while (people.size() > 1) {
            idx = (idx + k - 1) % people.size();  // count k people from idx, wrapping around
            int removed = people.remove(idx);     // the next person now sits at idx
            StringBuilder sb = new StringBuilder();
            for (int x : people) sb.append(' ').append(x);
            System.out.println("remove " + removed + " -> left:" + sb);
        }
        System.out.println("survivor: " + people.get(0));
    }

    public static void main(String[] args) { simulate(7, 3); }
}
```

```javascript filename:JavaScript
function simulate(n, k) {
    const people = Array.from({ length: n }, (_, i) => i);
    let idx = 0;
    while (people.length > 1) {
        idx = (idx + k - 1) % people.length;      // count k people from idx, wrapping around
        const [removed] = people.splice(idx, 1);  // the next person now sits at idx
        console.log("remove", removed, "-> left:", people.join(" "));
    }
    console.log("survivor:", people[0]);
}

simulate(7, 3);
```

```text filename:Output
remove 2 -> left: 0 1 3 4 5 6
remove 5 -> left: 0 1 3 4 6
remove 1 -> left: 0 3 4 6
remove 6 -> left: 0 3 4
remove 4 -> left: 0 3
remove 0 -> left: 3
survivor: 3
```

Time O(n²) with list deletion, O(n · k) with a linked circle · Space O(n)

> [!WARNING] Pitfall
>
> Mixing up <strong>0-based and 1-based</strong> numbering. The formula above returns a 0-based position; if the people are numbered `1 … n` the survivor is `jos(n, k) + 1` (for `n = 7, k = 3` that is `4`). Also `people.remove(idx)` in Java must receive an `int`, not an `Integer` — `remove(Integer)` removes by <em>value</em>.

# Subset sum (count the subsets)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 5, 2, 3, 6], sum = 8`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [10, 20, 15], sum = 0`<br><strong>Output:</strong> `1`

Count the subsets of `arr` whose elements add up to `sum`. For `{10, 5, 2, 3, 6}` and `8` there are two: `{5, 3}` and `{2, 6}`. For `sum = 0` the empty subset always counts, so the answer is at least `1`.

> [!NOTE] Idea
>
> Look at the <strong>last</strong> element `arr[n-1]`. Either it is left out — count the subsets of the first `n-1` elements that reach `sum` — or it is taken — count those that reach `sum - arr[n-1]`. Add the two. With no elements left (`n == 0`) there is exactly one subset, the empty one, and it works only if the remaining `sum` is `0`.

```text filename:Each%20leaf%20with%20sum%200%20is%20one%20valid%20subset
count(n=3, sum=3)   arr = {1, 2, 3}
├── exclude 3 → count(2, 3)
│   ├── exclude 2 → count(1, 3) → count(0,3)=0, count(0,2)=0          ⇒ 0
│   └── include 2 → count(1, 1) → count(0,1)=0, count(0,0)=1  {1,2}  ⇒ 1
└── include 3 → count(2, 0)
    ├── exclude 2 → count(1, 0) → count(0,0)=1  {3}, count(0,-1)=0   ⇒ 1
    └── include 2 → count(1,-2) → 0                                   ⇒ 0
                                                               total = 2
```

```python filename:Python
def count_subsets(arr, n, target):
    if n == 0:
        return 1 if target == 0 else 0            # empty subset: valid only if nothing is left to reach
    return (count_subsets(arr, n - 1, target)                 # exclude arr[n-1]
            + count_subsets(arr, n - 1, target - arr[n - 1]))  # include arr[n-1]

for arr, target in (([10, 5, 2, 3, 6], 8), ([10, 20, 15], 0), ([1, 2, 3], 3)):
    print(" ".join(map(str, arr)), "| sum", target, "->", count_subsets(arr, len(arr), target))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int countSubsets(const vector<int>& arr, int n, int target) {
    if (n == 0) return target == 0 ? 1 : 0;       // empty subset: valid only if nothing is left to reach
    return countSubsets(arr, n - 1, target)                   // exclude arr[n-1]
         + countSubsets(arr, n - 1, target - arr[n - 1]);     // include arr[n-1]
}

int main() {
    vector<pair<vector<int>, int>> tests = {{{10, 5, 2, 3, 6}, 8}, {{10, 20, 15}, 0}, {{1, 2, 3}, 3}};
    for (auto& [arr, target] : tests) {
        for (int x : arr) cout << x << " ";
        cout << "| sum " << target << " -> " << countSubsets(arr, arr.size(), target) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int countSubsets(int[] arr, int n, int target) {
        if (n == 0) return target == 0 ? 1 : 0;   // empty subset: valid only if nothing is left to reach
        return countSubsets(arr, n - 1, target)               // exclude arr[n-1]
             + countSubsets(arr, n - 1, target - arr[n - 1]); // include arr[n-1]
    }

    public static void main(String[] args) {
        int[][] arrays = {{10, 5, 2, 3, 6}, {10, 20, 15}, {1, 2, 3}};
        int[] targets = {8, 0, 3};
        for (int t = 0; t < arrays.length; t++) {
            StringBuilder sb = new StringBuilder();
            for (int x : arrays[t]) sb.append(x).append(' ');
            System.out.println(sb + "| sum " + targets[t] + " -> "
                               + countSubsets(arrays[t], arrays[t].length, targets[t]));
        }
    }
}
```

```javascript filename:JavaScript
function countSubsets(arr, n, target) {
    if (n === 0) return target === 0 ? 1 : 0;     // empty subset: valid only if nothing is left to reach
    return countSubsets(arr, n - 1, target)                   // exclude arr[n-1]
         + countSubsets(arr, n - 1, target - arr[n - 1]);     // include arr[n-1]
}

for (const [arr, target] of [[[10, 5, 2, 3, 6], 8], [[10, 20, 15], 0], [[1, 2, 3], 3]])
    console.log(arr.join(" "), "| sum", target, "->", countSubsets(arr, arr.length, target));
```

```text filename:Output
10 5 2 3 6 | sum 8 -> 2
10 20 15 | sum 0 -> 1
1 2 3 | sum 3 -> 2
```

Time O(2^n) · Space O(n) recursion depth

> [!NOTE] Key point
>
> Pruning `target < 0` (return `0` early) is safe only when all elements are non-negative. The same recurrence, memoised on `(n, target)`, is the `O(n · sum)` subset-sum DP; replacing `+` with `or` answers the <em>decision</em> version (does any subset reach the sum?).

# Print all permutations of a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "AB"`<br><strong>Output:</strong> `AB BA`<br><strong>Input:</strong> `s = "ABC"`<br><strong>Output:</strong> `ABC ACB BAC BCA CBA CAB`

Print every arrangement of the characters of `s` — there are `n!` of them for `n` distinct characters.

> [!NOTE] Idea
>
> Fix position `i` by trying <strong>every</strong> character from `i` to the end in that slot (swap it in), recursively permute the rest `i+1 … n-1`, then <strong>swap it back</strong> so the next candidate starts from the original arrangement. The swap-back is what makes this <em>backtracking</em>: the shared array is restored after every choice.

```text filename:n%20choices%20at%20level%200%2C%20n%E2%88%921%20at%20level%201%2C%20%E2%80%A6%20%E2%86%92%20n!%20leaves.%20Note%20the%20order%20is%20not%20alphabetical
permute(ABC, i=0)
├── swap(0,0) → A|BC  permute(i=1)
│                ├── swap(1,1) → AB|C → ABC ✔
│                └── swap(1,2) → AC|B → ACB ✔   (swap back → ABC)
├── swap(0,1) → B|AC  permute(i=1)
│                ├── BAC ✔
│                └── BCA ✔                       (swap back → ABC)
└── swap(0,2) → C|BA  permute(i=1)
                 ├── CBA ✔
                 └── CAB ✔                       (swap back → ABC)
```

```python filename:Python
def permute(chars, i, out):
    n = len(chars)
    if i == n - 1:
        out.append("".join(chars))            # every position fixed: one permutation
        return
    for j in range(i, n):
        chars[i], chars[j] = chars[j], chars[i]   # choose chars[j] for position i
        permute(chars, i + 1, out)
        chars[i], chars[j] = chars[j], chars[i]   # backtrack: undo the swap

for s in ("AB", "ABC"):
    out = []
    permute(list(s), 0, out)
    print(s, "->", " ".join(out))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
#include <utility>
using namespace std;

void permute(string& s, int i, vector<string>& out) {
    int n = s.size();
    if (i == n - 1) {
        out.push_back(s);                     // every position fixed: one permutation
        return;
    }
    for (int j = i; j < n; j++) {
        swap(s[i], s[j]);                     // choose s[j] for position i
        permute(s, i + 1, out);
        swap(s[i], s[j]);                     // backtrack: undo the swap
    }
}

int main() {
    for (string s : {"AB", "ABC"}) {
        vector<string> out;
        string work = s;
        permute(work, 0, out);
        cout << s << " ->";
        for (const string& p : out) cout << " " << p;
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void permute(char[] s, int i, List<String> out) {
        int n = s.length;
        if (i == n - 1) {
            out.add(new String(s));           // every position fixed: one permutation
            return;
        }
        for (int j = i; j < n; j++) {
            char t = s[i]; s[i] = s[j]; s[j] = t;   // choose s[j] for position i
            permute(s, i + 1, out);
            t = s[i]; s[i] = s[j]; s[j] = t;        // backtrack: undo the swap
        }
    }

    public static void main(String[] args) {
        for (String s : new String[]{"AB", "ABC"}) {
            List<String> out = new ArrayList<>();
            permute(s.toCharArray(), 0, out);
            System.out.println(s + " -> " + String.join(" ", out));
        }
    }
}
```

```javascript filename:JavaScript
function permute(chars, i, out) {
    const n = chars.length;
    if (i === n - 1) {
        out.push(chars.join(""));             // every position fixed: one permutation
        return;
    }
    for (let j = i; j < n; j++) {
        [chars[i], chars[j]] = [chars[j], chars[i]];   // choose chars[j] for position i
        permute(chars, i + 1, out);
        [chars[i], chars[j]] = [chars[j], chars[i]];   // backtrack: undo the swap
    }
}

for (const s of ["AB", "ABC"]) {
    const out = [];
    permute([...s], 0, out);
    console.log(s, "->", out.join(" "));
}
```

```text filename:Output
AB -> AB BA
ABC -> ABC ACB BAC BCA CBA CAB
```

Time O(n! · n) · Space O(n) recursion depth, swapping in place

> [!WARNING] Pitfall
>
> Forgetting the <strong>second swap</strong> corrupts the array for the next `j` and produces duplicates and missing permutations. The in-place swap uses no extra array, but the auxiliary space is still `O(n)` because of the recursion depth — not `O(1)`. With repeated characters (`"AAB"`) this prints duplicates; skip a `j` whose character was already tried at this position, or use a frequency map.

# Recursion trees at a glance

The cost of a recursive solution is read off its tree: <strong>time</strong> is roughly the number of nodes (branching factor to the power of the depth), <strong>auxiliary space</strong> is the height. Overlapping subproblems (the same node appearing many times) are the signal to memoise.

| Problem | Branching | Depth | Time | Aux space | Overlap? |
| --- | --- | --- | --- | --- | --- |
| Rope cutting | 3 | `n / min(a,b,c)` | `O(3^n)` | `O(n)` | yes → DP `O(n)` |
| Subsets of a string | 2 | `n` | `O(2^n · n)` | `O(n)` | no — every leaf is a distinct answer |
| Tower of Hanoi | 2 | `n` | `O(2^n)` | `O(n)` | no — every move is output |
| Josephus | 1 | `n` | `O(n)` | `O(n)` (loop: `O(1)`) | — |
| Subset sum count | 2 | `n` | `O(2^n)` | `O(n)` | yes → DP `O(n · sum)` |
| Permutations | `n, n-1, …, 1` | `n` | `O(n! · n)` | `O(n)` | no — every leaf is a distinct answer |

> [!WARNING] Depth limits
>
> Each language limits recursion depth: Python stops at about <strong>1000</strong> frames (`sys.setrecursionlimit` raises it, but the C stack still overflows around tens of thousands), Java and C++ overflow their thread stack at roughly `10^4`–`10^5` frames depending on frame size, Node around `10^4`. A linear recursion over `n = 10^5` elements must be rewritten as a loop or use an explicit stack.

# Interview Q&amp;A

```question
What are the two things every recursive function needs?

---

A <strong>base case</strong> that returns without recursing, and a <strong>recursive case</strong> whose argument is strictly closer to the base case. Missing or unreachable base cases give infinite recursion; a recursive case that does not shrink the input (e.g. `f(n)` calling `f(n)`) does the same.
```

```question
What is tail recursion, and does it help?

---

A call is tail-recursive when the recursive call is the very last action, with nothing left to do after it returns — `jos` above is <em>not</em>, because it still adds `k` and takes `% n` after the call returns. C++ compilers optimise tail calls at `-O2`; Python and Java never do, JavaScript engines in practice do not either. So in those languages tail recursion is a style, not a space saving — convert to a loop when depth matters.
```

```question
Why is Tower of Hanoi O(2^n) and not O(n)? There is only one print per call.

---

Because there are `2^n − 1` calls that print: `moves(n) = 2·moves(n−1) + 1`. The recursion tree is a full binary tree of height `n`, and every node does `O(1)` work, so the total is the number of nodes. A single `print` per call does not mean a linear number of calls.
```

```question
How do you turn an exponential recursion into a fast one?

---

Check whether the same subproblem appears many times in the tree (rope cutting: `maxPieces(2)` is recomputed; subset sum: `(n, target)` repeats). If so, store each result the first time it is computed — <strong>memoisation</strong> (top-down DP) — or fill a table from the base cases up (bottom-up DP). If every leaf is a distinct required answer (subsets, permutations, Hanoi) the output itself is exponential and no algorithm can be faster.
```

```question
Recursion vs iteration — when to pick which?

---

Recursion wins when the problem is naturally a tree of choices (subsets, permutations, Hanoi, tree traversals): the call stack keeps the partial state for you and the code mirrors the definition. Iteration wins for linear problems (sum, factorial, Josephus) where recursion only adds `O(n)` stack and the risk of overflow. Any recursion can be made iterative with an explicit stack; it is just more code.
```

```question
What does the Josephus formula (jos(n-1, k) + k) % n actually mean?

---

After the first kill the circle is one person smaller and the count restarts at position `k` (0-based). Renumber that person as `0` and the rest is a smaller instance of the game. Its survivor `j` corresponds to `j + k` in the original numbering — the `% n` wraps around the circle. Unwinding from `jos(1) = 0` gives the answer in `O(n)` with no simulation.
```
