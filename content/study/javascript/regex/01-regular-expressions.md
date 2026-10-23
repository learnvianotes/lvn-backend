---
id: 340922fa-2d61-79a6-8154-1c7e8266330d
key: topic:javascript/regex
subject: javascript
topic: regex
title: Regular Expressions
slug: regular-expressions
order: 1
---

Patterns for searching, validating and transforming text. Write them as literals `/pattern/flags` or with `new RegExp(string, flags)`.

# Syntax cheat sheet

| Token | Matches |
| --- | --- |
| `.` | Any char except newline (any char with the `s` flag) |
| `\d \w \s` | Digit, word char `[A-Za-z0-9_]`, whitespace — uppercase negates |
| `[abc]`, `[^abc]`, `[a-z]` | Character class, negated class, range |
| `^` `$` `\b` | Start, end (per line with `m`), word boundary |
| `* + ? {n,m}` | 0+, 1+, 0–1, n to m — add `?` for lazy (`*?`) |
| `(…)` `(?<name>…)` `(?:…)` | Capture group, named group, non-capturing group |
| `a&#124;b` | Alternation |
| `(?=…)` `(?!…)` `(?<=…)` `(?<!…)` | Lookahead, negative lookahead, lookbehind, negative lookbehind |

| Flag | Meaning |
| --- | --- |
| `g` | Global — all matches |
| `i` | Case-insensitive |
| `m` | Multiline `^`/`$` |
| `s` | `.` matches newlines (dotAll) |
| `u` / `v` | Unicode mode / Unicode sets (ES2024) |
| `y` | Sticky — match at `lastIndex` only |
| `d` | Record match indices |

# The main methods

```javascript filename:JavaScript
const text = "Order #123 shipped on 2024-03-15, order #456 on 2024-04-01.";
console.log(/order/i.test(text));
console.log(text.match(/#\d+/));              // first match + details
console.log(text.match(/#\d+/g));             // all matches (no details)
console.log(text.search(/\d{4}/));
console.log(text.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1"));
console.log("a1b22c333".split(/\d+/));
```

```text filename:Output
true
[
  '#123',
  index: 6,
  input: 'Order #123 shipped on 2024-03-15, order #456 on 2024-04-01.',
  groups: undefined
]
[ '#123', '#456' ]
22
Order #123 shipped on 15/03/2024, order #456 on 01/04/2024.
[ 'a', 'b', 'c', '' ]
```

# Named groups and matchAll

```javascript filename:JavaScript
const log = "user=asha id=7; user=ravi id=12";
const re = /user=(?<name>\w+) id=(?<id>\d+)/g;
for (const m of log.matchAll(re)) {
  console.log(m.groups.name, Number(m.groups.id), m.index);
}
const { year, month } = "2024-09".match(/(?<year>\d{4})-(?<month>\d{2})/).groups;
console.log(year, month);
```

```text filename:Output
asha 7 0
ravi 12 16
2024 09
```

# Greedy vs lazy, lookarounds

```javascript filename:JavaScript
const html = "<b>bold</b> and <i>italic</i>";
console.log(html.match(/<.+>/)[0]);       // greedy: as much as possible
console.log(html.match(/<.+?>/)[0]);      // lazy: as little as possible
console.log("1234567.89".replace(/\B(?=(\d{3})+(?!\d))/g, ","));
console.log("price: $30, €40".match(/(?<=\$)\d+/)[0]);
const strong = /^(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
console.log(strong.test("Passw0rd!"), strong.test("password"));
```

```text filename:Output
<b>bold</b> and <i>italic</i>
<b>
1,234,567.89
30
true false
```

# The `lastIndex` trap

```javascript filename:JavaScript
const re = /a/g;
console.log(re.test("a"), re.test("a"), re.test("a"));
```

```text filename:Output
true false true
```

> [!WARNING] Watch out
>
> A regex with `g` or `y` is <strong>stateful</strong>: `test`/`exec` continue from `lastIndex`. Reusing one global regex across calls gives alternating results. Drop the `g` for `test`, or reset `re.lastIndex = 0`.

# Dynamic patterns

```javascript filename:JavaScript
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const term = "a.b";
console.log(new RegExp(term).test("axb"), new RegExp(escapeRegExp(term)).test("axb"));
console.log(new RegExp(`^${escapeRegExp("1+1")}$`).source);
```

```text filename:Output
true false
^1\+1$
```

```question
What does the g flag change?

---

With `g`, `match` returns all matches (without groups), `replace` replaces every match, `matchAll` requires it, and `test`/`exec` become stateful via `lastIndex`. Without it, only the first match is considered.
```
