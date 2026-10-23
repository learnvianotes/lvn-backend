---
id: f8e942da-c277-75d0-95b4-f858ad7d79b1
key: topic:javascript/string-methods
subject: javascript
topic: string-methods
title: String Methods
slug: string-methods
order: 1
---

Every string method returns a new string (or a value) — the original never changes.

# Cheat sheet

| Method | Purpose | Example → result |
| --- | --- | --- |
| `includes / startsWith / endsWith` | Search → boolean | `'hello'.startsWith('he')` → `true` |
| `indexOf / lastIndexOf` | Position or `-1` | `'banana'.indexOf('a')` → `1` |
| `slice(start, end)` | Substring; negatives count from end | `'hello'.slice(-3)` → `'llo'` |
| `toUpperCase / toLowerCase` | Case | `'Hi'.toUpperCase()` → `'HI'` |
| `trim / trimStart / trimEnd` | Remove whitespace | `' x '.trim()` → `'x'` |
| `padStart / padEnd` | Pad to a length | `'5'.padStart(3, '0')` → `'005'` |
| `repeat(n)` | Repeat | `'ab'.repeat(3)` → `'ababab'` |
| `split(sep)` | String → array | `'a,b'.split(',')` → `['a', 'b']` |
| `replace / replaceAll` | Substitute (string or regex) | `'a-a'.replaceAll('-', '+')` |
| `at(i)` | Index with negatives | `'abc'.at(-1)` → `'c'` |
| `localeCompare` | Locale-aware compare for sorting | `'a'.localeCompare('b')` → `-1` |

# In action

```javascript filename:JavaScript
const text = "  The quick brown fox  ";
const t = text.trim();
console.log(`[${t}]`, t.length);
console.log(t.includes("quick"), t.indexOf("o"), t.lastIndexOf("o"));
console.log(t.split(" "), t.split(" ", 2));
console.log(t.replace("o", "0"), "|", t.replaceAll("o", "0"));
console.log(t.replace(/o/g, (m) => m.toUpperCase()));
console.log("7".padStart(3, "0"), "ab".padEnd(5, "."), "=".repeat(5));
```

```text filename:Output
[The quick brown fox] 19
true 12 17
[ 'The', 'quick', 'brown', 'fox' ] [ 'The', 'quick' ]
The quick br0wn fox | The quick br0wn f0x
The quick brOwn fOx
007 ab... =====
```

> [!WARNING] Watch out
>
> `replace` with a <strong>string</strong> pattern replaces only the <em>first</em> match. Use `replaceAll`, or a regex with the `g` flag.

# Common interview manipulations

```javascript filename:JavaScript
const reverse = (s) => [...s].reverse().join("");
const isPalindrome = (s) => {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean === reverse(clean);
};
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s) => s.split(" ").map(capitalize).join(" ");
const countChars = (s) =>
  [...s].reduce((acc, ch) => ({ ...acc, [ch]: (acc[ch] ?? 0) + 1 }), {});

console.log(reverse("hello"));
console.log(isPalindrome("A man, a plan, a canal: Panama"));
console.log(titleCase("learn via notes"));
console.log(countChars("banana"));
```

```text filename:Output
olleh
true
Learn Via Notes
{ b: 1, a: 3, n: 2 }
```

# substring vs slice vs substr

| Method | Negative indices | start &gt; end | Status |
| --- | --- | --- | --- |
| `slice(s, e)` | Count from end | Returns `''` | Use this |
| `substring(s, e)` | Treated as `0` | Swaps the arguments | OK |
| `substr(s, len)` | Start may be negative | Second arg is a <em>length</em> | Deprecated |

```question
How do you reverse a string in JavaScript?

---

`[...s].reverse().join('')`. Strings have no `reverse`, so convert to an array first; spread (rather than `split('')`) keeps emoji and other surrogate pairs intact.
```
