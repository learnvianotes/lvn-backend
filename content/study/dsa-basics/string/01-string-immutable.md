---
id: 7a27aa6f-9078-78be-8934-981a55d5285e
key: topic:dsa-basics/string
subject: dsa-basics
topic: string
title: String (Immutable)
slug: string-immutable
order: 1
---

A string is a <strong>sequence of characters</strong> — text read from a file, a name, a message. In Python, Java and JavaScript strings are <strong>immutable</strong>: every “change” creates a new string. Most string problems are really array problems in disguise (two pointers, counting with a frequency array), so this topic reuses everything from Lists.

> [!INFO]
>
> <strong>String</strong> — an ordered, indexable sequence of characters. Each character is stored as a number — its character code — so `'A'` is `65`, `'a'` is `97` and `'0'` is `48`; comparisons and “count the letters” tricks rely on these codes.

> [!INFO]
>
> <strong>Immutable</strong> — the object's contents cannot change after creation. `s[0] = 'x'` is an error; `s.upper()` returns a <strong>new</strong> string and leaves `s` untouched. Changing text means building a new string (or using a mutable buffer: a list of characters, `StringBuilder`, an array).

```text filename:Indexing%20a%20string%20works%20exactly%20like%20a%20list%20%E2%80%94%20including%20Python's%20negative%20indices
s   =   g    e    e    k
index   0    1    2    3
-ve    -4   -3   -2   -1
```

# Characters are numbers: ASCII codes

Typically a program deals with a small set of characters. ASCII assigns each one a number from 0 to 127; the ranges below are the ones that matter in DSA, because a frequency array of size 128 or 256 indexed by the code gives `O(1)` counting.

| Characters | Codes | Note |
| --- | --- | --- |
| `'A'` … `'Z'` | 65 … 90 | `ord('A') + 32 == ord('a')` — one bit apart |
| `'a'` … `'z'` | 97 … 122 | letters are contiguous, so `ord(c) - ord('a')` is 0..25 |
| `'0'` … `'9'` | 48 … 57 | `ord(c) - ord('0')` converts a digit character to its value |
| space | 32 | the first printable character |

```python filename:Python
for ch in "aAzZ09":
    print(ch, ord(ch))               # ord: character → code
print("space", ord(" "))
for code in (97, 65, 48):
    print(code, chr(code))           # chr: code → character
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

int main() {
    for (char ch : string("aAzZ09"))
        cout << ch << " " << (int)ch << "\n";       // a char IS a small integer; cast to print it
    cout << "space " << (int)' ' << "\n";
    for (int code : {97, 65, 48})
        cout << code << " " << (char)code << "\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        for (char ch : "aAzZ09".toCharArray())
            System.out.println(ch + " " + (int) ch);     // cast char → int
        System.out.println("space " + (int) ' ');
        for (int code : new int[]{97, 65, 48})
            System.out.println(code + " " + (char) code);
    }
}
```

```javascript filename:JavaScript
for (const ch of "aAzZ09")
    console.log(ch, ch.charCodeAt(0));          // code of the character at index 0
console.log("space", " ".charCodeAt(0));
for (const code of [97, 65, 48])
    console.log(code, String.fromCharCode(code));
```

```text filename:Output
a 97
A 65
z 122
Z 90
0 48
9 57
space 32
97 a
65 A
48 0
```

> [!NOTE] Key point
>
> Python 3 strings are Unicode: `ord('€')` is `8364`, so a 256-slot count array only works when the input is guaranteed ASCII. Say so in an interview, or use a dictionary / hash map instead.

# What “immutable” means in each language

| Language | Type | Mutable? | `s[0] = 'G'` | Efficient way to build / edit text |
| --- | --- | --- | --- | --- |
| Python | `str` | no | `TypeError` | `list(s)` → edit → `''.join(…)`; `''.join(parts)` instead of `+=` in a loop |
| Java | `String` | no | compile error (no indexer) | `StringBuilder` (`append`, `setCharAt`, `reverse`), or `char[]` via `toCharArray()` |
| JavaScript | `string` | no | silently ignored (throws in strict mode) | `s.split('')` → edit → `join('')`; collect parts in an array and `join` |
| C++ | `std::string` | <strong>yes</strong> | works — `s[0] = 'G'` | edit in place; `+=` and `push_back` are amortised `O(1)` |

Immutability is what makes strings safe to share, usable as dictionary keys (their hash can never change) and cheap to compare by identity in interned pools. The price: every modification allocates a new string, so <strong>repeated concatenation in a loop is </strong><strong>`O(n²)`</strong> in principle — collect pieces and join them once.

```python filename:Python
s = 'geek'
s[0] = 'G'                 # strings cannot be changed in place
```

```text filename:Output
TypeError: 'str' object does not support item assignment
```

Changing one character the right way in each language — note that C++ edits a <em>copy</em> only because we chose to keep the original:

```python filename:Python
s = "geek"
t = "G" + s[1:]                 # build a new string; s is untouched
print("new:", t)
print("original:", s)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s = "geek";
    string t = s;               // copy …
    t[0] = 'G';                 // … then mutate in place: std::string is mutable
    cout << "new: " << t << "\n";
    cout << "original: " << s << "\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String s = "geek";
        char[] chars = s.toCharArray();   // mutable copy of the characters
        chars[0] = 'G';
        String t = new String(chars);     // or: "G" + s.substring(1)
        System.out.println("new: " + t);
        System.out.println("original: " + s);
    }
}
```

```javascript filename:JavaScript
const s = "geek";
const t = "G" + s.slice(1);     // build a new string; s is untouched
console.log("new:", t);
console.log("original:", s);
```

```text filename:Output
new: Geek
original: geek
```

# Creating strings

Single and double quotes are interchangeable in Python; triple quotes allow line breaks inside the literal. Indexing works like a list and `type()` confirms the class.

```python filename:Python
s = 'geek'
print(s)              # geek
print(type(s))        # <class 'str'>
print(s[0], s[3])     # g k
print(s[-1], s[-4])   # k g
print(len(s))         # 4

s = """welcome
to my world"""        # triple quotes keep the newline
print(s.splitlines())  # ['welcome', 'to my world']
```

# Escape sequences

A backslash inside a literal gives the next character a special meaning. It is how you put a quote inside a quoted string, a newline inside a one-line literal, or a literal backslash.

| Escape | Meaning |
| --- | --- |
| `\'` , `\"` | a quote that does not end the string |
| `\n` | newline |
| `\t` | tab |
| `\\` | one literal backslash |
| `\uXXXX` | Unicode character by code (Python, Java, JavaScript) |

Without escaping, a quote inside the string ends it early — the rest is a syntax error:

