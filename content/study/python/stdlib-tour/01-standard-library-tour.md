---
id: d4c4d481-52a5-7118-883f-7eda2b64733c
key: topic:python/stdlib-tour
subject: python
topic: stdlib-tour
title: Standard Library Tour
slug: standard-library-tour
order: 1
---

“Batteries included”: before installing a package, check the standard library. A map of the modules worth knowing, with a tiny example of each.

# Where things live

| Need | Module(s) | Covered in |
| --- | --- | --- |
| Containers &amp; algorithms | `collections`, `heapq`, `bisect`, `array` | <em>Data Structures</em> |
| Iteration &amp; functions | `itertools`, `functools`, `operator` | <em>Advanced Python</em>, <em>Functions</em> |
| Text | `string`, `re`, `textwrap`, `difflib`, `unicodedata` | <em>Strings &amp; Numbers</em> |
| Numbers | `math`, `decimal`, `fractions`, `statistics`, `random` | <em>Numbers</em>, below |
| Files &amp; formats | `pathlib`, `shutil`, `json`, `csv`, `tomllib`, `pickle`, `sqlite3`, `zipfile` | <em>Errors, Modules &amp; Files</em> |
| Dates | `datetime`, `zoneinfo`, `time`, `calendar` | <em>Dates &amp; Times</em> |
| OS &amp; processes | `os`, `sys`, `subprocess`, `argparse`, `logging` | this group |
| Concurrency | `threading`, `multiprocessing`, `concurrent.futures`, `asyncio`, `queue` | <em>Concurrency</em> |
| Testing &amp; debugging | `unittest`, `doctest`, `pdb`, `timeit`, `cProfile`, `tracemalloc` | <em>Testing &amp; Tooling</em> |
| Security &amp; ids | `hashlib`, `hmac`, `secrets`, `uuid`, `base64` | below |
| Internet (no network needed to parse) | `urllib.parse`, `http`, `email`, `html`, `ipaddress` | below |

# random &amp; statistics

```python filename:Python
import random, statistics

random.seed(42)                         # same seed → same sequence (reproducible experiments)
first = [random.randint(1, 6) for _ in range(5)]
random.seed(42)
print(first == [random.randint(1, 6) for _ in range(5)])   # True

rng = random.Random(7)                  # an independent generator with its own state
deck = list("AKQJ")
rng.shuffle(deck)                       # in place
print(len(rng.sample(range(100), 3)), rng.choice(deck) in deck)   # 3 True

data = [2, 4, 4, 4, 5, 5, 7, 9]
print(statistics.mean(data), statistics.median(data), statistics.mode(data))   # 5 4.5 4
print(statistics.pstdev(data), round(statistics.stdev(data), 3))             # 2.0 2.138
```

> [!WARNING] Watch out
>
> `random` is predictable by design — never use it for passwords, tokens or anything security-related. Use `secrets`.

# secrets, hashlib, uuid, base64

```python filename:Python
import secrets, hashlib, hmac, uuid, base64

token = secrets.token_urlsafe(16)                  # unpredictable, URL-safe
print(len(token) >= 16)                            # True
print(secrets.compare_digest("abc", "abc"))        # True   ← constant-time comparison

print(hashlib.sha256(b"hello").hexdigest()[:16])   # 2cf24dba5fb0a30e
sig = hmac.new(b"secret-key", b"payload", hashlib.sha256).hexdigest()
print(len(sig))                                    # 64

u = uuid.uuid4()                                   # random unique id
print(u.version, len(str(u)))                      # 4 36

encoded = base64.b64encode(b"hi there")
print(encoded, base64.b64decode(encoded))          # b'aGkgdGhlcmU=' b'hi there'
```

> [!NOTE] Key point
>
> Hash passwords with a slow, salted algorithm — `hashlib.scrypt` or `pbkdf2_hmac` (or the `argon2`/`bcrypt` packages) — never plain `sha256`.

# Text helpers: string, textwrap, difflib, pprint

