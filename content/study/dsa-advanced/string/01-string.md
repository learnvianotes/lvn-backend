---
id: 2f92596c-7a0c-7c08-a174-a4e9ce4ef417
key: topic:dsa-advanced/string
subject: dsa-advanced
topic: string
title: String
slug: string
order: 1
---

String problems are about <strong>finding a pattern inside a text</strong> without re-comparing characters you have already looked at. Naive matching restarts from scratch after every mismatch; Rabin–Karp compares hashes first; KMP precomputes exactly how far the pattern can safely slide. Around them sit the classic sliding-window and counting problems: anagram search, longest distinct substring and the lexicographic rank of a string.

> [!INFO]
>
> <strong>Pattern searching</strong> — given a text `txt` of length `n` and a pattern `pat` of length `m` (`1 ≤ m ≤ n`), report every index `i` such that `txt[i..i+m−1] == pat`. There are `n − m + 1` candidate positions.

# The landscape of pattern-searching algorithms

| Preprocessing | Algorithm | Time | Notes |
| --- | --- | --- | --- |
| none | naive | `O((n − m + 1) · m)` | simple; the bound is tight for `txt = aaaa…`, `pat = aaab` |
| none | naive, pattern characters distinct | `O(n)` | after a mismatch at `j`, slide by `j` |
| pattern | Rabin–Karp | `O((n − m + 1) · m)` worst, `O(n + m)` expected | compares a rolling hash first; great for many patterns of the same length |
| pattern | KMP (Knuth–Morris–Pratt) | `O(n + m)` guaranteed | LPS array tells how far to fall back; never re-reads a text character |
| text | suffix tree / suffix array | `O(m)` per query after `O(n)` build | when the same text is searched for many patterns |

> [!NOTE] Key point
>
> Preprocess whichever side is reused. One text, many patterns → preprocess the <strong>text</strong> (suffix structures). One pattern, many texts (or a streaming text) → preprocess the <strong>pattern</strong> (KMP, Rabin–Karp).

# Naive pattern searching

> [!TIP] Example
>
> <strong>Input:</strong> `txt = "GEEKSFORGEEKS", pat = "EKS"`<br><strong>Output:</strong> `2 10`<br><strong>Input:</strong> `txt = "AAAA", pat = "AAA"`<br><strong>Output:</strong> `0 1`<br><strong>Input:</strong> `txt = "geeks for geeks", pat = "geeks"`<br><strong>Output:</strong> `0 10`

Library search already does this: Python's `str.find(pat, start)` repeated from `pos + 1` finds every (possibly overlapping) occurrence.

```python filename:Python%20%E2%80%94%20using%20str.find
def find_all(txt, pat):
    pos = txt.find(pat)
    while pos >= 0:
        print(pos, end=" ")
        pos = txt.find(pat, pos + 1)      # start just after the last hit → overlaps are found too
    print()

find_all("GEEKSFORGEEKS", "EKS")
find_all("AAAA", "AAA")
```

```text filename:Output
2 10
0 1
```

> [!NOTE] Idea
>
> Try every start `i` from `0` to `n − m`. Compare `pat[0..m−1]` with `txt[i..i+m−1]` character by character and stop at the first mismatch. Report `i` when all `m` characters matched. (The original notes printed inside the inner loop, which reports a hit only when the last compared character happens to be the final one — the report belongs <em>after</em> the inner loop.)

```python filename:Python
def naive_search(txt, pat):
    n, m = len(txt), len(pat)
    res = []
    for i in range(n - m + 1):              # every candidate start
        j = 0
        while j < m and txt[i + j] == pat[j]:
            j += 1
        if j == m:                          # all m characters matched
            res.append(i)
    return res

for txt, pat in [("GEEKSFORGEEKS", "EKS"), ("AAAA", "AAA"), ("geeks for geeks", "geeks")]:
    print(pat, "in", txt, "→", " ".join(map(str, naive_search(txt, pat))))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

vector<int> naiveSearch(const string& txt, const string& pat) {
    int n = txt.size(), m = pat.size();
    vector<int> res;
    for (int i = 0; i + m <= n; i++) {           // every candidate start
        int j = 0;
        while (j < m && txt[i + j] == pat[j]) j++;
        if (j == m) res.push_back(i);            // all m characters matched
    }
    return res;
}

string join(const vector<int>& v) {
    string s;
    for (size_t i = 0; i < v.size(); i++) s += (i ? " " : "") + to_string(v[i]);
    return s;
}

int main() {
    vector<pair<string, string>> tests = {{"GEEKSFORGEEKS", "EKS"}, {"AAAA", "AAA"}, {"geeks for geeks", "geeks"}};
    for (auto& [txt, pat] : tests)
        cout << pat << " in " << txt << " → " << join(naiveSearch(txt, pat)) << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> naiveSearch(String txt, String pat) {
        int n = txt.length(), m = pat.length();
        List<Integer> res = new ArrayList<>();
        for (int i = 0; i + m <= n; i++) {                // every candidate start
            int j = 0;
            while (j < m && txt.charAt(i + j) == pat.charAt(j)) j++;
            if (j == m) res.add(i);                       // all m characters matched
        }
        return res;
    }

    static String join(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        String[][] tests = {{"GEEKSFORGEEKS", "EKS"}, {"AAAA", "AAA"}, {"geeks for geeks", "geeks"}};
        for (String[] t : tests)
            System.out.println(t[1] + " in " + t[0] + " → " + join(naiveSearch(t[0], t[1])));
    }
}
```

```javascript filename:JavaScript
function naiveSearch(txt, pat) {
    const n = txt.length, m = pat.length;
    const res = [];
    for (let i = 0; i + m <= n; i++) {               // every candidate start
        let j = 0;
        while (j < m && txt[i + j] === pat[j]) j++;
        if (j === m) res.push(i);                    // all m characters matched
    }
    return res;
}

for (const [txt, pat] of [["GEEKSFORGEEKS", "EKS"], ["AAAA", "AAA"], ["geeks for geeks", "geeks"]])
    console.log(pat, "in", txt, "→", naiveSearch(txt, pat).join(" "));
```

```text filename:Output
EKS in GEEKSFORGEEKS → 2 10
AAA in AAAA → 0 1
geeks in geeks for geeks → 0 10
```

Time O((n − m + 1) · m) · Space O(1)

> [!NOTE] Key point
>
> The worst case needs a text and pattern that agree for a long time before each mismatch — `txt = "AAAAAAAAAB"`, `pat = "AAAB"` compares `m` characters at almost every start. On typical text the first character already mismatches and the naive search runs close to `O(n)`.

# Improved naive when the pattern's characters are distinct