```python filename:Python
s = 'Welcome to my worl'd'      # the second ' closes the literal; d' is garbage
print(s)
```

```text filename:Output
SyntaxError: unterminated string literal
```

```python filename:Python
print('Welcome to my worl\'d')      # escape the quote …
print("Welcome to my worl'd")       # … or just use the other quote style
print("Hi,\nI'm fine")
print('A simple example \\')
print('A simple \t example')
```

```text filename:Output
Welcome to my worl'd
Welcome to my worl'd
Hi,
I'm fine
A simple example \
A simple 	 example
```

> [!WARNING] Pitfall
>
> A backslash before a letter that is <strong>not</strong> an escape (`'A simple \example'`) is kept literally, but Python emits a `SyntaxWarning: invalid escape sequence` — and future versions may make it an error. Write `\\` or use a raw string.

# Raw strings

Prefixing a literal with `r` (or `R`) turns escape processing off — backslashes are kept as typed. Essential for Windows paths and regular expressions, where `\n`, `\t` or `\d` would otherwise be mangled.

```python filename:Python
s1 = 'c:\new\table.py'         # \n and \t are escapes!
print(repr(s1))                # 'c:\new\table.py'  ← repr shows the escapes; print() would show a line break and a tab
print(s1.count("\n"), s1.count("\t"))   # 1 1
s2 = r'c:\new\table.py'        # raw: backslashes are kept
print(s2)                      # c:\new\table.py
print(len(s1), len(s2))        # 13 15
```

