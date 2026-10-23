---
id: 5e69f357-4950-79da-89df-e486ecb07b1b
key: topic:python/unicode-bytes
subject: python
topic: unicode-bytes
title: Unicode, Bytes & Encodings
slug: unicode-bytes-encodings
order: 1
---

A `str` is a sequence of Unicode <strong>code points</strong>; `bytes` is a sequence of raw 8-bit values. An <em>encoding</em> such as UTF-8 is the bridge — and most text bugs come from crossing that bridge carelessly.

> [!INFO]
>
> <strong>Code point</strong> — a number that identifies one Unicode character, written `U+0041` for `A`. `ord()` gives it, `chr()` goes back. Python strings index and measure in code points.

`str` (text) → `.encode('utf-8')` → `bytes` (disk / network) → `.decode('utf-8')` → `str`

# Code points &amp; escapes

```python filename:Python
print(ord("A"), hex(ord("€")), chr(0x1F600))       # 65 0x20ac 😀
print("\u00e9", "\U0001F40D", "\N{GREEK SMALL LETTER PI}")   # é 🐍 π
import unicodedata
print(unicodedata.name("€"))                       # EURO SIGN
print(unicodedata.category("A"), unicodedata.category("5"))   # Lu Nd
```

| Escape | Meaning | Example |
| --- | --- | --- |
| `\xhh` | Code point with 2 hex digits | `'\xe9'` → `é` |
| `\uhhhh` | 4 hex digits (BMP) | `'\u20ac'` → `€` |
| `\Uhhhhhhhh` | 8 hex digits (any code point) | `'\U0001F600'` → 😀 |
| `\N{name}` | By official Unicode name | `'\N{SNOWMAN}'` → ☃ |

# UTF-8: variable-length encoding

```python filename:Python
for ch in ["A", "é", "€", "😀"]:
    b = ch.encode("utf-8")
    print(ch, len(b), b)
```

```text filename:Output
A 1 b'A'
é 2 b'\xc3\xa9'
€ 3 b'\xe2\x82\xac'
😀 4 b'\xf0\x9f\x98\x80'
```

```python filename:Python
s = "naïve café"
print(len(s), len(s.encode("utf-8")), len(s.encode("utf-16")))   # 10 12 22
print(s.encode("utf-8")[:3])                                    # b'na\xc3'
```

> [!NOTE] UTF-8
>
> 1–4 bytes per code point, ASCII-compatible, no byte-order issues. <strong>The default everywhere</strong> — web, Linux, Python source files.

> [!NOTE] UTF-16 / UTF-32
>
> 2–4 / always 4 bytes. Used internally by Windows, Java and JavaScript. Need a byte-order mark (BOM).

> [!NOTE] Latin-1 (ISO-8859-1)
>
> One byte per character, only 256 characters. Decoding <strong>never fails</strong> — every byte maps to something (often wrong).

> [!NOTE] ASCII
>
> 7-bit, 128 characters. Any non-English text raises `UnicodeEncodeError`.

# Encoding errors and `errors=`

```python filename:Python
data = "café".encode("utf-8")
print(data.decode("utf-8"))                        # café
print(data.decode("latin-1"))                      # cafÃ©   ← mojibake: wrong codec
try:
    data.decode("ascii")
except UnicodeDecodeError as e:
    print(e.reason, e.start)                       # ordinal not in range(128) 3
print(data.decode("ascii", errors="replace"))      # caf��
print(data.decode("ascii", errors="ignore"))       # caf
print("café".encode("ascii", errors="xmlcharrefreplace"))   # b'caf&#233;'
print("café".encode("ascii", errors="backslashreplace"))    # b'caf\\xe9'
```

| `errors=` | On bad data |
| --- | --- |
| `'strict'` (default) | Raise `UnicodeEncodeError` / `UnicodeDecodeError` |
| `'replace'` | Substitute `?` (encode) or `U+FFFD` � (decode) |
| `'ignore'` | Silently drop — loses data |
| `'backslashreplace'` | Write escapes like `\xe9` |
| `'surrogateescape'` | Round-trip undecodable bytes (used for OS file names) |

> [!WARNING] Watch out
>
> <em>Mojibake</em> (`cafÃ©`) means text was encoded with one codec and decoded with another. Fix it at the boundary — always state the encoding when you read or write.

# `bytes`, `bytearray` &amp; `memoryview`

```python filename:Python
b = b"hi\x00\xff"
print(b[0], b[-1], list(b))            # 104 255 [104, 105, 0, 255]
print(b[:2], type(b[:2]).__name__)     # b'hi' bytes
print(b.hex(), bytes.fromhex("48 69"))  # 686900ff b'Hi'
print(bytes([72, 105]), bytes(3))      # b'Hi' b'\x00\x00\x00'

buf = bytearray(b"hello")              # mutable
buf[0] = ord("J")
buf.extend(b"!")
print(buf, bytes(buf))                 # bytearray(b'Jello!') b'Jello!'

view = memoryview(buf)[1:4]            # zero-copy slice
view[0] = ord("E")
print(buf)                             # bytearray(b'JEllo!')
```

