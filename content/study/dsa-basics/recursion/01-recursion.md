---
id: f0f1e2f2-284e-73ee-9e0b-da9b80417c16
key: topic:dsa-basics/recursion
subject: dsa-basics
topic: recursion
title: Recursion
slug: recursion
order: 1
---

Recursion is a function solving a problem by calling <strong>itself</strong> on a smaller version of the same problem. It is the natural shape of divide and conquer, tree and graph traversal, backtracking and dynamic programming — and the source of the classic bugs: a missing base case and a blown call stack.

> [!INFO]
>
> <strong>Recursion</strong> — a technique where a function calls itself, directly or indirectly, until it reaches a <strong>base case</strong> that can be answered without a further call. Each call works on a strictly smaller input so that the chain of calls is guaranteed to end.

| Kind | Shape | Example |
| --- | --- | --- |
| <strong>Direct</strong> recursion | `f` calls `f` | `fact(n)` calls `fact(n − 1)` |
| <strong>Indirect</strong> (mutual) recursion | `f` calls `g`, `g` calls `f` | `is_even(n)` calls `is_odd(n − 1)`, which calls `is_even(n − 2)` |
| Not recursion | a loop repeats a block without a new call | `for i in range(n): print("GFG")` — the original notes' first example is this, a plain loop |

# Recursion background: how calls nest

A function call does not finish until the function it called has returned. The program below shows the order in which lines run when `fun2` calls `fun1`: the <em>before</em> lines go in, the <em>after</em> lines come out in reverse. Recursion is exactly this picture with the same function on every level.

```python filename:Python
def fun1():
    print("Function 1 is called")

def fun2():
    print("Before Function 1")
    fun1()                       # fun2 pauses here until fun1 returns
    print("After Function 1")

print("Before Function 2")
fun2()
print("After Function 2")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void fun1() {
    cout << "Function 1 is called\n";
}

void fun2() {
    cout << "Before Function 1\n";
    fun1();                      // fun2 pauses here until fun1 returns
    cout << "After Function 1\n";
}

int main() {
    cout << "Before Function 2\n";
    fun2();
    cout << "After Function 2\n";
}
```

```java filename:Java
public class Main {
    static void fun1() {
        System.out.println("Function 1 is called");
    }

    static void fun2() {
        System.out.println("Before Function 1");
        fun1();                  // fun2 pauses here until fun1 returns
        System.out.println("After Function 1");
    }

    public static void main(String[] args) {
        System.out.println("Before Function 2");
        fun2();
        System.out.println("After Function 2");
    }
}
```

```javascript filename:JavaScript
function fun1() {
    console.log("Function 1 is called");
}

function fun2() {
    console.log("Before Function 1");
    fun1();                      // fun2 pauses here until fun1 returns
    console.log("After Function 1");
}

console.log("Before Function 2");
fun2();
console.log("After Function 2");
```

```text filename:Output
Before Function 2
Before Function 1
Function 1 is called
After Function 1
After Function 2
```

Every active call lives in a <strong>frame</strong> on the call stack holding its parameters, local variables and the point to return to. A recursive function has one frame per pending call, so `fact(3)` builds three frames before the first multiplication happens:

```text filename:The%20call%20stack%20while%20computing%20fact(3)
fact(3)                      call stack (top = running)        returns
  └─ 3 * fact(2)             ┌──────────┐
       └─ 2 * fact(1)        │ fact(0)  │  → 1                 1
            └─ 1 * fact(0)   │ fact(1)  │  → 1 * 1             1
                 └─ 1        │ fact(2)  │  → 2 * 1             2
                             │ fact(3)  │  → 3 * 2             6
                             └──────────┘
frames are pushed going down (3, 2, 1, 0) and popped coming back up (0, 1, 2, 3)
```

# Typical structure of a recursive function

Every correct recursive function has the same two parts. Get either one wrong and the function never terminates — that is a <strong>stack overflow</strong>, not an infinite loop, because each call allocates a frame until memory runs out.

1. <strong>Base case(s) first</strong>

   The smallest input, answered directly: `if n == 0: return 1`. There can be several (`n == 0 or n == 1` for Fibonacci).

2. <strong>Recursive case</strong>

   Call the function on a <strong>strictly smaller</strong> input (`n − 1`, `n // 2`, a shorter string, a subtree) and combine the result with the current level's work.

3. <strong>Convince yourself it ends</strong>

   Each call must move towards a base case: `n − 1` reaches `0`; `n // 2` reaches `0`; `start + 1` reaches `end`. A call with the <em>same</em> parameters is an infinite recursion.

```text filename:Template%20of%20a%20recursive%20function
def fun(parameters):
    if base case:                 # answer directly, no call
        return simple answer
    # at least one parameter changes so the call moves towards the base case
    return combine(current work, fun(smaller parameters))
```

> [!WARNING] Pitfall
>
> `fact(n)` with the base case `n == 1` instead of `n == 0` is the original notes' own warning: `fact(0)` never hits the base case and recurses to `−1, −2, …` for ever. Pick the base case that every valid input can actually reach.

# Where recursion is used

