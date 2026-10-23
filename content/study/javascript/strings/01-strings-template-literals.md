---
id: 61df3ca5-2bf4-7455-adee-e70b9ff33c74
key: topic:javascript/strings
subject: javascript
topic: strings
title: Strings & Template Literals
slug: strings-template-literals
order: 1
---

Strings are immutable sequences of UTF-16 code units. Template literals give interpolation, multi-line text and tagged templates.

# Three ways to write a string

```javascript filename:JavaScript
const single = 'single';
const double = "double";
const name = "Asha";
const tpl = `Hi ${name}, 2 + 3 = ${2 + 3}, upper: ${name.toUpperCase()}`;
console.log(single, double);
console.log(tpl);
const multi = `line 1
line 2`;
console.log(multi);
```

```text filename:Output
single double
Hi Asha, 2 + 3 = 5, upper: ASHA
line 1
line 2
```

# Indexing and immutability

```javascript filename:JavaScript
const s = "JavaScript";
console.log(s.length, s[0], s.at(-1), s.charAt(4), s[99]);
console.log(s.slice(0, 4), s.slice(-6), s.substring(4, 0));
console.log(s.charCodeAt(0), String.fromCharCode(74));
```

```text filename:Output
10 J t S undefined
Java Script Java
74 J
```

# Unicode gotcha

```javascript filename:JavaScript
const emoji = "😀";
console.log(emoji.length, [...emoji].length);
console.log("héllo".length, "héllo".normalize("NFD").length);
const flag = "👍🏽";
console.log(flag.length, [...flag].length);
```

```text filename:Output
2 1
5 6
4 2
```

> [!NOTE] Key point
>
> `.length` counts <strong>UTF-16 code units</strong>, not characters. Emoji outside the Basic Multilingual Plane take 2 units; `[...str]` iterates by <em>code point</em>. For user-perceived characters use `Intl.Segmenter`.

# Escapes and raw strings

```javascript filename:JavaScript
console.log("tab:\tend", "quote: \"", 'it\'s');
console.log("\u0041\u{1F600}");
console.log(String.raw`C:\new\table`);
```

```text filename:Output
tab:	end quote: " it's
A😀
C:\new\table
```

# Tagged templates

A <strong>tag</strong> is a function called with the literal's string pieces and the interpolated values — used by `String.raw`, styled-components, GraphQL `gql`, SQL builders and HTML escapers.

```javascript filename:JavaScript
function highlight(strings, ...values) {
  return strings.reduce(
    (out, str, i) => out + str + (i < values.length ? `[${values[i]}]` : ""),
    ""
  );
}
const item = "coffee", price = 3.5;
console.log(highlight`One ${item} costs $${price}.`);

function show(strings, ...values) {
  console.log(strings, values);
}
show`a${1}b${2}`;
```

```text filename:Output
One [coffee] costs $[3.5].
[ 'a', 'b', '' ] [ 1, 2 ]
```

```question
Why is "😀".length equal to 2?

---

JS strings are UTF-16. Code points above U+FFFF are stored as a <em>surrogate pair</em> of two code units, and `.length` counts code units. Spread (`[...s]`) or `for…of` iterate by code point.
```