| Type | Mutable | Indexing gives | Use for |
| --- | --- | --- | --- |
| `str` | No | a 1-char `str` | Human text |
| `bytes` | No | an `int` 0–255 | Binary data, network payloads, hashes |
| `bytearray` | Yes | an `int` 0–255 | Building/patching binary buffers |
| `memoryview` | Follows the buffer | an `int` | Zero-copy slices of large buffers |

> [!WARNING] Watch out
>
> You can't mix them: `'a' + b'b'` raises `TypeError`. Decode bytes to text as early as possible and encode as late as possible (the <em>Unicode sandwich</em>).

# Normalization: same text, different code points

```python filename:Python
import unicodedata
a = "café"                        # é as one code point U+00E9
b = "cafe\u0301"                  # e + COMBINING ACUTE ACCENT
print(a == b)                     # False   ← both render as "café"
print(len(a), len(b))             # 4 5
nfc = lambda s: unicodedata.normalize("NFC", s)
print(nfc(a) == nfc(b))           # True
print(len(unicodedata.normalize("NFD", a)))   # 5
print(unicodedata.normalize("NFKC", "ﬁ①"))   # fi1
```

| Form | Does | Use |
| --- | --- | --- |
| NFC | Compose into single code points where possible | Storing and comparing text (the web default) |
| NFD | Decompose into base + combining marks | Stripping accents |
| NFKC / NFKD | Also fold <em>compatibility</em> forms: `ﬁ` → `fi`, `①` → `1` | Search, identifiers, user names |

```python filename:Python
import unicodedata
def strip_accents(s):
    decomposed = unicodedata.normalize("NFD", s)
    return "".join(c for c in decomposed if not unicodedata.combining(c))

print(strip_accents("Crème brûlée à São Paulo"))   # Creme brulee a Sao Paulo
def same_text(x, y):
    norm = lambda s: unicodedata.normalize("NFC", s).casefold()
    return norm(x) == norm(y)
print(same_text("STRASSE", "straße"))             # True
```

# Length isn't what users see

```python filename:Python
thumbs = "👍🏽"                        # thumbs up + skin-tone modifier
family = "👨\u200d👩\u200d👧"           # joined with ZERO WIDTH JOINERs
flag = "🇮🇳"                           # two regional-indicator letters
print(len(thumbs), len(family), len(flag))   # 2 5 2
print(thumbs[::-1] == thumbs)              # False   ← reversing splits the emoji
```

> [!NOTE] Key point
>
> A user-perceived character (a <em>grapheme cluster</em>) can be several code points. `len`, slicing and `[::-1]` work on code points, so they can cut emoji or accented letters in half. For true grapheme handling use the third-party `grapheme` or `regex` (`\X`) modules.

# Files &amp; encodings

```python filename:Python
import tempfile, os
path = os.path.join(tempfile.mkdtemp(), "bom.csv")
with open(path, "w", encoding="utf-8-sig") as f:     # writes a BOM (Excel likes it)
    f.write("name\nAsha\n")
with open(path, "rb") as f:
    print(f.read(3))                                  # b'\xef\xbb\xbf'
with open(path, encoding="utf-8") as f:
    print(repr(f.readline()))                         # '\ufeffname\n'
with open(path, encoding="utf-8-sig") as f:           # strips the BOM
    print(repr(f.readline()))                         # 'name\n'
```

- Always pass `encoding='utf-8'` to `open()` in text mode — the default depends on the OS locale (Python 3.15 makes UTF-8 the default).
- Open binary files (`'rb'`, `'wb'`) for images, zips and anything you'll hash — you get `bytes`, no decoding.
- `utf-8-sig` reads files with or without a BOM; use it for CSVs from Excel.
- `sys.getdefaultencoding()` is always `'utf-8'`; `locale.getpreferredencoding()` is what `open()` uses by default.

# Interview questions

```question
What is the difference between str and bytes?

---

`str` is text: a sequence of Unicode code points. `bytes` is binary data: a sequence of integers 0–255. You convert with `str.encode(encoding)` and `bytes.decode(encoding)`; you can't concatenate them directly.
```

```question
Why is len('é') sometimes 1 and sometimes 2?

---

`é` can be one precomposed code point (U+00E9) or `e` plus a combining accent (U+0301). Both render the same. Normalize with `unicodedata.normalize('NFC', s)` before comparing or measuring.
```

```question
What is UTF-8 and why is it the default?

---

A variable-length encoding of Unicode using 1–4 bytes per code point. It is backward-compatible with ASCII, has no byte-order issues, is compact for English text, and can encode every character — so it became the standard for files, the web and Python source code.
```