> [!NOTE] Divide and conquer
>
> Binary search, merge sort, quick sort: split the input, solve the parts recursively, combine. The recurrence `T(n) = 2T(n/2) + n` of merge sort comes straight from the code.

> [!NOTE] Dynamic programming
>
> A recursive definition of the answer (`fib(n) = fib(n−1) + fib(n−2)`) plus memoisation of repeated sub-problems — recursion with a cache.

> [!NOTE] Backtracking
>
> Permutations, N-Queens, sudoku: choose, recurse, un-choose. The call stack <em>is</em> the path of choices made so far.

> [!NOTE] Inherently recursive structures
>
> Trees and graphs: pre-order, in-order, post-order traversal and DFS are each a few lines recursively and clumsy without a stack.

> [!NOTE] Tower of Hanoi
>
> Move `n − 1` discs aside, move the big one, move the `n − 1` back: `T(n) = 2T(n−1) + 1 = 2ⁿ − 1` moves — the textbook example of exponential recursion.

> [!NOTE] Parsers and evaluators
>
> Expressions contain sub-expressions; JSON contains JSON. Recursive-descent parsing mirrors the grammar.

# Factorial and Fibonacci: two shapes of recursion

> [!TIP] Example
>
> <strong>Input:</strong> `fact(5)`<br><strong>Output:</strong> `120`<br><strong>Input:</strong> `fib(10)`<br><strong>Output:</strong> `55 (0 1 1 2 3 5 8 13 21 34 55)`

Factorial makes <strong>one</strong> recursive call per level: `n` calls in total, `O(n)` time. Fibonacci as written in the definition makes <strong>two</strong>: `fib(n−1)` and `fib(n−2)` each recompute the same values again and again, so the number of calls grows like `2 · fib(n+1) − 1` — exponential. The program counts the calls to make this visible.

```text filename:The%20call%20tree%20of%20naive%20fib(5)%3A%2015%20calls%20for%20an%20answer%20of%205
                        fib(5)
                   /             \
              fib(4)              fib(3)
             /      \            /      \
         fib(3)    fib(2)    fib(2)    fib(1)
        /     \    /    \    /    \
    fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
    /    \
fib(1) fib(0)                 fib(3) is computed twice, fib(2) three times
```

```python filename:Python
calls = 0

def fact(n):                  # one call per level: O(n)
    global calls
    calls += 1
    if n == 0:                # base case: 0! = 1
        return 1
    return n * fact(n - 1)

def fib(n):                   # two calls per level: O(2^n) — the same values recomputed
    global calls
    calls += 1
    if n == 0 or n == 1:      # two base cases: fib(0) = 0, fib(1) = 1
        return n
    return fib(n - 1) + fib(n - 2)

for n in (5, 10):
    calls = 0
    print(f"fact({n}) = {fact(n)} in {calls} calls")
for n in (5, 10, 20):
    calls = 0
    print(f"fib({n}) = {fib(n)} in {calls} calls")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long calls = 0;

long long fact(int n) {           // one call per level: O(n)
    calls++;
    if (n == 0) return 1;         // base case: 0! = 1
    return n * fact(n - 1);
}

long long fib(int n) {            // two calls per level: O(2^n) — the same values recomputed
    calls++;
    if (n == 0 || n == 1) return n;   // two base cases
    return fib(n - 1) + fib(n - 2);
}

int main() {
    for (int n : {5, 10}) {
        calls = 0;
        long long r = fact(n);
        cout << "fact(" << n << ") = " << r << " in " << calls << " calls\n";
    }
    for (int n : {5, 10, 20}) {
        calls = 0;
        long long r = fib(n);
        cout << "fib(" << n << ") = " << r << " in " << calls << " calls\n";
    }
}
```

```java filename:Java
public class Main {
    static long calls = 0;

    static long fact(int n) {             // one call per level: O(n)
        calls++;
        if (n == 0) return 1;             // base case: 0! = 1
        return n * fact(n - 1);
    }

    static long fib(int n) {              // two calls per level: O(2^n) — the same values recomputed
        calls++;
        if (n == 0 || n == 1) return n;   // two base cases
        return fib(n - 1) + fib(n - 2);
    }

    public static void main(String[] args) {
        for (int n : new int[]{5, 10}) {
            calls = 0;
            long r = fact(n);
            System.out.println("fact(" + n + ") = " + r + " in " + calls + " calls");
        }
        for (int n : new int[]{5, 10, 20}) {
            calls = 0;
            long r = fib(n);
            System.out.println("fib(" + n + ") = " + r + " in " + calls + " calls");
        }
    }
}
```

```javascript filename:JavaScript
let calls = 0;

function fact(n) {                // one call per level: O(n)
    calls++;
    if (n === 0) return 1;        // base case: 0! = 1
    return n * fact(n - 1);
}

function fib(n) {                 // two calls per level: O(2^n) — the same values recomputed
    calls++;
    if (n === 0 || n === 1) return n;   // two base cases
    return fib(n - 1) + fib(n - 2);
}

for (const n of [5, 10]) {
    calls = 0;
    const r = fact(n);
    console.log(`fact(${n}) = ${r} in ${calls} calls`);
}
for (const n of [5, 10, 20]) {
    calls = 0;
    const r = fib(n);
    console.log(`fib(${n}) = ${r} in ${calls} calls`);
}
```