```python filename:Python
import string, textwrap, difflib, pprint

print(string.ascii_lowercase[:5], string.digits, string.punctuation[:4])   # abcde 0123456789 !"#$
print(textwrap.shorten("The quick brown fox jumps over the lazy dog", width=25))   # The quick brown fox [...]
print(textwrap.wrap("one two three four five", width=9))   # ['one two', 'three', 'four five']
print(difflib.get_close_matches("pyhton", ["python", "java", "ruby"]))   # ['python']
print(round(difflib.SequenceMatcher(None, "kitten", "sitting").ratio(), 2))   # 0.62
print(pprint.pformat({"b": [1, 2], "a": {"x": 1}}))        # {'a': {'x': 1}, 'b': [1, 2]}   ← keys sorted
```

# urllib.parse, ipaddress, html

```python filename:Python
from urllib.parse import urlparse, parse_qs, urlencode, quote
import ipaddress, html

u = urlparse("https://shop.example.com:8443/search?q=red+shoes&page=2#top")
print(u.scheme, u.hostname, u.port, u.path)        # https shop.example.com 8443 /search
print(parse_qs(u.query))                           # {'q': ['red shoes'], 'page': ['2']}
print(urlencode({"q": "café & co", "n": 3}))       # q=caf%C3%A9+%26+co&n=3
print(quote("a b/c"))                              # a%20b/c

net = ipaddress.ip_network("10.0.0.0/30")
print([str(h) for h in net.hosts()])               # ['10.0.0.1', '10.0.0.2']
print(ipaddress.ip_address("192.168.1.5").is_private)   # True
print(html.escape("<b>Tom & Jerry</b>"))           # &lt;b&gt;Tom &amp; Jerry&lt;/b&gt;
```

# Compression &amp; archives in memory

```python filename:Python
import gzip, io, zipfile

raw = b"python " * 1000
packed = gzip.compress(raw)
print(len(raw), len(packed) < 100, gzip.decompress(packed) == raw)   # 7000 True True

buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("notes/a.txt", "alpha")
    zf.writestr("notes/b.txt", "beta")
with zipfile.ZipFile(buf) as zf:
    print(zf.namelist(), zf.read("notes/b.txt"))   # ['notes/a.txt', 'notes/b.txt'] b'beta'
```

# weakref, contextvars, dis

```python filename:Python
import weakref, dis

class Big:
    pass

obj = Big()
ref = weakref.ref(obj)             # doesn't keep obj alive
print(ref() is obj)                # True
del obj
print(ref())                       # None   ← freed as soon as the last strong reference went

cache = weakref.WeakValueDictionary()   # entries vanish when values are garbage-collected

def add(a, b):
    return a + b
ops = [i.opname for i in dis.get_instructions(add)]
print("BINARY_OP" in ops)          # True   ← dis shows the bytecode CPython runs
```

> [!NOTE] contextvars
>
> Per-task “global” state (request id, user) that works correctly with asyncio, unlike thread-locals.

> [!NOTE] copy
>
> `copy.copy` / `deepcopy` / `replace` (3.13).

> [!NOTE] enum, dataclasses, typing
>
> Model data clearly — see <em>Object-Oriented Python</em>.

> [!NOTE] sqlite3
>
> A full SQL database in a file (or in memory), no server needed.

> [!NOTE] http.server
>
> `python -m http.server 8000` serves the current folder — handy for quick tests.

> [!NOTE] venv, pip, ensurepip
>
> Environments and installers ship with Python.

```filename:Handy%20%60python%20-m%60%20one-liners
$ python -m http.server 8000        # static file server
$ python -m json.tool data.json     # pretty-print / validate JSON
$ python -m timeit "sum(range(1000))"
$ python -m venv .venv              # create a virtual environment
$ python -m zipfile -l bundle.zip   # list an archive
$ python -m calendar 2026 9         # print a month calendar
```

```question
When should you reach for a third-party package instead of the standard library?

---

When the stdlib version is low-level or missing features you need: `requests`/`httpx` over `urllib.request`, `pandas` over `csv` for analysis, `pydantic` for validation, `rich`/`click` for CLIs, `dateutil` for fuzzy date parsing. Start with the stdlib — it has no install step and is stable.
```

```question
random vs secrets?

---

`random` uses the Mersenne Twister — fast and reproducible with a seed, great for simulations and tests, but predictable. `secrets` uses the OS's cryptographically secure source — use it for tokens, passwords and keys.
```
