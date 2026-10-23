---
id: 383e44a8-7b8a-7a3d-a289-032b92d2df5c
key: topic:javascript/arrays
subject: javascript
topic: arrays
title: Arrays
slug: arrays
order: 1
---

Arrays are ordered, zero-indexed, dynamically sized lists that can hold any mix of values. Under the hood they are objects with numeric keys and a magic `length`.

# Creating arrays

```javascript filename:JavaScript
const a = [1, "two", { three: 3 }, [4]];
console.log(a, a.length);
console.log(Array.of(7), Array(3), Array(3).fill(0));
console.log(Array.from("abc"), Array.from({ length: 4 }, (_, i) => i * i));
console.log([..."hi"], Array.from(new Set([1, 1, 2])));
```

```text filename:Output
[ 1, 'two', { three: 3 }, [ 4 ] ] 4
[ 7 ] [ <3 empty items> ] [ 0, 0, 0 ]
[ 'a', 'b', 'c' ] [ 0, 1, 4, 9 ]
[ 'h', 'i' ] [ 1, 2 ]
```

> [!WARNING] Watch out
>
> `Array(3)` creates 3 <em>holes</em> (empty slots), not 3 `undefined`s — and `map` skips holes. Use `Array.from({ length: 3 }, fn)` or `Array(3).fill(x)`.

# Adding and removing

| Method | Where | Mutates? | Returns |
| --- | --- | --- | --- |
| `push(x)` / `pop()` | End | Yes | new length / removed item |
| `unshift(x)` / `shift()` | Start (O(n)) | Yes | new length / removed item |
| `splice(i, n, ...items)` | Anywhere | Yes | array of removed items |
| `slice(i, j)` | Copy a range | No | new array |
| `concat(...arrs)` | Join | No | new array |
| `toSpliced`, `with(i, v)` | Copying variants (ES2023) | No | new array |

```javascript filename:JavaScript
const arr = ["a", "b", "c", "d"];
arr.push("e");
const last = arr.pop();
arr.unshift("z");
const first = arr.shift();
console.log(arr, last, first);

const removed = arr.splice(1, 2, "X", "Y", "Z");   // at 1: remove 2, insert 3
console.log(arr, removed);
console.log(arr.slice(1, 3), arr.slice(-2), arr.with(0, "!"), arr[0]);
```

```text filename:Output
[ 'a', 'b', 'c', 'd' ] e z
[ 'a', 'X', 'Y', 'Z', 'd' ] [ 'b', 'c' ]
[ 'X', 'Y' ] [ 'Z', 'd' ] [ '!', 'X', 'Y', 'Z', 'd' ] a
```

# `length` is writable

```javascript filename:JavaScript
const nums = [1, 2, 3, 4, 5];
nums.length = 2;                 // truncates
console.log(nums);
nums[5] = 6;                     // creates holes
console.log(nums, nums.length);
console.log(nums.at(-1), nums[nums.length - 1]);
```

```text filename:Output
[ 1, 2 ]
[ 1, 2, <3 empty items>, 6 ] 6
6 6
```

# Checking and converting

```javascript filename:JavaScript
console.log(Array.isArray([]), typeof []);
console.log([1, [2, 3]].toString(), String([null, undefined, 1]));
console.log([3, 1, 2].join(" < "), "a-b-c".split("-"));
```

```text filename:Output
true object
1,2,3 ,,1
3 < 1 < 2 [ 'a', 'b', 'c' ]
```

```question
How do you empty an array?

---

`arr.length = 0` (mutates — every reference sees an empty array), `arr.splice(0)` (mutates, returns the removed items), or `arr = []` (rebinds only this variable; other references keep the old contents).
```