> [!TIP] Example
>
> <strong>Input:</strong> `txt = "ABCABCDABCD", pat = "ABCD"`<br><strong>Output:</strong> `3 7`<br><strong>Input:</strong> `txt = "AAAB", pat = "AB"`<br><strong>Output:</strong> `2`

> [!NOTE] Idea
>
> Suppose the comparison at start `i` fails at position `j > 0`, so `txt[i..i+j−1] == pat[0..j−1]`. Could a match begin at `i + s` for some `1 ≤ s < j`? It would need `txt[i+s] == pat[0]`, but `txt[i+s] = pat[s]`, and all pattern characters are <strong>distinct</strong>, so `pat[s] ≠ pat[0]`. Therefore the next possible start is `i + j`: slide by `j` instead of `1`. Every text character is now compared at most twice, giving `O(n)`.

```text filename:Text%20characters%20are%20never%20re-scanned%20from%20the%20middle%20of%20a%20partial%20match
txt :  A B C A B C D A B C D
pat :  A B C D                 mismatch at j = 3 (A ≠ D)
             A B C D           slide by 3 → match at i = 3
                     A B C D   slide by m = 4 → match at i = 7
```

```python filename:Python
def distinct_search(txt, pat):
    n, m = len(txt), len(pat)
    res = []
    i = 0
    while i <= n - m:
        j = 0
        while j < m and txt[i + j] == pat[j]:
            j += 1
        if j == m:
            res.append(i)
        i += max(1, j)            # slide by j (by 1 when the very first character failed)
    return res

print(" ".join(map(str, distinct_search("ABCABCDABCD", "ABCD"))))
print(" ".join(map(str, distinct_search("AAAB", "AB"))))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

vector<int> distinctSearch(const string& txt, const string& pat) {
    int n = txt.size(), m = pat.size();
    vector<int> res;
    int i = 0;
    while (i <= n - m) {
        int j = 0;
        while (j < m && txt[i + j] == pat[j]) j++;
        if (j == m) res.push_back(i);
        i += max(1, j);                // slide by j (by 1 when the very first character failed)
    }
    return res;
}

string join(const vector<int>& v) {
    string s;
    for (size_t i = 0; i < v.size(); i++) s += (i ? " " : "") + to_string(v[i]);
    return s;
}

int main() {
    cout << join(distinctSearch("ABCABCDABCD", "ABCD")) << "\n";
    cout << join(distinctSearch("AAAB", "AB")) << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> distinctSearch(String txt, String pat) {
        int n = txt.length(), m = pat.length();
        List<Integer> res = new ArrayList<>();
        int i = 0;
        while (i <= n - m) {
            int j = 0;
            while (j < m && txt.charAt(i + j) == pat.charAt(j)) j++;
            if (j == m) res.add(i);
            i += Math.max(1, j);       // slide by j (by 1 when the very first character failed)
        }
        return res;
    }

    static String join(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println(join(distinctSearch("ABCABCDABCD", "ABCD")));
        System.out.println(join(distinctSearch("AAAB", "AB")));
    }
}
```

```javascript filename:JavaScript
function distinctSearch(txt, pat) {
    const n = txt.length, m = pat.length;
    const res = [];
    let i = 0;
    while (i <= n - m) {
        let j = 0;
        while (j < m && txt[i + j] === pat[j]) j++;
        if (j === m) res.push(i);
        i += Math.max(1, j);           // slide by j (by 1 when the very first character failed)
    }
    return res;
}

console.log(distinctSearch("ABCABCDABCD", "ABCD").join(" "));
console.log(distinctSearch("AAAB", "AB").join(" "));
```

```text filename:Output
3 7
2
```

Time O(n) · Space O(1)

> [!WARNING] Pitfall
>
> The original notes ran this with `pat = "geeks"` — whose `e` repeats — so the precondition was violated (and the Python `for j in range(m)` loop could never reach `j == m`). With a repeated character, sliding by `j` can skip a real match: `txt = "aab"`, `pat = "ab"` fails at `j = 1` on start 0 and would jump to start 1 — fine here, but `txt = "aaab"`, `pat = "aab"` fails at `j = 2` and skips the match at 1. That is exactly the gap KMP closes.

# Rabin–Karp with a rolling hash

> [!TIP] Example
>
> <strong>Input:</strong> `txt = "geeks for geeks", pat = "geeks"`<br><strong>Output:</strong> `0 10`<br><strong>Input:</strong> `txt = "GEEKSFORGEEKS", pat = "EKS"`<br><strong>Output:</strong> `2 10`<br><strong>Input:</strong> `txt = "aaaaab", pat = "aaaa"`<br><strong>Output:</strong> `0 1`

Like the naive algorithm, slide the pattern over every start — but compare a <strong>hash</strong> of the pattern with a hash of the current window first, and only compare characters when the hashes agree. The trick is computing the next window's hash from the previous one in `O(1)` — a <em>rolling hash</em>.

1. <strong>A first attempt: the sum of character codes</strong>

   `t(i+1) = t(i) + txt[i+m] − txt[i]` — `O(1)` per shift, but every anagram of the pattern (`abc`, `bca`, `cab`) has the same hash, so spurious hits are common.

2. <strong>A better hash: treat the window as a base-</strong><strong>`d`</strong><strong> number</strong>

   `h(s) = s[0]·d^(m−1) + s[1]·d^(m−2) + … + s[m−1]·d^0`. With `d = 5` and `a = 1, b = 2, c = 3, d = 4`: `h("abc") = 1·25 + 2·5 + 3 = 38`, `h("dab") = 4·25 + 1·5 + 2 = 107`. Position now matters.

3. <strong>Roll it</strong>

   Remove the leading digit, shift left, append the new digit: `t(i+1) = d · (t(i) − txt[i] · d^(m−1)) + txt[i+m]`. Three multiplications and two additions — `O(1)` whatever `m` is.

4. <strong>Keep numbers small</strong>

   Take everything modulo a prime `q` (`d = 256` for bytes, `q = 101` in the examples). Equal hashes are then only <em>probably</em> equal strings — the character check settles it.

`t(i+1) = ( d · ( t(i) − txt[i] · d^(m−1) ) + txt[i+m] ) mod q`

> [!NOTE] Idea
>
> Hashing shifts the cost from `O(m)` per window to `O(1)` per window plus `O(m)` only when the hashes collide. A good hash collides rarely, so the expected time is `O(n + m)`; with a bad hash (or an adversarial input) every window collides and it degrades to the naive `O(n · m)`. The program below also reports <strong>spurious hits</strong> — windows whose hash matched but whose text did not.

