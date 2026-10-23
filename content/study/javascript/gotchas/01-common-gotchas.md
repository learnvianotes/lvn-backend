---
id: 620a39b1-55c8-7bd9-8056-9b8823ccabd2
key: topic:javascript/gotchas
subject: javascript
topic: gotchas
title: Common Gotchas
slug: common-gotchas
order: 1
---

The famous weird parts of JavaScript — each one is logical once you know the rule behind it.

# Coercion surprises

```javascript filename:JavaScript
console.log([] == ![], "b" + "a" + +"a" + "a");
console.log(null >= 0, null > 0, null == 0);
console.log([1, 2, 3] + [4, 5], typeof (1 + "1" - 1));
console.log(Math.max() < Math.min(), 0.1 * 3, 9007199254740992 + 1);
console.log("10" > "9", 10 > "9", [10, 9, 1].sort());
```

```text filename:Output
true baNaNa
true false false
1,2,34,5 number
true 0.30000000000000004 9007199254740992
false true [ 1, 10, 9 ]
```

| Expression | Why |
| --- | --- |
| `[] == ![]` → `true` | `![]` is `false`; `[] == false` → `"" == 0` → `0 == 0` |
| `'b' + 'a' + +'a' + 'a'` | `+'a'` is `NaN`, concatenated as text |
| `null >= 0` but not `null == 0` | Relational operators convert `null` to `0`; `==` only equates `null` with `undefined` |
| `Math.max() < Math.min()` | `-Infinity < Infinity` |
| `'10' > '9'` is `false` | Two strings compare character by character |

# Syntax and semantics traps

```javascript filename:JavaScript
// 1. Automatic semicolon insertion
const a = 1
const b = a
;[1, 2].forEach((n) => console.log("ASI needs the leading ;", n))

// 2. typeof of a TDZ variable throws (unlike undeclared)
try { typeof later; } catch (e) { console.log(e.name); }
let later = 1;

// 3. array holes and length
const arr = [1, , 3];
console.log(arr.length, arr.map((x) => x * 2), 1 in arr);

// 4. delete on arrays leaves holes
const nums = [1, 2, 3];
delete nums[1];
console.log(nums, nums.length);
```

```text filename:Output
ASI needs the leading ; 1
ASI needs the leading ; 2
ReferenceError
3 [ 2, <1 empty item>, 6 ] false
[ 1, <1 empty item>, 3 ] 3
```

# Numbers and dates

```javascript filename:JavaScript
console.log(parseInt("08"), parseInt(0.0000005), (0.1).toFixed(20));
console.log(new Date(2024, 1, 30).getDate(), new Date(2024, 0, 1).getMonth());
console.log(typeof NaN, [NaN].indexOf(NaN), Number.MIN_VALUE > 0);
```

```text filename:Output
8 5 0.10000000000000000555
1 0
number -1 true
```

> [!NOTE] Key point
>
> `parseInt(0.0000005)` is `5` because the number is first converted to the string `"5e-7"`. Feb 30 rolls over to March 1. `Number.MIN_VALUE` is the smallest <em>positive</em> double, not the most negative number.

# Objects, this and references

```javascript filename:JavaScript
const key1 = {}, key2 = {};
const lookup = {};
lookup[key1] = "first";
lookup[key2] = "second";                 // both become "[object Object]"
console.log(lookup[key1]);

const counter = { n: 0, inc: () => this?.n };
console.log(counter.inc());               // arrow method: no own this

const defaults = { tags: [] };
const a = { ...defaults }, b = { ...defaults };
a.tags.push("shared!");
console.log(b.tags);                      // shallow copy shares the array
```

```text filename:Output
second
undefined
[ 'shared!' ]
```

# Async traps

```javascript filename:JavaScript
const results = [];
[1, 2, 3].forEach(async (n) => {
  await null;
  results.push(n);
});
console.log("right after forEach:", results);   // nothing awaited it
await null; await null;
console.log("a bit later:", results);

const p = new Promise((resolve) => resolve(1));
p.then((v) => console.log("then with", v));
console.log("sync line runs first");
```

```text filename:Output
right after forEach: []
a bit later: [ 1, 2, 3 ]
sync line runs first
then with 1
```

> [!TIP] Do
>
> Use `===`, `const`, `Number.isNaN`, explicit comparators for `sort`, `Map` for object keys, `for…of`/`Promise.all` with `await`, and a linter (ESLint) that flags most of these.

> [!DANGER] Avoid
>
> Rely on ASI when a line starts with `(`, `[` or a backtick template; `for…in` on arrays; `delete` on arrays; arrow functions as object methods.