> [!NOTE] Key point
>
> A raw string still cannot end in a single backslash (`r'c:\'` is a syntax error) because the quote would be escaped. Use `'c:\\'` or `r'c:\' + '\\'` for that case. Java and JavaScript have no raw strings; use `\\` (or JavaScript's `String.raw` tag).

# Formatted strings

Three generations of Python formatting do the same job; <strong>f-strings</strong> (3.6+) are the modern choice — any expression goes inside the braces, with optional format specs such as `:.2f` or `:>10`.

```python filename:Python
name = 'ABC'
course = 'Python Course'
print('Welcome %s to %s' % (name, course))            # Welcome ABC to Python Course  ← C-style %
print('Welcome {} to {}'.format(name, course))        # Welcome ABC to Python Course  ← str.format
print(f'Welcome {name} to {course}')                  # Welcome ABC to Python Course  ← f-string
```

```python filename:Python
a, b = 10, 20
print(f'Sum of {a} and {b} is {a + b}')      # any expression inside the braces

x, y = 'ABC', 'abc'
print(f"lower case of {x} is {x.lower()}")
print(f"upper case of {y} is {y.upper()}")
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <cctype>
#include <iostream>
#include <string>
using namespace std;

int main() {
    int a = 10, b = 20;
    cout << "Sum of " << a << " and " << b << " is " << a + b << "\n";   // or printf("%d", …)

    string x = "ABC", y = "abc";
    string lower = x, upper = y;
    transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    transform(upper.begin(), upper.end(), upper.begin(), ::toupper);
    cout << "lower case of " << x << " is " << lower << "\n";
    cout << "upper case of " << y << " is " << upper << "\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int a = 10, b = 20;
        System.out.println(String.format("Sum of %d and %d is %d", a, b, a + b));   // printf-style

        String x = "ABC", y = "abc";
        System.out.println("lower case of " + x + " is " + x.toLowerCase());
        System.out.println("upper case of " + y + " is " + y.toUpperCase());
    }
}
```

```javascript filename:JavaScript
const a = 10, b = 20;
console.log(`Sum of ${a} and ${b} is ${a + b}`);     // template literal: backticks + ${…}

const x = "ABC", y = "abc";
console.log(`lower case of ${x} is ${x.toLowerCase()}`);
console.log(`upper case of ${y} is ${y.toUpperCase()}`);
```

```text filename:Output
Sum of 10 and 20 is 30
lower case of ABC is abc
upper case of abc is ABC
```

# String comparison

`==` compares <strong>contents</strong> character by character. `<` and `>` compare <strong>lexicographically</strong>: the first differing character decides, using character codes — so every uppercase letter sorts before every lowercase one, and a prefix sorts before the longer string.

```python filename:Python
s1, s2 = 'gfg', 'ide'
b = lambda v: "true" if v else "false"
print("gfg == ide:", b(s1 == s2))
print("gfg != ide:", b(s1 != s2))
print("gfg > ide:", b(s1 > s2))            # 'g' (103) < 'i' (105) → gfg is smaller
print("gfg < ide:", b(s1 < s2))
print("gfg <= ide:", b(s1 <= s2))
print("apple < banana:", b("apple" < "banana"))
print("Zebra < apple:", b("Zebra" < "apple"))    # 'Z' (90) < 'a' (97): uppercase first
print("ab < abc:", b("ab" < "abc"))              # a prefix is smaller
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const char* b(bool v) { return v ? "true" : "false"; }

int main() {
    string s1 = "gfg", s2 = "ide";              // std::string overloads ==, <, > …
    cout << "gfg == ide: " << b(s1 == s2) << "\n";
    cout << "gfg != ide: " << b(s1 != s2) << "\n";
    cout << "gfg > ide: " << b(s1 > s2) << "\n";
    cout << "gfg < ide: " << b(s1 < s2) << "\n";
    cout << "gfg <= ide: " << b(s1 <= s2) << "\n";
    cout << "apple < banana: " << b(string("apple") < "banana") << "\n";
    cout << "Zebra < apple: " << b(string("Zebra") < "apple") << "\n";
    cout << "ab < abc: " << b(string("ab") < "abc") << "\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String s1 = "gfg", s2 = "ide";
        System.out.println("gfg == ide: " + s1.equals(s2));          // NOT s1 == s2 (reference check)
        System.out.println("gfg != ide: " + !s1.equals(s2));
        System.out.println("gfg > ide: " + (s1.compareTo(s2) > 0));  // compareTo: <0, 0, >0
        System.out.println("gfg < ide: " + (s1.compareTo(s2) < 0));
        System.out.println("gfg <= ide: " + (s1.compareTo(s2) <= 0));
        System.out.println("apple < banana: " + ("apple".compareTo("banana") < 0));
        System.out.println("Zebra < apple: " + ("Zebra".compareTo("apple") < 0));
        System.out.println("ab < abc: " + ("ab".compareTo("abc") < 0));
    }
}
```

```javascript filename:JavaScript
const s1 = "gfg", s2 = "ide";
console.log("gfg == ide:", s1 === s2);          // === compares contents for strings
console.log("gfg != ide:", s1 !== s2);
console.log("gfg > ide:", s1 > s2);
console.log("gfg < ide:", s1 < s2);
console.log("gfg <= ide:", s1 <= s2);
console.log("apple < banana:", "apple" < "banana");
console.log("Zebra < apple:", "Zebra" < "apple");    // 'Z' (90) < 'a' (97): uppercase first
console.log("ab < abc:", "ab" < "abc");              // a prefix is smaller
```

```text filename:Output
gfg == ide: false
gfg != ide: true
gfg > ide: false
gfg < ide: true
gfg <= ide: true
apple < banana: true
Zebra < apple: true
ab < abc: true
```

> [!WARNING] Pitfall
>
> In Java `s1 == s2` asks whether both variables point to the <strong>same object</strong>. It happens to be `true` for two identical literals (they are interned) and `false` for strings built at runtime — always use `equals()`. For case-insensitive comparison use `s.lower()` / `equalsIgnoreCase` / `toLowerCase()`.

# String operations

A substring is a contiguous piece: the substrings of `'ABCD'` include `'A'`, `'AB'`, `'BCD'`, `'ABCD'` — but not `'AC'` (that is a <em>subsequence</em>). `in` tests for a substring, `+` concatenates, `index`/`find` locate one.

```python filename:Python
s1 = 'geeksforgeeks'
s2 = 'geeks'
print(s2 in s1)          # True
print(s2 not in s1)      # False
print(s1 in s2)          # False  ← the longer string cannot be inside the shorter one

print('geeks' + 'for' + 'geeks')             # geeksforgeeks  ← concatenation makes a new string
print('geeks' + ' ' + 'for' + ' ' + 'geeks')  # geeks for geeks

print(s1.index(s2))      # 0   ← first occurrence
print(s1.rindex(s2))     # 8   ← last occurrence
print(s1.index(s2, 1))   # 8   ← first occurrence at or after index 1
print(s1.find('xyz'))    # -1  ← find returns -1; index would raise ValueError
```

The everyday toolbox, all of which return <strong>new</strong> strings or plain values:

```python filename:Python
s1 = 'Thrishank is a name'
s2 = 'Kav'
print(len(s1))                           # 19
print(s1.upper())                        # THRISHANK IS A NAME
print(s1.lower())                        # thrishank is a name
print(s1.isupper())                      # False
print(s1.islower())                      # False
print(s1.startswith('Th'))               # True
print(s1.startswith('th'))               # False  ← case-sensitive
print(s1.endswith('nk'))                 # False  ← it ends with 'name'
print(s1.startswith(" ", 1))             # False  ← does s1[1:] start with a space? no, with 'h'
print(s1.endswith('a', 5, len(s1)))      # False  ← s1[5:19] ends with 'e'
print(s1.split(' '))                     # ['Thrishank', 'is', 'a', 'name']
print(s1.split('n'))                     # ['Thrisha', 'k is a ', 'ame']
print(s1.split('r', 1))                  # ['Th', 'ishank is a name']  ← at most 1 split
print(''.join(s1))                       # Thrishank is a name
print(' '.join(s1))                      # T h r i s h a n k   i s   a   n a m e
print(s1.strip(" "))                     # Thrishank is a name  ← nothing to strip here
print(s1.lstrip(" "))                    # Thrishank is a name
print(s1.rstrip(" "))                    # Thrishank is a name
print(s1.replace('Thrishank', 'Kavya'))  # Kavya is a name
print(s1.replace('h', 'H'))              # THrisHank is a name  ← every occurrence
print(s1.find(s2))                       # -1
print(s1.find(s2, 0, 13))                # -1
print(s1.find('sha'))                    # 4
```

| Task | Python | C++ `std::string` | Java `String` | JavaScript |
| --- | --- | --- | --- | --- |
| Length | `len(s)` | `s.size()` | `s.length()` | `s.length` |
| Character at `i` | `s[i]` | `s[i]` | `s.charAt(i)` | `s[i]` |
| Substring | `s[a:b]` | `s.substr(a, b - a)` | `s.substring(a, b)` | `s.slice(a, b)` |
| Contains | `t in s` | `s.find(t) != npos` | `s.contains(t)` | `s.includes(t)` |
| Find index | `s.find(t)` (−1) | `s.find(t)` (`npos`) | `s.indexOf(t)` (−1) | `s.indexOf(t)` (−1) |
| Upper / lower | `s.upper()` | `transform(…, ::toupper)` | `s.toUpperCase()` | `s.toUpperCase()` |
| Starts / ends with | `s.startswith(t)` | `s.starts_with(t)` (C++20) | `s.startsWith(t)` | `s.startsWith(t)` |
| Split on spaces | `s.split()` | `istringstream >> word` | `s.split(" ")` | `s.split(" ")` |
| Join | `" ".join(parts)` | loop with `+=` | `String.join(" ", parts)` | `parts.join(" ")` |
| Trim whitespace | `s.strip()` | manual | `s.strip()` / `s.trim()` | `s.trim()` |
| Replace all | `s.replace(a, b)` | loop with `find` | `s.replace(a, b)` | `s.replaceAll(a, b)` |
| Compare | `==`, `<` | `==`, `<` | `equals`, `compareTo` | `===`, `<` |

# Problem: reverse a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "Nani"`<br><strong>Output:</strong> `inaN`<br><strong>Input:</strong> `s = "hello"`<br><strong>Output:</strong> `olleh`

The naive loop builds the answer by prepending each character — `rev = ch + rev`. Because strings are immutable, every step copies the whole partial result, so it is `O(n²)`:

```python filename:Python
s = "Nani"
rev = ""
for ch in s:
    rev = ch + rev           # new string of length k at step k → O(n²) total
print(rev)

print(s[::-1])               # the Pythonic way: slice with step -1 → O(n)
```

```text filename:Output
inaN
inaN
```

> [!NOTE] Idea
>
> Turn the string into a mutable sequence of characters, swap from both ends with two pointers (exactly as for a list) and join back. Where the string is already mutable (C++) swap in place.

```python filename:Python
def reverse(s):
    chars = list(s)                    # mutable copy
    i, j = 0, len(chars) - 1
    while i < j:
        chars[i], chars[j] = chars[j], chars[i]
        i += 1
        j -= 1
    return "".join(chars)              # back to an (immutable) string

for s in ("Nani", "hello"):
    print("reversed:", reverse(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>
using namespace std;

string reverseStr(string s) {         // taken by value → we may edit the copy in place
    int i = 0, j = s.size() - 1;
    while (i < j) {
        swap(s[i], s[j]);
        i++;
        j--;
    }
    return s;                          // library: reverse(s.begin(), s.end())
}

int main() {
    for (string s : {"Nani", "hello"})
        cout << "reversed: " << reverseStr(s) << "\n";
}
```

```java filename:Java
public class Main {
    static String reverse(String s) {
        char[] c = s.toCharArray();                  // mutable copy
        int i = 0, j = c.length - 1;
        while (i < j) {
            char tmp = c[i]; c[i] = c[j]; c[j] = tmp;
            i++;
            j--;
        }
        return new String(c);                        // library: new StringBuilder(s).reverse()
    }

    public static void main(String[] args) {
        for (String s : new String[]{"Nani", "hello"})
            System.out.println("reversed: " + reverse(s));
    }
}
```

```javascript filename:JavaScript
function reverse(s) {
    const c = s.split("");                        // mutable copy
    let i = 0, j = c.length - 1;
    while (i < j) {
        [c[i], c[j]] = [c[j], c[i]];
        i++;
        j--;
    }
    return c.join("");                            // library: s.split("").reverse().join("")
}

for (const s of ["Nani", "hello"])
    console.log("reversed:", reverse(s));
```

```text filename:Output
reversed: inaN
reversed: olleh
```

Time O(n) · Space O(n) for the character copy (O(1) in C++)

# Problem: check if two strings are rotations

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "ABCD", s2 = "CDAB"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s1 = "ABCD", s2 = "ABCA"`<br><strong>Output:</strong> `No`

`ABCD → BCDA → CDAB`: rotating left twice turns `ABCD` into `CDAB`. Trying every rotation and comparing is `O(n²)`.

> [!NOTE] Idea
>
> Concatenate `s1` with itself: `ABCDABCD` contains <strong>every</strong> rotation of `ABCD` as a substring (`BCDA`, `CDAB`, `DABC`). So `s2` is a rotation exactly when the lengths match and `s2` occurs inside `s1 + s1`.

```text filename:Every%20rotation%20of%20s1%20is%20a%20window%20of%20length%20n%20inside%20s1%20%2B%20s1
s1 + s1 = A B C D A B C D
              └─────┘        CDAB  (rotation by 2)
            └─────┘          BCDA  (rotation by 1)
                  └─────┘    DABC  (rotation by 3)
```

```python filename:Python
def are_rotations(s1, s2):
    if len(s1) != len(s2):
        return False
    return s2 in s1 + s1             # substring search

for s1, s2 in (("ABCD", "CDAB"), ("ABCD", "ABCA"), ("ABCD", "ABC")):
    print(f"{s1}, {s2}:", "Yes" if are_rotations(s1, s2) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

bool areRotations(const string& s1, const string& s2) {
    if (s1.size() != s2.size()) return false;
    return (s1 + s1).find(s2) != string::npos;     // substring search
}

int main() {
    pair<string, string> tests[] = {{"ABCD", "CDAB"}, {"ABCD", "ABCA"}, {"ABCD", "ABC"}};
    for (auto& t : tests)
        cout << t.first << ", " << t.second << ": " << (areRotations(t.first, t.second) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean areRotations(String s1, String s2) {
        if (s1.length() != s2.length()) return false;
        return (s1 + s1).contains(s2);             // substring search
    }

    public static void main(String[] args) {
        String[][] tests = {{"ABCD", "CDAB"}, {"ABCD", "ABCA"}, {"ABCD", "ABC"}};
        for (String[] t : tests)
            System.out.println(t[0] + ", " + t[1] + ": " + (areRotations(t[0], t[1]) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function areRotations(s1, s2) {
    if (s1.length !== s2.length) return false;
    return (s1 + s1).includes(s2);                 // substring search
}

for (const [s1, s2] of [["ABCD", "CDAB"], ["ABCD", "ABCA"], ["ABCD", "ABC"]])
    console.log(`${s1}, ${s2}:`, areRotations(s1, s2) ? "Yes" : "No");
```

```text filename:Output
ABCD, CDAB: Yes
ABCD, ABCA: No
ABCD, ABC: No
```

Time O(n) with a linear-time substring search (KMP); naive `find` is O(n²) worst case · Space O(n)

> [!WARNING] Pitfall
>
> Forgetting the length check: `"AB"` is a substring of `"ABCDABCD"` but not a rotation of `"ABCD"`.

# Problem: check for palindrome

> [!TIP] Example
>
> <strong>Input:</strong> `s = "abba"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s = "abA"`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `s = "10022001"`<br><strong>Output:</strong> `Yes`

A palindrome reads the same backwards. The check is case-sensitive unless stated otherwise (`abA` is not one). Fun fact from the notes: the date `10-02-2001` without separators, `10022001`, is a palindrome.

> [!NOTE] Idea
>
> Two pointers again: compare `s[low]` with `s[high]`, move them towards each other, and stop with `No` at the first mismatch. If they cross without a mismatch the string is a palindrome. No copy of the string is needed.

```python filename:Python
def is_palindrome(s):
    low, high = 0, len(s) - 1
    while low < high:
        if s[low] != s[high]:
            return False
        low += 1
        high -= 1
    return True                     # one-liner: s == s[::-1] (but that copies the string)

for s in ("abba", "abA", "10022001", "racecar"):
    print(f"{s}:", "Yes" if is_palindrome(s) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

bool isPalindrome(const string& s) {
    int low = 0, high = s.size() - 1;
    while (low < high) {
        if (s[low] != s[high]) return false;
        low++;
        high--;
    }
    return true;
}

int main() {
    for (string s : {"abba", "abA", "10022001", "racecar"})
        cout << s << ": " << (isPalindrome(s) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isPalindrome(String s) {
        int low = 0, high = s.length() - 1;
        while (low < high) {
            if (s.charAt(low) != s.charAt(high)) return false;
            low++;
            high--;
        }
        return true;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"abba", "abA", "10022001", "racecar"})
            System.out.println(s + ": " + (isPalindrome(s) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isPalindrome(s) {
    let low = 0, high = s.length - 1;
    while (low < high) {
        if (s[low] !== s[high]) return false;
        low++;
        high--;
    }
    return true;
}

for (const s of ["abba", "abA", "10022001", "racecar"])
    console.log(`${s}:`, isPalindrome(s) ? "Yes" : "No");
```

```text filename:Output
abba: Yes
abA: No
10022001: Yes
racecar: Yes
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> Python's `while … else` from the original notes runs the `else` branch only when the loop finished without `break` — the same effect as returning `True` after the loop. The interview follow-up is usually “ignore case and non-letters” (`"A man, a plan…"`): skip characters that are not alphanumeric and compare lower-cased.

# Problem: check if a string is a subsequence

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "ABCD", s2 = "AD"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s1 = "ABCDE", s2 = "AED"`<br><strong>Output:</strong> `No`

> [!INFO]
>
> <strong>Subsequence</strong> — the characters of `s2` appear in `s1` in the <strong>same order</strong>, not necessarily adjacent. `AD` is a subsequence of `ABCD`; `AED` is not, because `E` comes after `D` in `ABCDE`.

> [!NOTE] Idea
>
> Greedy two pointers: walk through `s1` once; whenever the current character matches `s2[j]`, advance `j`. If `j` reaches the end of `s2`, every character was found in order. Matching the <em>earliest</em> possible occurrence is always safe — it leaves the most room for the rest.

```python filename:Python
def is_subsequence(s1, s2):
    i = j = 0
    while i < len(s1) and j < len(s2):
        if s1[i] == s2[j]:
            j += 1                       # matched s2[j], look for the next one
        i += 1
    return j == len(s2)

for s1, s2 in (("ABCD", "AD"), ("ABCDE", "AED"), ("ABCDE", "ACE")):
    print(f"{s2} in {s1}:", "Yes" if is_subsequence(s1, s2) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

bool isSubsequence(const string& s1, const string& s2) {
    int i = 0, j = 0, n = s1.size(), m = s2.size();
    while (i < n && j < m) {
        if (s1[i] == s2[j]) j++;         // matched s2[j], look for the next one
        i++;
    }
    return j == m;
}

int main() {
    pair<string, string> tests[] = {{"ABCD", "AD"}, {"ABCDE", "AED"}, {"ABCDE", "ACE"}};
    for (auto& t : tests)
        cout << t.second << " in " << t.first << ": " << (isSubsequence(t.first, t.second) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean isSubsequence(String s1, String s2) {
        int i = 0, j = 0;
        while (i < s1.length() && j < s2.length()) {
            if (s1.charAt(i) == s2.charAt(j)) j++;   // matched s2[j], look for the next one
            i++;
        }
        return j == s2.length();
    }

    public static void main(String[] args) {
        String[][] tests = {{"ABCD", "AD"}, {"ABCDE", "AED"}, {"ABCDE", "ACE"}};
        for (String[] t : tests)
            System.out.println(t[1] + " in " + t[0] + ": " + (isSubsequence(t[0], t[1]) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function isSubsequence(s1, s2) {
    let i = 0, j = 0;
    while (i < s1.length && j < s2.length) {
        if (s1[i] === s2[j]) j++;        // matched s2[j], look for the next one
        i++;
    }
    return j === s2.length;
}

for (const [s1, s2] of [["ABCD", "AD"], ["ABCDE", "AED"], ["ABCDE", "ACE"]])
    console.log(`${s2} in ${s1}:`, isSubsequence(s1, s2) ? "Yes" : "No");
```

```text filename:Output
AD in ABCD: Yes
AED in ABCDE: No
ACE in ABCDE: Yes
```

Time O(n + m) · Space O(1)

The same idea written recursively, from the back: if the last characters match, drop both; otherwise drop only the last character of `s1`. It is `O(n + m)` time but uses `O(n)` stack — the iterative version is preferred.

```python filename:Python
def is_subsequence(s1, s2, m, n):      # m, n = lengths still to consider
    if n == 0:
        return True                   # all of s2 matched
    if m == 0:
        return False                  # s1 exhausted first
    if s1[m - 1] == s2[n - 1]:
        return is_subsequence(s1, s2, m - 1, n - 1)
    return is_subsequence(s1, s2, m - 1, n)

print("Yes" if is_subsequence("ABCD", "AD", 4, 2) else "No")
print("Yes" if is_subsequence("ABCDE", "AED", 5, 3) else "No")
```

```text filename:Output
Yes
No
```

# Problem: check for anagram

> [!TIP] Example
>
> <strong>Input:</strong> `s1 = "listen", s2 = "silent"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s1 = "aabc", s2 = "acab"`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `s1 = "aabd", s2 = "acab"`<br><strong>Output:</strong> `No`

> [!INFO]
>
> <strong>Anagram</strong> — two strings with the <strong>same length</strong>, the <strong>same characters</strong> and the <strong>same count</strong> of each — one is a rearrangement of the other.

Naive: sort both strings and compare — `O(n log n)`:

```python filename:Python
def are_anagrams_sorted(s1, s2):
    return len(s1) == len(s2) and sorted(s1) == sorted(s2)

print("Yes" if are_anagrams_sorted("listen", "silent") else "No")
print("Yes" if are_anagrams_sorted("aabd", "acab") else "No")
```

```text filename:Output
Yes
No
```

> [!NOTE] Idea
>
> Count characters with a frequency array indexed by character code: `+1` for each character of `s1`, `-1` for each of `s2`. The strings are anagrams exactly when every count ends at zero. One pass over the strings plus a fixed 256-slot scan → `O(n)`.

```python filename:Python
CHAR = 256

def are_anagrams(s1, s2):
    if len(s1) != len(s2):
        return False
    count = [0] * CHAR
    for i in range(len(s1)):
        count[ord(s1[i])] += 1          # s1 adds …
        count[ord(s2[i])] -= 1          # … s2 cancels
    return all(c == 0 for c in count)

for s1, s2 in (("listen", "silent"), ("aabc", "acab"), ("aabd", "acab")):
    print(f"{s1}, {s2}:", "Yes" if are_anagrams(s1, s2) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const int CHAR = 256;

bool areAnagrams(const string& s1, const string& s2) {
    if (s1.size() != s2.size()) return false;
    int count[CHAR] = {0};
    for (int i = 0; i < (int)s1.size(); i++) {
        count[(unsigned char)s1[i]]++;        // s1 adds …
        count[(unsigned char)s2[i]]--;        // … s2 cancels
    }
    for (int c : count)
        if (c != 0) return false;
    return true;
}

int main() {
    pair<string, string> tests[] = {{"listen", "silent"}, {"aabc", "acab"}, {"aabd", "acab"}};
    for (auto& t : tests)
        cout << t.first << ", " << t.second << ": " << (areAnagrams(t.first, t.second) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static final int CHAR = 256;

    static boolean areAnagrams(String s1, String s2) {
        if (s1.length() != s2.length()) return false;
        int[] count = new int[CHAR];
        for (int i = 0; i < s1.length(); i++) {
            count[s1.charAt(i)]++;              // s1 adds …
            count[s2.charAt(i)]--;              // … s2 cancels
        }
        for (int c : count)
            if (c != 0) return false;
        return true;
    }

    public static void main(String[] args) {
        String[][] tests = {{"listen", "silent"}, {"aabc", "acab"}, {"aabd", "acab"}};
        for (String[] t : tests)
            System.out.println(t[0] + ", " + t[1] + ": " + (areAnagrams(t[0], t[1]) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function areAnagrams(s1, s2) {
    if (s1.length !== s2.length) return false;
    const count = new Array(CHAR).fill(0);
    for (let i = 0; i < s1.length; i++) {
        count[s1.charCodeAt(i)]++;              // s1 adds …
        count[s2.charCodeAt(i)]--;              // … s2 cancels
    }
    return count.every(c => c === 0);
}

for (const [s1, s2] of [["listen", "silent"], ["aabc", "acab"], ["aabd", "acab"]])
    console.log(`${s1}, ${s2}:`, areAnagrams(s1, s2) ? "Yes" : "No");
```

```text filename:Output
listen, silent: Yes
aabc, acab: Yes
aabd, acab: No
```

Time O(n + CHAR) · Space O(CHAR) = O(1)

> [!NOTE] Key point
>
> The original notes' second test used `aabd` vs `acab` (not anagrams) while the example said `aabc` vs `acab` (anagrams) — both are included above. For Unicode input swap the 256-array for a dictionary / `HashMap` of counts.

# Problem: leftmost repeating character

> [!TIP] Example
>
> <strong>Input:</strong> `s = "geeksforgeeks"`<br><strong>Output:</strong> `0`<br><strong>Input:</strong> `s = "abbcc"`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `s = "abcd"`<br><strong>Output:</strong> `-1`

Return the index of the first character that appears <strong>again later</strong>. In `geeksforgeeks` the `g` at index 0 reappears at index 8, so the answer is `0` (not `1`, even though `e` repeats sooner). Naive: for each `i`, scan the rest for an equal character — `O(n²)`:

```python filename:Python
def leftmost_repeating_naive(s):
    for i in range(len(s)):
        for j in range(i + 1, len(s)):
            if s[i] == s[j]:
                return i
    return -1

print(leftmost_repeating_naive("geeksforgeeks"))
print(leftmost_repeating_naive("abcd"))
```

```text filename:Output
0
-1
```

> [!NOTE] Idea
>
> <strong>Two passes, </strong><strong>`O(n)`</strong><strong>:</strong> count every character first, then walk from the left and return the first index whose character has count `> 1`.

```python filename:Python
CHAR = 256

def leftmost_repeating(s):
    count = [0] * CHAR
    for ch in s:
        count[ord(ch)] += 1
    for i, ch in enumerate(s):               # left to right: first one seen more than once
        if count[ord(ch)] > 1:
            return i
    return -1

for s in ("geeksforgeeks", "abbcc", "abcd", "Thrishank"):
    print(f"{s}:", leftmost_repeating(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const int CHAR = 256;

int leftmostRepeating(const string& s) {
    int count[CHAR] = {0};
    for (char ch : s) count[(unsigned char)ch]++;
    for (int i = 0; i < (int)s.size(); i++)          // left to right: first one seen more than once
        if (count[(unsigned char)s[i]] > 1) return i;
    return -1;
}

int main() {
    for (string s : {"geeksforgeeks", "abbcc", "abcd", "Thrishank"})
        cout << s << ": " << leftmostRepeating(s) << "\n";
}
```

```java filename:Java
public class Main {
    static final int CHAR = 256;

    static int leftmostRepeating(String s) {
        int[] count = new int[CHAR];
        for (int i = 0; i < s.length(); i++) count[s.charAt(i)]++;
        for (int i = 0; i < s.length(); i++)          // left to right: first one seen more than once
            if (count[s.charAt(i)] > 1) return i;
        return -1;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"geeksforgeeks", "abbcc", "abcd", "Thrishank"})
            System.out.println(s + ": " + leftmostRepeating(s));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function leftmostRepeating(s) {
    const count = new Array(CHAR).fill(0);
    for (const ch of s) count[ch.charCodeAt(0)]++;
    for (let i = 0; i < s.length; i++)            // left to right: first one seen more than once
        if (count[s.charCodeAt(i)] > 1) return i;
    return -1;
}

for (const s of ["geeksforgeeks", "abbcc", "abcd", "Thrishank"])
    console.log(`${s}:`, leftmostRepeating(s));
```

```text filename:Output
geeksforgeeks: 0
abbcc: 1
abcd: -1
Thrishank: 1
```

Time O(n + CHAR) · Space O(CHAR)

<strong>One pass, storing first indices.</strong> Remember where each character was first seen; on a later sighting, the first index is a candidate answer — keep the smallest. (The original returned `sys.maxsize` when nothing repeats; it should be `-1`.)

```python filename:Python
CHAR = 256

def leftmost_repeating(s):
    first_index = [-1] * CHAR
    res = -1
    for i, ch in enumerate(s):
        c = ord(ch)
        if first_index[c] == -1:
            first_index[c] = i                     # first sighting
        elif res == -1 or first_index[c] < res:
            res = first_index[c]                   # repeated: its FIRST index is a candidate
    return res

print(leftmost_repeating("geeksforgeeks"))
print(leftmost_repeating("Thrishank"))
print(leftmost_repeating("abcd"))
```

```text filename:Output
0
1
-1
```

> [!NOTE] Idea
>
> <strong>One pass from the right, the neatest version.</strong> Scan right to left with a `visited` array. When you meet a character you have already seen (further right), it repeats — record this index. Because the scan moves left, the last recorded index is the leftmost one.

```python filename:Python
CHAR = 256

def leftmost_repeating(s):
    visited = [False] * CHAR
    res = -1
    for i in range(len(s) - 1, -1, -1):        # right to left
        c = ord(s[i])
        if visited[c]:
            res = i                            # seen further right → repeats; keep overwriting
        else:
            visited[c] = True
    return res

for s in ("geeksforgeeks", "abbcc", "abcd", "Thrishank"):
    print(f"{s}:", leftmost_repeating(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const int CHAR = 256;

int leftmostRepeating(const string& s) {
    bool visited[CHAR] = {false};
    int res = -1;
    for (int i = (int)s.size() - 1; i >= 0; i--) {    // right to left
        unsigned char c = s[i];
        if (visited[c]) res = i;                       // seen further right → repeats
        else visited[c] = true;
    }
    return res;
}

int main() {
    for (string s : {"geeksforgeeks", "abbcc", "abcd", "Thrishank"})
        cout << s << ": " << leftmostRepeating(s) << "\n";
}
```

```java filename:Java
public class Main {
    static final int CHAR = 256;

    static int leftmostRepeating(String s) {
        boolean[] visited = new boolean[CHAR];
        int res = -1;
        for (int i = s.length() - 1; i >= 0; i--) {    // right to left
            char c = s.charAt(i);
            if (visited[c]) res = i;                   // seen further right → repeats
            else visited[c] = true;
        }
        return res;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"geeksforgeeks", "abbcc", "abcd", "Thrishank"})
            System.out.println(s + ": " + leftmostRepeating(s));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function leftmostRepeating(s) {
    const visited = new Array(CHAR).fill(false);
    let res = -1;
    for (let i = s.length - 1; i >= 0; i--) {     // right to left
        const c = s.charCodeAt(i);
        if (visited[c]) res = i;                   // seen further right → repeats
        else visited[c] = true;
    }
    return res;
}

for (const s of ["geeksforgeeks", "abbcc", "abcd", "Thrishank"])
    console.log(`${s}:`, leftmostRepeating(s));
```

```text filename:Output
geeksforgeeks: 0
abbcc: 1
abcd: -1
Thrishank: 1
```

Time O(n) · Space O(CHAR)

# Problem: leftmost non-repeating character

> [!TIP] Example
>
> <strong>Input:</strong> `s = "geeksforgeeks"`<br><strong>Output:</strong> `5`<br><strong>Input:</strong> `s = "abcabc"`<br><strong>Output:</strong> `-1`

Return the index of the first character that occurs <strong>exactly once</strong>. In `geeksforgeeks` that is `f` at index 5. The naive nested loop is `O(n²)` — and the version in the original notes had its `return -1` indented inside the outer loop, so it gave up after checking only `s[0]`. Fixed:

```python filename:Python
def non_repeating_naive(s):
    for i in range(len(s)):
        repeated = False
        for j in range(len(s)):
            if i != j and s[i] == s[j]:
                repeated = True
                break
        if not repeated:
            return i
    return -1                     # must be OUTSIDE the outer loop

print(non_repeating_naive("geeksforgeeks"))
print(non_repeating_naive("aaa"))
```

```text filename:Output
5
-1
```

> [!NOTE] Idea
>
> Same frequency array as before: count everything, then return the first index whose character has count exactly `1`. Two passes over the string, `O(n)`.

```python filename:Python
CHAR = 256

def leftmost_non_repeating(s):
    count = [0] * CHAR
    for ch in s:
        count[ord(ch)] += 1
    for i, ch in enumerate(s):
        if count[ord(ch)] == 1:              # appears exactly once
            return i
    return -1

for s in ("geeksforgeeks", "abcabc", "aaa", "Thrishank"):
    print(f"{s}:", leftmost_non_repeating(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

const int CHAR = 256;

int leftmostNonRepeating(const string& s) {
    int count[CHAR] = {0};
    for (char ch : s) count[(unsigned char)ch]++;
    for (int i = 0; i < (int)s.size(); i++)
        if (count[(unsigned char)s[i]] == 1) return i;   // appears exactly once
    return -1;
}

int main() {
    for (string s : {"geeksforgeeks", "abcabc", "aaa", "Thrishank"})
        cout << s << ": " << leftmostNonRepeating(s) << "\n";
}
```

```java filename:Java
public class Main {
    static final int CHAR = 256;

    static int leftmostNonRepeating(String s) {
        int[] count = new int[CHAR];
        for (int i = 0; i < s.length(); i++) count[s.charAt(i)]++;
        for (int i = 0; i < s.length(); i++)
            if (count[s.charAt(i)] == 1) return i;     // appears exactly once
        return -1;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"geeksforgeeks", "abcabc", "aaa", "Thrishank"})
            System.out.println(s + ": " + leftmostNonRepeating(s));
    }
}
```

```javascript filename:JavaScript
const CHAR = 256;

function leftmostNonRepeating(s) {
    const count = new Array(CHAR).fill(0);
    for (const ch of s) count[ch.charCodeAt(0)]++;
    for (let i = 0; i < s.length; i++)
        if (count[s.charCodeAt(i)] === 1) return i;    // appears exactly once
    return -1;
}

for (const s of ["geeksforgeeks", "abcabc", "aaa", "Thrishank"])
    console.log(`${s}:`, leftmostNonRepeating(s));
```

```text filename:Output
geeksforgeeks: 5
abcabc: -1
aaa: -1
Thrishank: 0
```

Time O(n + CHAR) · Space O(CHAR)

<strong>Single pass over the string</strong> (then a scan of the 256 slots): store each character's first index; mark it `-2` the moment it is seen again. The answer is the smallest index that is still `>= 0`.

```python filename:Python
CHAR = 256

def leftmost_non_repeating(s):
    first_index = [-1] * CHAR            # -1 never seen, -2 seen more than once, else the index
    for i, ch in enumerate(s):
        c = ord(ch)
        if first_index[c] == -1:
            first_index[c] = i
        else:
            first_index[c] = -2
    res = -1
    for idx in first_index:
        if idx >= 0 and (res == -1 or idx < res):
            res = idx
    return res

print(leftmost_non_repeating("geeksforgeeks"))
print(leftmost_non_repeating("aaa"))
```

```text filename:Output
5
-1
```

> [!NOTE] Key point
>
> This variant reads the string once, which matters when the string is a stream you cannot rewind. For plain strings the two-pass count is just as fast and easier to get right.

# Problem: reverse the words in a string

> [!TIP] Example
>
> <strong>Input:</strong> `s = "Welcome to gfg"`<br><strong>Output:</strong> `gfg to Welcome`<br><strong>Input:</strong> `s = "abc"`<br><strong>Output:</strong> `abc`

Words are separated by single spaces; reverse their <strong>order</strong>, not the letters. The straightforward way splits into words, pushes them on a stack (or reverses the list) and joins — `O(n)` time but `O(n)` extra space for the words:

```python filename:Python
def reverse_words(s):
    stack = []
    for word in s.split():           # split on whitespace
        stack.append(word)
    out = []
    while stack:
        out.append(stack.pop())      # LIFO → last word comes out first
    return " ".join(out)             # idiom: " ".join(reversed(s.split()))

print(reverse_words("Welcome to gfg"))
print(reverse_words("abc"))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <sstream>
#include <stack>
#include <string>
using namespace std;

string reverseWords(const string& s) {
    istringstream in(s);
    stack<string> st;
    string word;
    while (in >> word) st.push(word);     // split on whitespace
    string out;
    while (!st.empty()) {
        if (!out.empty()) out += " ";
        out += st.top();                  // LIFO → last word comes out first
        st.pop();
    }
    return out;
}

int main() {
    cout << reverseWords("Welcome to gfg") << "\n";
    cout << reverseWords("abc") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static String reverseWords(String s) {
        Deque<String> stack = new ArrayDeque<>();
        for (String word : s.split(" ")) stack.push(word);   // split on spaces
        StringBuilder out = new StringBuilder();
        while (!stack.isEmpty()) {
            if (out.length() > 0) out.append(' ');
            out.append(stack.pop());                           // LIFO → last word comes out first
        }
        return out.toString();
    }

    public static void main(String[] args) {
        System.out.println(reverseWords("Welcome to gfg"));
        System.out.println(reverseWords("abc"));
    }
}
```

```javascript filename:JavaScript
function reverseWords(s) {
    const stack = [];
    for (const word of s.split(" ")) stack.push(word);   // split on spaces
    const out = [];
    while (stack.length) out.push(stack.pop());          // LIFO → last word comes out first
    return out.join(" ");                                // idiom: s.split(" ").reverse().join(" ")
}

console.log(reverseWords("Welcome to gfg"));
console.log(reverseWords("abc"));
```

```text filename:Output
gfg to Welcome
abc
```

Time O(n) · Space O(n)

> [!NOTE] Idea
>
> <strong>`O(1)`</strong><strong> auxiliary space:</strong> reverse each word in place, then reverse the whole string. Reversing twice restores the letters inside each word while the words themselves end up in reverse order. It needs a <em>mutable</em> character sequence — a list in Python, `char[]` in Java, an array in JavaScript, the string itself in C++.

```text filename:Two%20reversals%3A%20letters%20are%20flipped%20twice%20(back%20to%20normal)%2C%20word%20order%20once
Welcome to gfg      original
emocleW ot gfg      step 1: reverse every word in place
gfg to Welcome      step 2: reverse the whole string
```

```python filename:Python
def reverse_range(chars, b, e):
    while b < e:
        chars[b], chars[e] = chars[e], chars[b]
        b += 1
        e -= 1

def reverse_words(s):
    chars = list(s)                            # mutable copy — str is immutable
    n = len(chars)
    start = 0
    for i in range(n):
        if chars[i] == ' ':
            reverse_range(chars, start, i - 1)   # step 1: reverse this word
            start = i + 1
    reverse_range(chars, start, n - 1)           # the last word
    reverse_range(chars, 0, n - 1)               # step 2: reverse everything
    return "".join(chars)

print(reverse_words("Welcome to gfg"))
print(reverse_words("abc"))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <utility>
using namespace std;

void reverseRange(string& s, int b, int e) {
    while (b < e) swap(s[b++], s[e--]);
}

string reverseWords(string s) {               // std::string is mutable: work on the copy
    int n = s.size(), start = 0;
    for (int i = 0; i < n; i++) {
        if (s[i] == ' ') {
            reverseRange(s, start, i - 1);    // step 1: reverse this word
            start = i + 1;
        }
    }
    reverseRange(s, start, n - 1);            // the last word
    reverseRange(s, 0, n - 1);                // step 2: reverse everything
    return s;
}

int main() {
    cout << reverseWords("Welcome to gfg") << "\n";
    cout << reverseWords("abc") << "\n";
}
```

```java filename:Java
public class Main {
    static void reverseRange(char[] c, int b, int e) {
        while (b < e) { char t = c[b]; c[b] = c[e]; c[e] = t; b++; e--; }
    }

    static String reverseWords(String s) {
        char[] c = s.toCharArray();               // mutable copy — String is immutable
        int n = c.length, start = 0;
        for (int i = 0; i < n; i++) {
            if (c[i] == ' ') {
                reverseRange(c, start, i - 1);    // step 1: reverse this word
                start = i + 1;
            }
        }
        reverseRange(c, start, n - 1);            // the last word
        reverseRange(c, 0, n - 1);                // step 2: reverse everything
        return new String(c);
    }

    public static void main(String[] args) {
        System.out.println(reverseWords("Welcome to gfg"));
        System.out.println(reverseWords("abc"));
    }
}
```

```javascript filename:JavaScript
function reverseRange(c, b, e) {
    while (b < e) { [c[b], c[e]] = [c[e], c[b]]; b++; e--; }
}

function reverseWords(s) {
    const c = s.split("");                        // mutable copy — string is immutable
    const n = c.length;
    let start = 0;
    for (let i = 0; i < n; i++) {
        if (c[i] === " ") {
            reverseRange(c, start, i - 1);        // step 1: reverse this word
            start = i + 1;
        }
    }
    reverseRange(c, start, n - 1);                // the last word
    reverseRange(c, 0, n - 1);                    // step 2: reverse everything
    return c.join("");
}

console.log(reverseWords("Welcome to gfg"));
console.log(reverseWords("abc"));
```

```text filename:Output
gfg to Welcome
abc
```

Time O(n) · Space O(1) extra (beyond the mutable copy that immutable languages force)

> [!WARNING] Pitfall
>
> Multiple consecutive spaces break the in-place version (it would produce empty “words” and keep every space). Normalise the input first, or use `split()` without an argument, which collapses runs of whitespace.

# Interview Q&amp;A

```question
Why are strings immutable in Python, Java and JavaScript?

---

Safety and speed: an immutable string can be shared freely between threads and functions, cached (interned), and used as a dictionary / `HashMap` key because its hash can never change. The cost is that every edit allocates a new string — so builders (`join`, `StringBuilder`, arrays) exist for heavy editing. C++ chose the opposite trade-off: `std::string` is a mutable buffer you own.
```

```question
Why is building a string with += in a loop considered O(n²)?

---

Each `+=` on an immutable string copies the whole current result into a new object; copying 1, 2, 3, … n characters sums to `O(n²)`. Collect the pieces in a list and `''.join()` once (`O(n)`), or use `StringBuilder` in Java. CPython has an optimisation that often makes `+=` fast, but you should not rely on it.
```

```question
How do you check if two strings are anagrams in O(n)?

---

Length check, then a frequency array indexed by character code: `+1` for every character of the first string, `-1` for the second; all counts must end at zero. For Unicode or when the alphabet is unknown, use a hash map of counts instead of a fixed 256-slot array.
```

```question
Substring vs subsequence?

---

A <strong>substring</strong> is contiguous (`'BC'` in `'ABCD'`); a <strong>subsequence</strong> keeps order but may skip characters (`'AD'` in `'ABCD'`). Substring search is `find`/KMP; subsequence check is the two-pointer greedy walk.
```

```question
How do you check whether one string is a rotation of another?

---

Same length and `s2 in s1 + s1`. Doubling `s1` lays every rotation out as a window of length `n`, so one substring search answers the question in `O(n)` with a linear-time matcher.
```

```question
Leftmost repeating character in one pass — how?

---

Scan from the <strong>right</strong> with a `visited` array: whenever the current character was already visited (i.e. appears further right), record its index. The scan moves left, so the last recorded index is the leftmost repeating one. `O(n)` time, `O(CHAR)` space.
```