```python filename:Python
d, q = 256, 101                              # alphabet size, prime modulus

def rabin_karp(txt, pat):
    n, m = len(txt), len(pat)
    h = 1                                    # h = d^(m-1) mod q
    for _ in range(m - 1):
        h = (h * d) % q
    p = t = 0
    for i in range(m):                       # hash of the pattern and of the first window
        p = (p * d + ord(pat[i])) % q
        t = (t * d + ord(txt[i])) % q
    hits, spurious = [], []
    for i in range(n - m + 1):
        if p == t:                           # hashes agree → verify character by character
            if txt[i:i + m] == pat:
                hits.append(i)
            else:
                spurious.append(i)
        if i < n - m:                        # roll: drop txt[i], append txt[i+m]
            t = (d * (t - ord(txt[i]) * h) + ord(txt[i + m])) % q
            if t < 0:
                t += q                       # (Python's % is never negative; kept for symmetry)
    return hits, spurious

for txt, pat in [("geeks for geeks", "geeks"), ("GEEKSFORGEEKS", "EKS"), ("aaaaab", "aaaa")]:
    hits, spurious = rabin_karp(txt, pat)
    line = pat + " in " + txt + " → " + " ".join(map(str, hits))
    if spurious:
        line += " (spurious hits at " + " ".join(map(str, spurious)) + ")"
    print(line)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

const int d = 256, q = 101;                  // alphabet size, prime modulus

string join(const vector<int>& v) {
    string s;
    for (size_t i = 0; i < v.size(); i++) s += (i ? " " : "") + to_string(v[i]);
    return s;
}

void rabinKarp(const string& txt, const string& pat) {
    int n = txt.size(), m = pat.size();
    int h = 1;                                // h = d^(m-1) mod q
    for (int i = 0; i < m - 1; i++) h = (h * d) % q;
    int p = 0, t = 0;
    for (int i = 0; i < m; i++) {             // hash of the pattern and of the first window
        p = (p * d + pat[i]) % q;
        t = (t * d + txt[i]) % q;
    }
    vector<int> hits, spurious;
    for (int i = 0; i <= n - m; i++) {
        if (p == t) {                         // hashes agree → verify character by character
            if (txt.compare(i, m, pat) == 0) hits.push_back(i);
            else spurious.push_back(i);
        }
        if (i < n - m) {                      // roll: drop txt[i], append txt[i+m]
            t = (d * (t - txt[i] * h) + txt[i + m]) % q;
            if (t < 0) t += q;                // C++ % can be negative
        }
    }
    cout << pat << " in " << txt << " → " << join(hits);
    if (!spurious.empty()) cout << " (spurious hits at " << join(spurious) << ")";
    cout << "\n";
}

int main() {
    rabinKarp("geeks for geeks", "geeks");
    rabinKarp("GEEKSFORGEEKS", "EKS");
    rabinKarp("aaaaab", "aaaa");
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static final int d = 256, q = 101;        // alphabet size, prime modulus

    static String join(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        return sb.toString();
    }

    static void rabinKarp(String txt, String pat) {
        int n = txt.length(), m = pat.length();
        int h = 1;                            // h = d^(m-1) mod q
        for (int i = 0; i < m - 1; i++) h = (h * d) % q;
        int p = 0, t = 0;
        for (int i = 0; i < m; i++) {         // hash of the pattern and of the first window
            p = (p * d + pat.charAt(i)) % q;
            t = (t * d + txt.charAt(i)) % q;
        }
        List<Integer> hits = new ArrayList<>(), spurious = new ArrayList<>();
        for (int i = 0; i <= n - m; i++) {
            if (p == t) {                     // hashes agree → verify character by character
                if (txt.startsWith(pat, i)) hits.add(i);
                else spurious.add(i);
            }
            if (i < n - m) {                  // roll: drop txt[i], append txt[i+m]
                t = (d * (t - txt.charAt(i) * h) + txt.charAt(i + m)) % q;
                if (t < 0) t += q;            // Java % can be negative
            }
        }
        String line = pat + " in " + txt + " → " + join(hits);
        if (!spurious.isEmpty()) line += " (spurious hits at " + join(spurious) + ")";
        System.out.println(line);
    }

    public static void main(String[] args) {
        rabinKarp("geeks for geeks", "geeks");
        rabinKarp("GEEKSFORGEEKS", "EKS");
        rabinKarp("aaaaab", "aaaa");
    }
}
```

```javascript filename:JavaScript
const d = 256, q = 101;                        // alphabet size, prime modulus

function rabinKarp(txt, pat) {
    const n = txt.length, m = pat.length;
    let h = 1;                                 // h = d^(m-1) mod q
    for (let i = 0; i < m - 1; i++) h = (h * d) % q;
    let p = 0, t = 0;
    for (let i = 0; i < m; i++) {              // hash of the pattern and of the first window
        p = (p * d + pat.charCodeAt(i)) % q;
        t = (t * d + txt.charCodeAt(i)) % q;
    }
    const hits = [], spurious = [];
    for (let i = 0; i <= n - m; i++) {
        if (p === t) {                         // hashes agree → verify character by character
            if (txt.startsWith(pat, i)) hits.push(i);
            else spurious.push(i);
        }
        if (i < n - m) {                       // roll: drop txt[i], append txt[i+m]
            t = (d * (t - txt.charCodeAt(i) * h) + txt.charCodeAt(i + m)) % q;
            if (t < 0) t += q;                 // JavaScript % can be negative
        }
    }
    let line = pat + " in " + txt + " → " + hits.join(" ");
    if (spurious.length) line += " (spurious hits at " + spurious.join(" ") + ")";
    console.log(line);
}

rabinKarp("geeks for geeks", "geeks");
rabinKarp("GEEKSFORGEEKS", "EKS");
rabinKarp("aaaaab", "aaaa");
```

```text filename:Output
geeks in geeks for geeks → 0 10
EKS in GEEKSFORGEEKS → 2 10 (spurious hits at 5)
aaaa in aaaaab → 0 1
```

Time O(n + m) expected, O(n · m) worst · Space O(1)

> [!NOTE] Key point
>
> Window 5 of `GEEKSFORGEEKS` is `SFO`, which happens to hash to the same value as `EKS` modulo 101 — a <strong>spurious hit</strong> caught by the character comparison. A larger prime (`10^9 + 7` with 64-bit arithmetic) makes such collisions rare in practice; in C++/Java use `long` so `d · t` cannot overflow.

> [!WARNING] Pitfall
>
> The subtraction in the rolling step makes the remainder <strong>negative</strong> in C++, Java and JavaScript (`-7 % 101 == -7`). Always add `q` back (or write `((x % q) + q) % q`). Python's `%` already returns a non-negative result, which is why the bug does not show in Python prototypes.