```text filename:Output
fact(5) = 120 in 6 calls
fact(10) = 3628800 in 11 calls
fib(5) = 5 in 15 calls
fib(10) = 55 in 177 calls
fib(20) = 6765 in 21891 calls
```

Time fact: O(n); naive fib: O(φⁿ) ≈ O(1.618ⁿ) · Space O(n) call stack for both

> [!NOTE] Key point
>
> `fib(20)` already needs 21 891 calls; `fib(50)` would need about 4·10¹⁰. The fix is <strong>memoisation</strong> — store each `fib(k)` the first time it is computed — which turns the tree into a line of `n` calls (`O(n)`). That is the entry point to dynamic programming. The original notes' series `0 1 1 2 3 5 8 12 20` had typos: it continues `13 21`.

# Tail recursion

> [!INFO]
>
> <strong>Tail-recursive function</strong> — a recursive function whose recursive call is the <strong>last thing it does</strong> — nothing happens after the call returns. Because the frame has no more work, a compiler can reuse it for the next call (tail-call optimisation), making the recursion as cheap as a loop.

Compare the two print functions from the notes. In the first the call is in tail position; in the second the `print` runs <em>after</em> the call returns, so the frame must be kept alive — it is <strong>not</strong> tail recursive even though the code looks almost identical.

```python filename:Python
def fun_tail(n):
    if n == 0:
        return
    print(n, end=" ")
    fun_tail(n - 1)          # last action: tail recursive

def fun_not_tail(n):
    if n == 0:
        return
    fun_not_tail(n - 1)
    print(n, end=" ")        # work after the call: NOT tail recursive

print("tail recursive (print, then recurse):", end=" ")
fun_tail(5)
print()
print("not tail recursive (recurse, then print):", end=" ")
fun_not_tail(5)
print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void funTail(int n) {
    if (n == 0) return;
    cout << n << " ";
    funTail(n - 1);            // last action: tail recursive
}

void funNotTail(int n) {
    if (n == 0) return;
    funNotTail(n - 1);
    cout << n << " ";          // work after the call: NOT tail recursive
}

int main() {
    cout << "tail recursive (print, then recurse): ";
    funTail(5);
    cout << "\n";
    cout << "not tail recursive (recurse, then print): ";
    funNotTail(5);
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static void funTail(int n) {
        if (n == 0) return;
        System.out.print(n + " ");
        funTail(n - 1);            // last action: tail recursive
    }

    static void funNotTail(int n) {
        if (n == 0) return;
        funNotTail(n - 1);
        System.out.print(n + " ");  // work after the call: NOT tail recursive
    }

    public static void main(String[] args) {
        System.out.print("tail recursive (print, then recurse): ");
        funTail(5);
        System.out.println();
        System.out.print("not tail recursive (recurse, then print): ");
        funNotTail(5);
        System.out.println();
    }
}
```

```javascript filename:JavaScript
let line = "";

function funTail(n) {
    if (n === 0) return;
    line += n + " ";
    funTail(n - 1);            // last action: tail recursive
}

function funNotTail(n) {
    if (n === 0) return;
    funNotTail(n - 1);
    line += n + " ";           // work after the call: NOT tail recursive
}

line = "tail recursive (print, then recurse): ";
funTail(5);
console.log(line.trim());
line = "not tail recursive (recurse, then print): ";
funNotTail(5);
console.log(line.trim());
```

```text filename:Output
tail recursive (print, then recurse): 5 4 3 2 1
not tail recursive (recurse, then print): 1 2 3 4 5
```

Time O(n) both · Space O(n) stack — O(1) for the tail version only if the compiler optimises tail calls

| Function | Tail recursive? | Why |
| --- | --- | --- |
| print `N..1` (print, then call) | yes | the call is the last statement |
| print `1..N` (call, then print) | no | prints after the call returns |
| `fact(n) = n * fact(n − 1)` | no | the multiplication happens after the call |
| `fact(n, acc) = fact(n − 1, n * acc)` | yes | the multiplication is done <em>before</em> the call, in the argument |
| Quick sort (second call) | yes | sort the left part, then the last action is sorting the right part |
| Merge sort, post-order traversal | no | work (merge / visit the node) happens after the calls return |
| Binary search (recursive) | yes | returns the result of the single recursive call |

A non-tail function can often be made tail-recursive by carrying the partial result in an <strong>accumulator</strong> parameter — the multiplication moves from <em>after</em> the call to <em>before</em> it:

```python filename:Python
def fact(n):                       # not tail recursive: multiplies after the call returns
    if n == 0:
        return 1
    return n * fact(n - 1)

def fact_tail(n, acc=1):           # tail recursive: the running product travels in acc
    if n == 0:
        return acc
    return fact_tail(n - 1, n * acc)   # nothing left to do after this call

for n in (5, 10):
    print(f"fact({n}) = {fact(n)}")
    print(f"fact_tail({n}, 1) = {fact_tail(n)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long fact(int n) {                    // not tail recursive: multiplies after the call returns
    if (n == 0) return 1;
    return n * fact(n - 1);
}

long long factTail(int n, long long acc) { // tail recursive: the running product travels in acc
    if (n == 0) return acc;
    return factTail(n - 1, n * acc);       // nothing left to do after this call
}

int main() {
    for (int n : {5, 10}) {
        cout << "fact(" << n << ") = " << fact(n) << "\n";
        cout << "fact_tail(" << n << ", 1) = " << factTail(n, 1) << "\n";
    }
}
```

```java filename:Java
public class Main {
    static long fact(int n) {                  // not tail recursive: multiplies after the call returns
        if (n == 0) return 1;
        return n * fact(n - 1);
    }

    static long factTail(int n, long acc) {    // tail recursive: the running product travels in acc
        if (n == 0) return acc;
        return factTail(n - 1, n * acc);       // nothing left to do after this call
    }

    public static void main(String[] args) {
        for (int n : new int[]{5, 10}) {
            System.out.println("fact(" + n + ") = " + fact(n));
            System.out.println("fact_tail(" + n + ", 1) = " + factTail(n, 1));
        }
    }
}
```

```javascript filename:JavaScript
function fact(n) {                     // not tail recursive: multiplies after the call returns
    if (n === 0) return 1;
    return n * fact(n - 1);
}

function factTail(n, acc = 1) {        // tail recursive: the running product travels in acc
    if (n === 0) return acc;
    return factTail(n - 1, n * acc);   // nothing left to do after this call
}

for (const n of [5, 10]) {
    console.log(`fact(${n}) = ${fact(n)}`);
    console.log(`fact_tail(${n}, 1) = ${factTail(n)}`);
}
```

```text filename:Output
fact(5) = 120
fact_tail(5, 1) = 120
fact(10) = 3628800
fact_tail(10, 1) = 3628800
```

Time O(n) · Space O(n) stack; O(1) with tail-call optimisation

> [!WARNING] Do not rely on the optimisation
>
> Tail-call optimisation is <strong>not</strong> guaranteed: C++ compilers do it at `-O2`, Java and Python never do, and JavaScript engines other than Safari dropped it. So in these four languages a tail-recursive function still uses `O(n)` stack — the real benefit is that a tail-recursive function converts to a loop <em>mechanically</em>, which is the next section.

# Removing recursion: converting to a loop