# KMP: the LPS array (longest proper prefix which is also a suffix)

> [!TIP] Example
>
> <strong>Input:</strong> `pat = "ababc"`<br><strong>Output:</strong> `lps = [0, 0, 1, 2, 0]`<br><strong>Input:</strong> `pat = "aaaa"`<br><strong>Output:</strong> `lps = [0, 1, 2, 3]`<br><strong>Input:</strong> `pat = "abacabad"`<br><strong>Output:</strong> `lps = [0, 0, 1, 0, 1, 2, 3, 0]`

A <strong>proper prefix</strong> of a string is a prefix that is not the whole string; likewise for suffixes. For `"abc"`: proper prefixes `""`, `"a"`, `"ab"`; proper suffixes `""`, `"c"`, `"bc"`. `lps[i]` is the length of the longest proper prefix of `pat[0..i]` that is also a suffix of `pat[0..i]`.

```text filename:lps%20for%20%22ababc%22%20%3D%20%5B0%2C%200%2C%201%2C%202%2C%200%5D
pat[0..i]    longest proper prefix that is also a suffix    lps[i]
a            ""                                                0
ab           ""                                                0
aba          "a"                                               1
abab         "ab"                                              2
ababc        ""                                                0
```

Computing each entry by brute force — try every length from `i` down to `1` and compare — is simple but cubic:

```python filename:Python%20%E2%80%94%20naive
def longest_proper_prefix_suffix(s):
    n = len(s)
    for length in range(n - 1, 0, -1):             # longest first
        if s[:length] == s[n - length:]:
            return length
    return 0

def lps_naive(pat):
    return [longest_proper_prefix_suffix(pat[:i + 1]) for i in range(len(pat))]

print(lps_naive("ababc"))
print(lps_naive("abacabad"))
```

```text filename:Output
[0, 0, 1, 2, 0]
[0, 0, 1, 0, 1, 2, 3, 0]
```

Time O(n³) · Space O(n)

> [!NOTE] Idea
>
> Build `lps` left to right, reusing the previous answer. Let `len = lps[i−1]` — the prefix `pat[0..len−1]` matches the suffix ending at `i−1`. If `pat[len] == pat[i]`, that match extends by one: `lps[i] = len + 1`. Otherwise fall back to the <strong>next shorter</strong> candidate: the longest proper prefix-suffix of `pat[0..len−1]`, which is `lps[len−1]`, and compare again. Fall back until a match or `len == 0`.

```text filename:Falling%20back%20through%20shorter%20prefix-suffix%20candidates%20instead%20of%20rescanning
pat = a b a c a b a d        lps so far = 0 0 1 0 1 2 3 ?       (i = 7, len = lps[6] = 3)

pat[3] = 'c' ≠ pat[7] = 'd'   →  len = lps[2] = 1
pat[1] = 'b' ≠ 'd'            →  len = lps[0] = 0
pat[0] = 'a' ≠ 'd', len == 0  →  lps[7] = 0
```

```python filename:Python
def compute_lps(pat):
    m = len(pat)
    lps = [0] * m
    length = 0                         # length of the previous longest prefix-suffix
    i = 1
    while i < m:
        if pat[i] == pat[length]:
            length += 1
            lps[i] = length            # the match extends by one
            i += 1
        elif length != 0:
            length = lps[length - 1]   # fall back to the next shorter candidate; i stays
        else:
            lps[i] = 0
            i += 1
    return lps

for pat in ["ababc", "aaaa", "abacabad"]:
    print(pat, "→", " ".join(map(str, compute_lps(pat))))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

vector<int> computeLps(const string& pat) {
    int m = pat.size();
    vector<int> lps(m, 0);
    int len = 0;                           // length of the previous longest prefix-suffix
    int i = 1;
    while (i < m) {
        if (pat[i] == pat[len]) {
            lps[i++] = ++len;              // the match extends by one
        } else if (len != 0) {
            len = lps[len - 1];            // fall back to the next shorter candidate; i stays
        } else {
            lps[i++] = 0;
        }
    }
    return lps;
}

int main() {
    for (string pat : {"ababc", "aaaa", "abacabad"}) {
        cout << pat << " →";
        for (int x : computeLps(pat)) cout << " " << x;
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static int[] computeLps(String pat) {
        int m = pat.length();
        int[] lps = new int[m];
        int len = 0;                           // length of the previous longest prefix-suffix
        int i = 1;
        while (i < m) {
            if (pat.charAt(i) == pat.charAt(len)) {
                lps[i++] = ++len;              // the match extends by one
            } else if (len != 0) {
                len = lps[len - 1];            // fall back to the next shorter candidate; i stays
            } else {
                lps[i++] = 0;
            }
        }
        return lps;
    }

    public static void main(String[] args) {
        for (String pat : new String[]{"ababc", "aaaa", "abacabad"}) {
            StringBuilder sb = new StringBuilder(pat + " →");
            for (int x : computeLps(pat)) sb.append(" ").append(x);
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function computeLps(pat) {
    const m = pat.length;
    const lps = new Array(m).fill(0);
    let len = 0;                               // length of the previous longest prefix-suffix
    let i = 1;
    while (i < m) {
        if (pat[i] === pat[len]) {
            lps[i++] = ++len;                  // the match extends by one
        } else if (len !== 0) {
            len = lps[len - 1];                // fall back to the next shorter candidate; i stays
        } else {
            lps[i++] = 0;
        }
    }
    return lps;
}

for (const pat of ["ababc", "aaaa", "abacabad"])
    console.log(pat, "→", computeLps(pat).join(" "));
```

```text filename:Output
ababc → 0 0 1 2 0
aaaa → 0 1 2 3
abacabad → 0 0 1 0 1 2 3 0
```

Time O(m) · Space O(m)

> [!NOTE] Key point
>
> Why `O(m)` despite the inner fall-back loop: `len` increases at most once per character (by 1) and every fall-back strictly decreases it, so the total number of fall-backs over the whole run is at most `m`. The same argument gives the linear bound for the matching phase below.

# KMP string matching

> [!TIP] Example
>
> <strong>Input:</strong> `txt = "abcdefg", pat = "bcd"`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `txt = "aaaaab", pat = "aaaa"`<br><strong>Output:</strong> `0 1`<br><strong>Input:</strong> `txt = "aaaaabaaaaac", pat = "aaaa"`<br><strong>Output:</strong> `0 1 6 7`

> [!NOTE] Idea
>
> Run two indices, `i` over the text and `j` over the pattern. On a match advance both. On a mismatch with `j > 0`, the characters `txt[i−j..i−1]` equal `pat[0..j−1]` — and `lps[j−1]` says how long a prefix of the pattern is <em>still</em> aligned with the end of that stretch. So set `j = lps[j−1]` and compare again <strong>without moving </strong><strong>`i`</strong>. When `j` reaches `m` report `i − m` and continue the same way (`j = lps[m−1]`) to find overlapping occurrences. `i` never moves backwards, so the text is read once.

```text filename:The%20text%20index%20i%20never%20goes%20back%3B%20only%20the%20pattern%20index%20j%20falls%20back
txt :  a a a a a b a a a a a c
pat :  a a a a                  j = 4 = m → report 0, j = lps[3] = 3
pat :    a a a a                txt[4] = a = pat[3] → j = 4 → report 1, j = 3
pat :      a a a a              txt[5] = b ≠ pat[3] → j = lps[2] = 2 … → j = 0, then i++
pat :              a a a a      matches resume at i = 6 → report 6, then 7
```

```python filename:Python
def compute_lps(pat):
    lps = [0] * len(pat)
    length, i = 0, 1
    while i < len(pat):
        if pat[i] == pat[length]:
            length += 1
            lps[i] = length
            i += 1
        elif length != 0:
            length = lps[length - 1]
        else:
            lps[i] = 0
            i += 1
    return lps

def kmp_search(txt, pat):
    n, m = len(txt), len(pat)
    lps = compute_lps(pat)
    res = []
    i = j = 0                          # i → text, j → pattern
    while i < n:
        if txt[i] == pat[j]:
            i += 1
            j += 1
            if j == m:                 # full match ends at i-1
                res.append(i - j)
                j = lps[j - 1]         # keep going: overlapping matches
        elif j != 0:
            j = lps[j - 1]             # fall back in the pattern; i does not move
        else:
            i += 1                     # no partial match to reuse
    return res

for txt, pat in [("abcdefg", "bcd"), ("aaaaab", "aaaa"), ("aaaaabaaaaac", "aaaa")]:
    print(pat, "in", txt, "→", " ".join(map(str, kmp_search(txt, pat))))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

vector<int> computeLps(const string& pat) {
    int m = pat.size();
    vector<int> lps(m, 0);
    int len = 0, i = 1;
    while (i < m) {
        if (pat[i] == pat[len]) lps[i++] = ++len;
        else if (len != 0) len = lps[len - 1];
        else lps[i++] = 0;
    }
    return lps;
}

vector<int> kmpSearch(const string& txt, const string& pat) {
    int n = txt.size(), m = pat.size();
    vector<int> lps = computeLps(pat), res;
    int i = 0, j = 0;                          // i → text, j → pattern
    while (i < n) {
        if (txt[i] == pat[j]) {
            i++; j++;
            if (j == m) {                      // full match ends at i-1
                res.push_back(i - j);
                j = lps[j - 1];                // keep going: overlapping matches
            }
        } else if (j != 0) {
            j = lps[j - 1];                    // fall back in the pattern; i does not move
        } else {
            i++;                               // no partial match to reuse
        }
    }
    return res;
}

string join(const vector<int>& v) {
    string s;
    for (size_t i = 0; i < v.size(); i++) s += (i ? " " : "") + to_string(v[i]);
    return s;
}

int main() {
    vector<pair<string, string>> tests = {{"abcdefg", "bcd"}, {"aaaaab", "aaaa"}, {"aaaaabaaaaac", "aaaa"}};
    for (auto& [txt, pat] : tests)
        cout << pat << " in " << txt << " → " << join(kmpSearch(txt, pat)) << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static int[] computeLps(String pat) {
        int m = pat.length();
        int[] lps = new int[m];
        int len = 0, i = 1;
        while (i < m) {
            if (pat.charAt(i) == pat.charAt(len)) lps[i++] = ++len;
            else if (len != 0) len = lps[len - 1];
            else lps[i++] = 0;
        }
        return lps;
    }

    static List<Integer> kmpSearch(String txt, String pat) {
        int n = txt.length(), m = pat.length();
        int[] lps = computeLps(pat);
        List<Integer> res = new ArrayList<>();
        int i = 0, j = 0;                          // i → text, j → pattern
        while (i < n) {
            if (txt.charAt(i) == pat.charAt(j)) {
                i++; j++;
                if (j == m) {                      // full match ends at i-1
                    res.add(i - j);
                    j = lps[j - 1];                // keep going: overlapping matches
                }
            } else if (j != 0) {
                j = lps[j - 1];                    // fall back in the pattern; i does not move
            } else {
                i++;                               // no partial match to reuse
            }
        }
        return res;
    }

    static String join(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        return sb.toString();
    }

    public static void main(String[] args) {
        String[][] tests = {{"abcdefg", "bcd"}, {"aaaaab", "aaaa"}, {"aaaaabaaaaac", "aaaa"}};
        for (String[] t : tests)
            System.out.println(t[1] + " in " + t[0] + " → " + join(kmpSearch(t[0], t[1])));
    }
}
```

```javascript filename:JavaScript
function computeLps(pat) {
    const m = pat.length, lps = new Array(m).fill(0);
    let len = 0, i = 1;
    while (i < m) {
        if (pat[i] === pat[len]) lps[i++] = ++len;
        else if (len !== 0) len = lps[len - 1];
        else lps[i++] = 0;
    }
    return lps;
}

function kmpSearch(txt, pat) {
    const n = txt.length, m = pat.length;
    const lps = computeLps(pat), res = [];
    let i = 0, j = 0;                              // i → text, j → pattern
    while (i < n) {
        if (txt[i] === pat[j]) {
            i++; j++;
            if (j === m) {                         // full match ends at i-1
                res.push(i - j);
                j = lps[j - 1];                    // keep going: overlapping matches
            }
        } else if (j !== 0) {
            j = lps[j - 1];                        // fall back in the pattern; i does not move
        } else {
            i++;                                   // no partial match to reuse
        }
    }
    return res;
}

for (const [txt, pat] of [["abcdefg", "bcd"], ["aaaaab", "aaaa"], ["aaaaabaaaaac", "aaaa"]])
    console.log(pat, "in", txt, "→", kmpSearch(txt, pat).join(" "));
```

```text filename:Output
bcd in abcdefg → 1
aaaa in aaaaab → 0 1
aaaa in aaaaabaaaaac → 0 1 6 7
```

Time O(n + m) · Space O(m)