Because a tail call passes nothing back, the recursion can be replaced by a loop in two mechanical edits (the original notes' recipe):

1. <strong>Replace </strong><strong>`if`</strong><strong> with </strong><strong>`while`</strong>

   The base-case test `if n == 0: return` becomes the loop condition `while n != 0:`.

2. <strong>Update the parameters at the end of the loop body</strong>

   The tail call `fun(n − 1)` becomes the assignment `n = n − 1` as the last statement.

```text filename:The%20two%20edits%20that%20turn%20a%20tail%20call%20into%20a%20loop
tail recursive                         loop
─────────────────────────────          ─────────────────────────────
def fun(n):                            def fun(n):
    if n == 0: return                      while n != 0:
    print(n)                                   print(n)
    fun(n - 1)                                 n = n - 1
```

A <strong>non</strong>-tail function cannot be converted this way because the frame must remember what to do after the call. It can still be made iterative with an explicit stack (that is how iterative DFS and in-order traversal work) or, as with factorial, by moving the pending work into an accumulator first.

```python filename:Python
def print_recursive(n):
    if n == 0:
        return
    print(n, end=" ")
    print_recursive(n - 1)

def print_loop(n):                 # if → while, tail call → parameter update
    while n != 0:
        print(n, end=" ")
        n = n - 1

def sum_recursive(n, acc=0):       # tail recursive with an accumulator …
    if n == 0:
        return acc
    return sum_recursive(n - 1, acc + n)

def sum_loop(n):                   # … becomes a loop with the same accumulator
    acc = 0
    while n != 0:
        acc = acc + n
        n = n - 1
    return acc

print("recursive:", end=" "); print_recursive(5); print()
print("loop:", end=" "); print_loop(5); print()
print("sum of 1..100 recursive:", sum_recursive(100))
print("sum of 1..100 loop:", sum_loop(100))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void printRecursive(int n) {
    if (n == 0) return;
    cout << n << " ";
    printRecursive(n - 1);
}

void printLoop(int n) {                  // if → while, tail call → parameter update
    while (n != 0) {
        cout << n << " ";
        n = n - 1;
    }
}

int sumRecursive(int n, int acc) {       // tail recursive with an accumulator …
    if (n == 0) return acc;
    return sumRecursive(n - 1, acc + n);
}

int sumLoop(int n) {                     // … becomes a loop with the same accumulator
    int acc = 0;
    while (n != 0) { acc = acc + n; n = n - 1; }
    return acc;
}

int main() {
    cout << "recursive: "; printRecursive(5); cout << "\n";
    cout << "loop: "; printLoop(5); cout << "\n";
    cout << "sum of 1..100 recursive: " << sumRecursive(100, 0) << "\n";
    cout << "sum of 1..100 loop: " << sumLoop(100) << "\n";
}
```

```java filename:Java
public class Main {
    static void printRecursive(int n) {
        if (n == 0) return;
        System.out.print(n + " ");
        printRecursive(n - 1);
    }

    static void printLoop(int n) {               // if → while, tail call → parameter update
        while (n != 0) {
            System.out.print(n + " ");
            n = n - 1;
        }
    }

    static int sumRecursive(int n, int acc) {    // tail recursive with an accumulator …
        if (n == 0) return acc;
        return sumRecursive(n - 1, acc + n);
    }

    static int sumLoop(int n) {                  // … becomes a loop with the same accumulator
        int acc = 0;
        while (n != 0) { acc = acc + n; n = n - 1; }
        return acc;
    }

    public static void main(String[] args) {
        System.out.print("recursive: "); printRecursive(5); System.out.println();
        System.out.print("loop: "); printLoop(5); System.out.println();
        System.out.println("sum of 1..100 recursive: " + sumRecursive(100, 0));
        System.out.println("sum of 1..100 loop: " + sumLoop(100));
    }
}
```

```javascript filename:JavaScript
function printRecursive(n, parts) {
    if (n === 0) return;
    parts.push(n);
    printRecursive(n - 1, parts);
}

function printLoop(n, parts) {           // if → while, tail call → parameter update
    while (n !== 0) {
        parts.push(n);
        n = n - 1;
    }
}

function sumRecursive(n, acc = 0) {      // tail recursive with an accumulator …
    if (n === 0) return acc;
    return sumRecursive(n - 1, acc + n);
}

function sumLoop(n) {                    // … becomes a loop with the same accumulator
    let acc = 0;
    while (n !== 0) { acc = acc + n; n = n - 1; }
    return acc;
}

let parts = []; printRecursive(5, parts); console.log("recursive:", parts.join(" "));
parts = []; printLoop(5, parts); console.log("loop:", parts.join(" "));
console.log("sum of 1..100 recursive:", sumRecursive(100));
console.log("sum of 1..100 loop:", sumLoop(100));
```

```text filename:Output
recursive: 5 4 3 2 1
loop: 5 4 3 2 1
sum of 1..100 recursive: 5050
sum of 1..100 loop: 5050
```

Time O(n) · Space O(n) recursive, O(1) loop

# Tracing recursive functions

Interviews love “what does this print?”. The method: write the calls as a tree, mark what happens <strong>before</strong> the recursive call (on the way down) and <strong>after</strong> it (on the way up), then read the output in order. Four puzzles from the notes, solved by the program:

| Function | Before the call | After the call | Output for the input | What it computes |
| --- | --- | --- | --- | --- |
| print, call `n − 1`, print | `n` | `n` | `4 3 2 1 1 2 3 4` | the sequence down, then mirrored back up |
| call `n − 1`, print, call `n − 1` | — | `n`, then a second subtree | `1 2 1 3 1 2 1 4 1 2 1 3 1 2 1` | `2ⁿ − 1` numbers — the ruler pattern; `O(2ⁿ)` |
| `1 + fun(n // 2)` until `n ≤ 1` | — | add 1 | `fun(16) = 4`, `fun(13) = 3` | how many times `n` can be halved: `⌊log₂ n⌋` |
| call `n // 2`, print `n % 2` | — | print the bit | `fun(13) = 1101` | binary representation, most significant bit first |

```python filename:Python
def before_after(n):
    if n == 0:
        return
    print(n, end=" ")             # on the way down
    before_after(n - 1)
    print(n, end=" ")             # on the way up

def double(n):
    if n == 0:
        return
    double(n - 1)
    print(n, end=" ")
    double(n - 1)                 # the whole left subtree printed again

def halvings(n):                  # how many times can n be halved? floor(log2 n)
    if n <= 1:
        return 0
    return 1 + halvings(n // 2)

def binary(n):                    # recurse first so the most significant bit prints first
    if n == 0:
        return
    binary(n // 2)
    print(n % 2, end="")

print("before and after, n = 4:", end=" "); before_after(4); print()
print("double recursion, n = 4:", end=" "); double(4); print()
print("halvings of 16:", halvings(16))
print("halvings of 13:", halvings(13))
print("binary of 13:", end=" "); binary(13); print()
print("binary of 32:", end=" "); binary(32); print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void beforeAfter(int n) {
    if (n == 0) return;
    cout << n << " ";             // on the way down
    beforeAfter(n - 1);
    cout << n << " ";             // on the way up
}

void doubleRec(int n) {
    if (n == 0) return;
    doubleRec(n - 1);
    cout << n << " ";
    doubleRec(n - 1);             // the whole left subtree printed again
}

int halvings(int n) {             // how many times can n be halved? floor(log2 n)
    if (n <= 1) return 0;
    return 1 + halvings(n / 2);
}

void binary(int n) {              // recurse first so the most significant bit prints first
    if (n == 0) return;
    binary(n / 2);
    cout << n % 2;
}

int main() {
    cout << "before and after, n = 4: "; beforeAfter(4); cout << "\n";
    cout << "double recursion, n = 4: "; doubleRec(4); cout << "\n";
    cout << "halvings of 16: " << halvings(16) << "\n";
    cout << "halvings of 13: " << halvings(13) << "\n";
    cout << "binary of 13: "; binary(13); cout << "\n";
    cout << "binary of 32: "; binary(32); cout << "\n";
}
```

```java filename:Java
public class Main {
    static void beforeAfter(int n) {
        if (n == 0) return;
        System.out.print(n + " ");    // on the way down
        beforeAfter(n - 1);
        System.out.print(n + " ");    // on the way up
    }

    static void doubleRec(int n) {
        if (n == 0) return;
        doubleRec(n - 1);
        System.out.print(n + " ");
        doubleRec(n - 1);             // the whole left subtree printed again
    }

    static int halvings(int n) {      // how many times can n be halved? floor(log2 n)
        if (n <= 1) return 0;
        return 1 + halvings(n / 2);
    }

    static void binary(int n) {       // recurse first so the most significant bit prints first
        if (n == 0) return;
        binary(n / 2);
        System.out.print(n % 2);
    }

    public static void main(String[] args) {
        System.out.print("before and after, n = 4: "); beforeAfter(4); System.out.println();
        System.out.print("double recursion, n = 4: "); doubleRec(4); System.out.println();
        System.out.println("halvings of 16: " + halvings(16));
        System.out.println("halvings of 13: " + halvings(13));
        System.out.print("binary of 13: "); binary(13); System.out.println();
        System.out.print("binary of 32: "); binary(32); System.out.println();
    }
}
```

```javascript filename:JavaScript
let out = [];

function beforeAfter(n) {
    if (n === 0) return;
    out.push(n);                  // on the way down
    beforeAfter(n - 1);
    out.push(n);                  // on the way up
}

function doubleRec(n) {
    if (n === 0) return;
    doubleRec(n - 1);
    out.push(n);
    doubleRec(n - 1);             // the whole left subtree printed again
}

function halvings(n) {            // how many times can n be halved? floor(log2 n)
    if (n <= 1) return 0;
    return 1 + halvings(Math.floor(n / 2));
}

function binary(n) {              // recurse first so the most significant bit prints first
    if (n === 0) return;
    binary(Math.floor(n / 2));
    out.push(n % 2);
}

out = []; beforeAfter(4); console.log("before and after, n = 4:", out.join(" "));
out = []; doubleRec(4); console.log("double recursion, n = 4:", out.join(" "));
console.log("halvings of 16:", halvings(16));
console.log("halvings of 13:", halvings(13));
out = []; binary(13); console.log("binary of 13:", out.join(""));
out = []; binary(32); console.log("binary of 32:", out.join(""));
```

```text filename:Output
before and after, n = 4: 4 3 2 1 1 2 3 4
double recursion, n = 4: 1 2 1 3 1 2 1 4 1 2 1 3 1 2 1
halvings of 16: 4
halvings of 13: 3
binary of 13: 1101
binary of 32: 100000
```

Time O(n), O(2ⁿ), O(log n), O(log n) respectively · Space O(n) / O(n) / O(log n) / O(log n) stack

> [!NOTE] Key point
>
> `binary(n)` is the general trick for <strong>reversing the order of output</strong>: do the recursive call first and print on the way back up. Printing `n % 2` <em>before</em> the call would give the bits least-significant first (`1011`).

# Problem: print 1 to N and N to 1

> [!TIP] Example
>
> <strong>Input:</strong> `n = 4`<br><strong>Output:</strong> `1 2 3 4 and 4 3 2 1`

> [!NOTE] Idea
>
> With no loop allowed, the only question is <em>where the print goes</em>. Print <strong>after</strong> the recursive call and the numbers come out in increasing order (the deepest call, `1`, prints first); print <strong>before</strong> it and they come out decreasing. Same function, one line moved.

```python filename:Python
def print_1_to_n(n):
    if n == 0:
        return
    print_1_to_n(n - 1)         # first everything below n …
    print(n, end=" ")           # … then n: ascending (not tail recursive)

def print_n_to_1(n):
    if n == 0:
        return
    print(n, end=" ")           # n first …
    print_n_to_1(n - 1)         # … then everything below: descending (tail recursive)

for n in (4, 7):
    print(f"1 to {n}:", end=" "); print_1_to_n(n); print()
    print(f"{n} to 1:", end=" "); print_n_to_1(n); print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

void print1ToN(int n) {
    if (n == 0) return;
    print1ToN(n - 1);           // first everything below n …
    cout << n << " ";           // … then n: ascending (not tail recursive)
}

void printNTo1(int n) {
    if (n == 0) return;
    cout << n << " ";           // n first …
    printNTo1(n - 1);           // … then everything below: descending (tail recursive)
}

int main() {
    for (int n : {4, 7}) {
        cout << "1 to " << n << ": "; print1ToN(n); cout << "\n";
        cout << n << " to 1: "; printNTo1(n); cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static void print1ToN(int n) {
        if (n == 0) return;
        print1ToN(n - 1);               // first everything below n …
        System.out.print(n + " ");      // … then n: ascending (not tail recursive)
    }

    static void printNTo1(int n) {
        if (n == 0) return;
        System.out.print(n + " ");      // n first …
        printNTo1(n - 1);               // … then everything below: descending (tail recursive)
    }

    public static void main(String[] args) {
        for (int n : new int[]{4, 7}) {
            System.out.print("1 to " + n + ": "); print1ToN(n); System.out.println();
            System.out.print(n + " to 1: "); printNTo1(n); System.out.println();
        }
    }
}
```

```javascript filename:JavaScript
function print1ToN(n, parts) {
    if (n === 0) return;
    print1ToN(n - 1, parts);    // first everything below n …
    parts.push(n);              // … then n: ascending (not tail recursive)
}

function printNTo1(n, parts) {
    if (n === 0) return;
    parts.push(n);              // n first …
    printNTo1(n - 1, parts);    // … then everything below: descending (tail recursive)
}

for (const n of [4, 7]) {
    let parts = []; print1ToN(n, parts); console.log(`1 to ${n}: ${parts.join(" ")}`);
    parts = []; printNTo1(n, parts); console.log(`${n} to 1: ${parts.join(" ")}`);
}
```

```text filename:Output
1 to 4: 1 2 3 4
4 to 1: 4 3 2 1
1 to 7: 1 2 3 4 5 6 7
7 to 1: 7 6 5 4 3 2 1
```

Time O(n) · Space O(n) call stack

> [!WARNING] Pitfall
>
> Both functions are `O(n)` deep: `print_1_to_n(100000)` overflows the stack in every one of these languages (Python gives up at \~1000). Recursion is the <em>exercise</em> here; a loop is the production answer.

# Problem: sum of digits

> [!TIP] Example
>
> <strong>Input:</strong> `n = 253`<br><strong>Output:</strong> `10 (2 + 5 + 3)`<br><strong>Input:</strong> `n = 9`<br><strong>Output:</strong> `9`

> [!NOTE] Idea
>
> The last digit is `n % 10` and the rest of the number is `n // 10`. So `sum(n) = sum(n // 10) + n % 10`, with the base case that a single digit (`n < 10`) is its own sum. One call per digit.

```python filename:Python
def sum_of_digits(n):
    if n < 10:                            # base case: a single digit
        return n
    return sum_of_digits(n // 10) + n % 10   # digits of the rest + the last digit

for n in (253, 9, 99999, 1000):
    print(n, "→", sum_of_digits(n))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int sumOfDigits(int n) {
    if (n < 10) return n;                 // base case: a single digit
    return sumOfDigits(n / 10) + n % 10;  // digits of the rest + the last digit
}

int main() {
    for (int n : {253, 9, 99999, 1000})
        cout << n << " → " << sumOfDigits(n) << "\n";
}
```

```java filename:Java
public class Main {
    static int sumOfDigits(int n) {
        if (n < 10) return n;                 // base case: a single digit
        return sumOfDigits(n / 10) + n % 10;  // digits of the rest + the last digit
    }

    public static void main(String[] args) {
        for (int n : new int[]{253, 9, 99999, 1000})
            System.out.println(n + " → " + sumOfDigits(n));
    }
}
```

```javascript filename:JavaScript
function sumOfDigits(n) {
    if (n < 10) return n;                               // base case: a single digit
    return sumOfDigits(Math.floor(n / 10)) + (n % 10);  // digits of the rest + the last digit
}

for (const n of [253, 9, 99999, 1000])
    console.log(n, "→", sumOfDigits(n));
```

```text filename:Output
253 → 10
9 → 9
99999 → 45
1000 → 1
```

Time O(d) — one call per digit · Space O(d) call stack

# Problem: palindrome check of a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "aabbaa"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s = "abcba"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s = "abca"`<br><strong>Output:</strong> `No`

> [!NOTE] Idea
>
> Compare the outer characters, then ask the same question about the string without them: `palin(s, start, end) = s[start] == s[end] and palin(s, start + 1, end − 1)`. When `start >= end` (zero or one character left) the answer is trivially yes. Two indices avoid copying substrings.

```text filename:palin(%22aabbaa%22%2C%200%2C%205)%20%E2%80%94%20the%20window%20shrinks%20from%20both%20ends
s = a a b b a a       start = 0, end = 5   a == a ✓
      a b b a         start = 1, end = 4   a == a ✓
        b b           start = 2, end = 3   b == b ✓
                      start = 3, end = 2   start >= end → True
```

```python filename:Python
def is_palindrome(s, start, end):
    if start >= end:                       # 0 or 1 characters left
        return True
    return s[start] == s[end] and is_palindrome(s, start + 1, end - 1)

for s in ["aabbaa", "abcba", "abca", "a", ""]:
    print(s, "→", "Yes" if is_palindrome(s, 0, len(s) - 1) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

bool isPalindrome(const string& s, int start, int end) {
    if (start >= end) return true;         // 0 or 1 characters left
    return s[start] == s[end] && isPalindrome(s, start + 1, end - 1);
}

int main() {
    for (string s : {"aabbaa", "abcba", "abca", "a", ""}) {
        int n = s.size();
        cout << s << " → " << (isPalindrome(s, 0, n - 1) ? "Yes" : "No") << "\n";
    }
}
```

```java filename:Java
public class Main {
    static boolean isPalindrome(String s, int start, int end) {
        if (start >= end) return true;     // 0 or 1 characters left
        return s.charAt(start) == s.charAt(end) && isPalindrome(s, start + 1, end - 1);
    }

    public static void main(String[] args) {
        for (String s : new String[]{"aabbaa", "abcba", "abca", "a", ""})
            System.out.println(s + " → " + (isPalindrome(s, 0, s.length() - 1) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPalindrome(s, start, end) {
    if (start >= end) return true;         // 0 or 1 characters left
    return s[start] === s[end] && isPalindrome(s, start + 1, end - 1);
}

for (const s of ["aabbaa", "abcba", "abca", "a", ""])
    console.log(s, "→", isPalindrome(s, 0, s.length - 1) ? "Yes" : "No");
```

```text filename:Output
aabbaa → Yes
abcba → Yes
abca → No
a → Yes
 → Yes
```

Time O(n) · Space O(n) call stack

> [!WARNING] Pitfall
>
> The original notes gave `"aabbaa" → False`; it <strong>is</strong> a palindrome (`a a b | b a a`). Also note the `and` short-circuits: as soon as one pair differs the recursion stops, so a mismatch at the ends costs `O(1)`.

# Recursion vs iteration

|  | Recursion | Iteration |
| --- | --- | --- |
| Code | mirrors the mathematical definition; short for trees, graphs, divide and conquer | explicit state; short for simple counting |
| Memory | `O(depth)` call stack, hidden | `O(1)` or an explicit stack you control |
| Speed | function-call overhead per step | none |
| Risk | stack overflow on deep input; exponential blow-up without memoisation | off-by-one errors, state bugs |
| Convertible? | tail recursion → loop mechanically; other recursion → loop + explicit stack | any loop can be written recursively |

> [!NOTE] Missing or unreachable base case
>
> `fact` with base case `n == 1` loops for ever on `0`. Test the smallest inputs first.

> [!NOTE] Not shrinking the input
>
> A call with the same arguments is infinite recursion: `fun(n)` calling `fun(n)`.

> [!NOTE] Exponential recomputation
>
> Two calls per level that overlap (`fib`) — memoise, or rewrite bottom-up.

> [!NOTE] Deep recursion
>
> Depth `n = 10⁵` overflows the stack. Use a loop, an explicit stack, or raise the limit only when you know the depth.

# Interview Q&amp;A

```question
What is a base case and what happens without one?

---

The input the function answers directly without calling itself (`n == 0` for factorial, an empty subtree for a traversal). Without a reachable base case every call pushes another frame and the program dies with a stack overflow (`RecursionError` in Python after about 1000 frames). Always check the base case against the smallest valid inputs — `0`, `1`, empty.
```

```question
What is tail recursion and why does it matter?

---

A recursive call in tail position: nothing is done after it returns. The frame can be discarded before the call, so an optimising compiler turns it into a jump (`O(1)` stack), and a programmer can turn it into a loop with two edits: `if → while`, call → parameter update. Factorial becomes tail recursive by passing the running product as an accumulator. Python, Java and most JavaScript engines do <em>not</em> optimise tail calls, so convert by hand when depth matters.
```

```question
How do you find the time complexity of a recursive function?

---

Write the recurrence: calls per level × size reduction + work per call. `T(n) = T(n−1) + 1 → O(n)` (factorial), `T(n) = T(n/2) + 1 → O(log n)` (halving, binary search), `T(n) = 2T(n−1) + 1 → O(2ⁿ)` (the double-recursion puzzle, Tower of Hanoi), `T(n) = 2T(n/2) + n → O(n log n)` (merge sort). The Analysis of Algorithms topic covers solving them.
```

```question
What is the space complexity of a recursive function?

---

At least the maximum depth of the call stack, because every pending call keeps a frame: `O(n)` for factorial and `print 1..n`, `O(log n)` for halving functions, `O(height)` for a tree traversal. Depth, not total number of calls: naive `fib(n)` makes `O(2ⁿ)` calls but is only `n` deep, so it uses `O(n)` stack.
```

```question
Why is naive recursive Fibonacci slow and how do you fix it?

---

`fib(n)` calls `fib(n−1)` and `fib(n−2)`, which both recompute `fib(n−3)`, and so on — about `2 · fib(n+1)` calls, exponential. Memoise (store results in a dictionary or array, `O(n)` time and space) or compute bottom-up with two variables (`O(n)` time, `O(1)` space). Fast exponentiation of the matrix `[[1,1],[1,0]]` gives `O(log n)`.
```

```question
Direct vs indirect recursion?

---

Direct: a function calls itself. Indirect (mutual): `f` calls `g` which calls `f` — for instance `is_even(n) = is_odd(n−1)` and `is_odd(n) = is_even(n−1)` with base cases at `0`, or a recursive-descent parser where `expression` calls `term` which calls `expression` inside parentheses. The base-case and shrinking-input rules apply across the whole cycle.
```