> [!WARNING] Pitfall
>
> After a full match do <strong>not</strong> reset `j = 0` — that misses overlapping occurrences (`aaaa` in `aaaaab` occurs at both 0 and 1). `j = lps[m − 1]` keeps the longest reusable overlap. And guard the mismatch branch with `j != 0` before indexing `lps[j − 1]`.

# Anagram search

> [!TIP] Example
>
> <strong>Input:</strong> `txt = "geeksforgeeks", pat = "forg"`<br><strong>Output:</strong> `Yes (window "forg" at 5)`<br><strong>Input:</strong> `txt = "geeksforgeeks", pat = "rseek"`<br><strong>Output:</strong> `No`

Does the text contain any <strong>permutation</strong> of the pattern as a substring? Order no longer matters, only the multiset of characters, so hashing by comparison fails and we count instead. Naive: for every window, count the pattern's characters up and the window's characters down and check that everything cancels.

```python filename:Python%20%E2%80%94%20naive
CHAR = 256

def is_anagram_at(txt, pat, i):
    count = [0] * CHAR
    for j in range(len(pat)):
        count[ord(pat[j])] += 1
        count[ord(txt[i + j])] -= 1
    return all(c == 0 for c in count)

def contains_anagram(txt, pat):
    n, m = len(txt), len(pat)
    return any(is_anagram_at(txt, pat, i) for i in range(n - m + 1))

print("Yes" if contains_anagram("geeksforgeeks", "forg") else "No")
print("Yes" if contains_anagram("geeksforgeeks", "rseek") else "No")
```

```text filename:Output
Yes
No
```

Time O((n − m + 1) · (m + CHAR)) · Space O(CHAR)

> [!NOTE] Idea
>
> Sliding window of size `m` with two count arrays: `cp` for the pattern (fixed) and `ct` for the current window. Moving the window one step changes <strong>two</strong> counts in `ct` (one character in, one out) — `O(1)`. After each move compare `ct` with `cp`; a window is an anagram exactly when the two arrays are equal.

```python filename:Python
CHAR = 256

def contains_anagram(txt, pat):
    n, m = len(txt), len(pat)
    if m > n:
        return False
    ct, cp = [0] * CHAR, [0] * CHAR
    for i in range(m):                     # first window and the pattern
        ct[ord(txt[i])] += 1
        cp[ord(pat[i])] += 1
    for i in range(m, n):
        if ct == cp:
            return True
        ct[ord(txt[i])] += 1               # character entering the window
        ct[ord(txt[i - m])] -= 1           # character leaving the window
    return ct == cp                        # the last window

for txt, pat in [("geeksforgeeks", "forg"), ("geeksforgeeks", "rseek"), ("cbaebabacd", "abc")]:
    print(pat, "in", txt, "→", "Yes" if contains_anagram(txt, pat) else "No")
```

```cpp filename:C%2B%2B
#include <array>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

const int CHAR = 256;

bool containsAnagram(const string& txt, const string& pat) {
    int n = txt.size(), m = pat.size();
    if (m > n) return false;
    array<int, CHAR> ct{}, cp{};
    for (int i = 0; i < m; i++) {                      // first window and the pattern
        ct[(unsigned char)txt[i]]++;
        cp[(unsigned char)pat[i]]++;
    }
    for (int i = m; i < n; i++) {
        if (ct == cp) return true;
        ct[(unsigned char)txt[i]]++;                   // character entering the window
        ct[(unsigned char)txt[i - m]]--;               // character leaving the window
    }
    return ct == cp;                                   // the last window
}

int main() {
    vector<pair<string, string>> tests = {{"geeksforgeeks", "forg"}, {"geeksforgeeks", "rseek"}, {"cbaebabacd", "abc"}};
    for (auto& [txt, pat] : tests)
        cout << pat << " in " << txt << " → " << (containsAnagram(txt, pat) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static final int CHAR = 256;

    static boolean containsAnagram(String txt, String pat) {
        int n = txt.length(), m = pat.length();
        if (m > n) return false;
        int[] ct = new int[CHAR], cp = new int[CHAR];
        for (int i = 0; i < m; i++) {                  // first window and the pattern
            ct[txt.charAt(i)]++;
            cp[pat.charAt(i)]++;
        }
        for (int i = m; i < n; i++) {
            if (Arrays.equals(ct, cp)) return true;
            ct[txt.charAt(i)]++;                       // character entering the window
            ct[txt.charAt(i - m)]--;                   // character leaving the window
        }
        return Arrays.equals(ct, cp);                  // the last window
    }

    public static void main(String[] args) {
        String[][] tests = {{"geeksforgeeks", "forg"}, {"geeksforgeeks", "rseek"}, {"cbaebabacd", "abc"}};
        for (String[] t : tests)
            System.out.println(t[1] + " in " + t[0] + " → " + (containsAnagram(t[0], t[1]) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function sameCounts(a, b) {
    for (let i = 0; i < CHAR; i++) if (a[i] !== b[i]) return false;
    return true;
}

function containsAnagram(txt, pat) {
    const n = txt.length, m = pat.length;
    if (m > n) return false;
    const ct = new Array(CHAR).fill(0), cp = new Array(CHAR).fill(0);
    for (let i = 0; i < m; i++) {                      // first window and the pattern
        ct[txt.charCodeAt(i)]++;
        cp[pat.charCodeAt(i)]++;
    }
    for (let i = m; i < n; i++) {
        if (sameCounts(ct, cp)) return true;
        ct[txt.charCodeAt(i)]++;                       // character entering the window
        ct[txt.charCodeAt(i - m)]--;                   // character leaving the window
    }
    return sameCounts(ct, cp);                         // the last window
}

for (const [txt, pat] of [["geeksforgeeks", "forg"], ["geeksforgeeks", "rseek"], ["cbaebabacd", "abc"]])
    console.log(pat, "in", txt, "→", containsAnagram(txt, pat) ? "Yes" : "No");
```

```text filename:Output
forg in geeksforgeeks → Yes
rseek in geeksforgeeks → No
abc in cbaebabacd → Yes
```

Time O(n · CHAR) · Space O(CHAR)

> [!NOTE] Key point
>
> `CHAR` is a constant, so this is linear — but comparing 256 counters per window is the dominant cost. The standard refinement keeps a single `mismatches` counter: when a count in `ct` changes, update whether that slot agrees with `cp`; the window is an anagram when `mismatches == 0`. That is `O(n)` with no array comparison at all.

# Lexicographic rank of a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "ABC"`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `s = "BAC"`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `s = "STRING"`<br><strong>Output:</strong> `598`

Among all permutations of the string's characters listed in dictionary order, which position does the string itself hold (1-based)? For `"ABC"` the six permutations are:

| Rank | Permutation |
| --- | --- |
| 1 | `ABC` |
| 2 | `ACB` |
| 3 | `BAC` |
| 4 | `BCA` |
| 5 | `CAB` |
| 6 | `CBA` |

The pen-and-paper method generates every permutation and counts — `O(n · n!)`:

```python filename:Python%20%E2%80%94%20naive
from itertools import permutations

def rank_naive(s):
    perms = sorted(''.join(p) for p in permutations(s))     # n! strings, sorted
    return perms.index(s) + 1

print(rank_naive("ABC"), rank_naive("BAC"), rank_naive("STRING"))
```

```text filename:Output
1 3 598
```

> [!NOTE] Idea
>
> Count how many permutations come <strong>before</strong> `s`. Every permutation that starts with a character smaller than `s[0]` precedes `s` — there are `(number of smaller characters) × (n − 1)!` of them. Fix `s[0]` and repeat on the remainder: at position `i`, add `(smaller unused characters to the right of i) × (n − i − 1)!`. A cumulative count array `count[c] = number of unused characters ≤ c` answers “how many smaller” in `O(1)`; after using `s[i]`, decrement `count[c]` for every `c ≥ s[i]`.

```text filename:Rank%20of%20%22BAC%22
s = "BAC",  n = 3,  (n-1)! = 2

i = 0, 'B' : smaller unused chars = {A} → 1 × 2! = 2 permutations start with 'A'
i = 1, 'A' : smaller unused chars = {}  → 0 × 1! = 0
rank = 1 + 2 + 0 = 3
```

```python filename:Python
CHAR = 256

def factorial(n):
    r = 1
    for i in range(2, n + 1):
        r *= i
    return r

def lex_rank(s):
    n = len(s)
    count = [0] * CHAR
    for ch in s:
        count[ord(ch)] += 1
    for c in range(1, CHAR):                 # cumulative: count[c] = #chars <= c
        count[c] += count[c - 1]
    rank = 1
    mul = factorial(n)
    for i in range(n - 1):
        mul //= n - i                        # (n - i - 1)!
        c = ord(s[i])
        rank += count[c - 1] * mul           # unused chars smaller than s[i]
        for j in range(c, CHAR):             # s[i] is used up now
            count[j] -= 1
    return rank

for s in ["ABC", "BAC", "CBA", "STRING"]:
    print(s, "→", lex_rank(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const int CHAR = 256;

long long factorial(int n) {
    long long r = 1;
    for (int i = 2; i <= n; i++) r *= i;
    return r;
}

long long lexRank(const string& s) {
    int n = s.size();
    int count[CHAR] = {0};
    for (char ch : s) count[(unsigned char)ch]++;
    for (int c = 1; c < CHAR; c++) count[c] += count[c - 1];   // cumulative: count[c] = #chars <= c
    long long rank = 1, mul = factorial(n);
    for (int i = 0; i < n - 1; i++) {
        mul /= n - i;                                    // (n - i - 1)!
        int c = (unsigned char)s[i];
        rank += count[c - 1] * mul;                      // unused chars smaller than s[i]
        for (int j = c; j < CHAR; j++) count[j]--;       // s[i] is used up now
    }
    return rank;
}

int main() {
    for (string s : {"ABC", "BAC", "CBA", "STRING"})
        cout << s << " → " << lexRank(s) << "\n";
}
```

```java filename:Java
public class Main {
    static final int CHAR = 256;

    static long factorial(int n) {
        long r = 1;
        for (int i = 2; i <= n; i++) r *= i;
        return r;
    }

    static long lexRank(String s) {
        int n = s.length();
        int[] count = new int[CHAR];
        for (char ch : s.toCharArray()) count[ch]++;
        for (int c = 1; c < CHAR; c++) count[c] += count[c - 1];   // cumulative: count[c] = #chars <= c
        long rank = 1, mul = factorial(n);
        for (int i = 0; i < n - 1; i++) {
            mul /= n - i;                                    // (n - i - 1)!
            int c = s.charAt(i);
            rank += count[c - 1] * mul;                      // unused chars smaller than s[i]
            for (int j = c; j < CHAR; j++) count[j]--;       // s[i] is used up now
        }
        return rank;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"ABC", "BAC", "CBA", "STRING"})
            System.out.println(s + " → " + lexRank(s));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function factorial(n) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function lexRank(s) {
    const n = s.length;
    const count = new Array(CHAR).fill(0);
    for (const ch of s) count[ch.charCodeAt(0)]++;
    for (let c = 1; c < CHAR; c++) count[c] += count[c - 1];   // cumulative: count[c] = #chars <= c
    let rank = 1, mul = factorial(n);
    for (let i = 0; i < n - 1; i++) {
        mul /= n - i;                                    // (n - i - 1)!  (exact: mul is a multiple)
        const c = s.charCodeAt(i);
        rank += count[c - 1] * mul;                      // unused chars smaller than s[i]
        for (let j = c; j < CHAR; j++) count[j]--;       // s[i] is used up now
    }
    return rank;
}

for (const s of ["ABC", "BAC", "CBA", "STRING"])
    console.log(s, "→", lexRank(s));
```

```text filename:Output
ABC → 1
BAC → 3
CBA → 6
STRING → 598
```

Time O(n · CHAR) · Space O(CHAR)

> [!WARNING] Pitfall
>
> This formula assumes <strong>distinct characters</strong>. With repeats (`"AAB"`) the count of permutations starting with a smaller character must be divided by the factorials of the repeated characters' counts. Also `n!` overflows a 32-bit `int` from `n = 13` — use 64-bit integers (as above), which last until `n = 20`.

# Longest substring with distinct characters

> [!TIP] Example
>
> <strong>Input:</strong> `s = "abcdabc"`<br><strong>Output:</strong> `4 ("abcd")`<br><strong>Input:</strong> `s = "aaa"`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `s = "geeksforgeeks"`<br><strong>Output:</strong> `7 ("eksforg")`

Find the length of the longest substring in which no character repeats. The naive version tests every substring; the <em>better</em> one notices that once a substring from `i` contains a repeat, no longer substring from `i` can be distinct — so it breaks out of the inner loop.

```python filename:Python%20%E2%80%94%20naive%20O(n%C2%B3)%20and%20better%20O(n%C2%B2)
def longest_distinct_naive(s):                 # O(n^3): every (i, j), each checked in O(n)
    n, best = len(s), 0
    for i in range(n):
        for j in range(i, n):
            if len(set(s[i:j + 1])) == j - i + 1:
                best = max(best, j - i + 1)
    return best

def longest_distinct_better(s):                # O(n^2): extend from i until the first repeat
    n, best = len(s), 0
    for i in range(n):
        seen = set()
        for j in range(i, n):
            if s[j] in seen:
                break
            seen.add(s[j])
            best = max(best, j - i + 1)
    return best

print(longest_distinct_naive("abcdabc"), longest_distinct_better("abcdabc"))
print(longest_distinct_naive("geeksforgeeks"), longest_distinct_better("geeksforgeeks"))
```

```text filename:Output
4 4
7 7
```

> [!NOTE] Idea
>
> Sliding window with a <strong>last-seen index</strong> per character. Let `start` be the left end of the current distinct window and let `j` move right. If `s[j]` was last seen at `prev[s[j]] ≥ start`, the window must begin after that occurrence: `start = prev[s[j]] + 1`. Taking `start = max(start, prev[s[j]] + 1)` handles both cases in one line; `j − start + 1` is the length of the longest distinct substring ending at `j`. Each character is visited once.

```text filename:The%20window%20start%20only%20ever%20moves%20right
s     :  a  b  c  d  a  b  c
j = 4 : 'a' last seen at 0 → start = 1, window "bcda" (length 4)
j = 5 : 'b' last seen at 1 → start = 2, window "cdab" (length 4)
j = 6 : 'c' last seen at 2 → start = 3, window "dabc" (length 4)
```

```python filename:Python
def longest_distinct(s):
    prev = [-1] * 256                 # last index where each character was seen
    start = 0                         # left end of the current distinct window
    best = 0
    for j, ch in enumerate(s):
        start = max(start, prev[ord(ch)] + 1)   # jump past the previous occurrence
        best = max(best, j - start + 1)
        prev[ord(ch)] = j
    return best

for s in ["abcdabc", "aaa", "geeksforgeeks", "abcdefg"]:
    print(s, "→", longest_distinct(s))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
using namespace std;

int longestDistinct(const string& s) {
    int prev[256];
    fill(prev, prev + 256, -1);                  // last index where each character was seen
    int start = 0, best = 0;                     // start = left end of the current distinct window
    int n = s.size();
    for (int j = 0; j < n; j++) {
        unsigned char ch = s[j];
        start = max(start, prev[ch] + 1);        // jump past the previous occurrence
        best = max(best, j - start + 1);
        prev[ch] = j;
    }
    return best;
}

int main() {
    for (string s : {"abcdabc", "aaa", "geeksforgeeks", "abcdefg"})
        cout << s << " → " << longestDistinct(s) << "\n";
}
```

```java filename:Java
import java.util.Arrays;

public class Main {
    static int longestDistinct(String s) {
        int[] prev = new int[256];
        Arrays.fill(prev, -1);                       // last index where each character was seen
        int start = 0, best = 0;                     // start = left end of the current distinct window
        for (int j = 0; j < s.length(); j++) {
            char ch = s.charAt(j);
            start = Math.max(start, prev[ch] + 1);   // jump past the previous occurrence
            best = Math.max(best, j - start + 1);
            prev[ch] = j;
        }
        return best;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"abcdabc", "aaa", "geeksforgeeks", "abcdefg"})
            System.out.println(s + " → " + longestDistinct(s));
    }
}
```

```javascript filename:JavaScript
function longestDistinct(s) {
    const prev = new Array(256).fill(-1);            // last index where each character was seen
    let start = 0, best = 0;                         // start = left end of the current distinct window
    for (let j = 0; j < s.length; j++) {
        const ch = s.charCodeAt(j);
        start = Math.max(start, prev[ch] + 1);       // jump past the previous occurrence
        best = Math.max(best, j - start + 1);
        prev[ch] = j;
    }
    return best;
}

for (const s of ["abcdabc", "aaa", "geeksforgeeks", "abcdefg"])
    console.log(s, "→", longestDistinct(s));
```

```text filename:Output
abcdabc → 4
aaa → 1
geeksforgeeks → 7
abcdefg → 7
```

Time O(n) · Space O(CHAR)

> [!WARNING] Pitfall
>
> Writing `start = prev[ch] + 1` without the `max` is wrong: a repeat that lies <em>before</em> the current window (`prev[ch] < start`) must not pull `start` backwards. In `"abba"` at `j = 3` the earlier `a` is at 0, but the window already starts at 2.

# Interview Q&amp;A

```question
KMP or Rabin–Karp — when do you pick which?

---

KMP gives a guaranteed `O(n + m)` for one pattern and is the safe default. Rabin–Karp shines when you search for <strong>many patterns of the same length</strong> at once (hash each pattern into a set, then one rolling pass over the text), or for 2-D / plagiarism-style matching where hashes of many windows must be compared. Its worst case is `O(n · m)`, so it is a poor fit for adversarial inputs.
```

```question
What exactly does lps\[i\] mean, and why is it the right amount to fall back?

---

`lps[i]` is the length of the longest <em>proper</em> prefix of `pat[0..i]` that is also a suffix of it. On a mismatch after matching `j` characters, the text we just consumed ends with `pat[0..j−1]`; its longest proper prefix-suffix (`lps[j−1]` characters) is the longest stretch of that text that could still be the <em>beginning</em> of a match. Anything longer is ruled out by maximality, and anything shorter would skip a possible match — so `lps[j−1]` is exactly the safe shift.
```

```question
Why is KMP O(n + m) when it has a loop that does not advance i?

---

Charge each iteration to either `i` or `j`. Iterations that match advance `i` (at most `n` of them). Iterations that fall back strictly decrease `j`, and `j` only grows together with `i`, so there can be at most `n` fall-backs in total. The LPS construction is the same argument over `m`.
```

```question
The Rabin–Karp hash matched but the strings differ — is the algorithm wrong?

---

No, that is a <strong>spurious hit</strong>, expected behaviour of any hash modulo `q`. Correctness comes from the character-by-character verification that runs only when hashes agree; the hash merely filters candidates. Pick a large prime (and 64-bit arithmetic) so spurious hits are rare, which keeps the <em>expected</em> time linear.
```

```question
How would you return the anagram positions instead of Yes/No, and the substring instead of the length?

---

Anagram search: whenever `ct == cp` for the window starting at `i − m`, record `i − m` and continue instead of returning. Longest distinct substring: whenever `j − start + 1` improves `best`, also remember `start`; the answer is `s[start..start+best−1]`. Both keep the same complexity.
```

```question
Lexicographic rank with repeated characters?

---

Permutations with repeats are counted by the multinomial `n! / (c1! · c2! · …)`. At position `i`, for each unused character smaller than `s[i]`, add `(n − i − 1)! / Π(count of each remaining character)!` where that character's count is reduced by one. Same scan, one extra division per step; precompute factorials once.
```
