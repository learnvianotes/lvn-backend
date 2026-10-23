---
id: 376da8bd-4423-7e49-bcdf-22b2b1b420ea
key: topic:python/serialization
subject: python
topic: serialization
title: "Serialization: JSON, CSV & pickle"
slug: serialization-json-csv-pickle
order: 1
---

Turning Python objects into bytes or text and back — JSON for APIs, CSV for tables, TOML/INI for config, pickle for Python-only caches, and `struct` for binary formats.

| Format | Module | Human-readable | Cross-language | Safe on untrusted input |
| --- | --- | --- | --- | --- |
| JSON | `json` | Yes | Yes | Yes |
| CSV | `csv` | Yes | Yes | Yes |
| TOML | `tomllib` (read-only) | Yes | Yes | Yes |
| INI | `configparser` | Yes | Mostly | Yes |
| pickle | `pickle` | No | <strong>Python only</strong> | <strong>No — can run code</strong> |
| SQLite | `sqlite3` | No (queryable) | Yes | Yes |
| Packed binary | `struct` | No | Yes (you define the layout) | Yes |

# JSON basics &amp; type mapping

```python filename:Python
import json
user = {"name": "Asha", "skills": ["python", "sql"], "active": True, "manager": None}
text = json.dumps(user)                  # object → str
print(text)                              # {"name": "Asha", "skills": ["python", "sql"], "active": true, "manager": null}
print(json.loads(text)["skills"][0])     # python

print(json.loads(json.dumps({1: (1, 2)})))   # {'1': [1, 2]}   ← int keys become strings, tuples become lists
```

| Python | JSON | Back to Python |
| --- | --- | --- |
| `dict` | object `{}` | `dict` (keys always `str`) |
| `list`, `tuple` | array `[]` | `list` |
| `str` | string | `str` |
| `int`, `float` | number | `int` / `float` |
| `True` / `False` | `true` / `false` | `bool` |
| `None` | `null` | `None` |
| `set`, `datetime`, `Decimal`, objects | <strong>TypeError</strong> | — convert first |

> [!NOTE] Key point
>
> `dumps` / `loads` work with strings; `dump(obj, f)` / `load(f)` with open files.

# Formatting options

```python filename:Python
import json
data = {"name": "Zoë", "tags": ["a", "b"], "id": 7}

print(json.dumps(data))                                         # {"name": "Zo\u00eb", "tags": ["a", "b"], "id": 7}
print(json.dumps(data, ensure_ascii=False, sort_keys=True))     # {"id": 7, "name": "Zoë", "tags": ["a", "b"]}
print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))   # {"name":"Zoë","tags":["a","b"],"id":7}
```

```python filename:Python
import json
print(json.dumps({"id": 7, "tags": ["a", "b"]}, indent=2))
```

```text filename:Output
{
  "id": 7,
  "tags": [
    "a",
    "b"
  ]
}
```

| Option | Effect |
| --- | --- |
| `indent=2` | Pretty-print (config files, debugging) |
| `sort_keys=True` | Stable key order — diff-friendly output, cache keys |
| `ensure_ascii=False` | Keep non-ASCII characters instead of `\uXXXX` escapes |
| `separators=(',', ':')` | Most compact output (network payloads) |
| `default=fn` | Called for objects JSON can't encode |
| `allow_nan=False` | Reject `NaN`/`Infinity`, which are not valid JSON |

# Custom types: `default` and `object_hook`

```python filename:Python
import json
from dataclasses import dataclass, asdict, is_dataclass
from datetime import date

@dataclass
class Event:
    title: str
    day: date
    tags: set

def encode(obj):
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, set):
        return sorted(obj)
    if is_dataclass(obj):
        return asdict(obj)
    raise TypeError(f"{type(obj).__name__} is not JSON serializable")

text = json.dumps(Event("launch", date(2026, 9, 29), {"b", "a"}), default=encode)
print(text)                                  # {"title": "launch", "day": "2026-09-29", "tags": ["a", "b"]}

def decode(d):                               # called for every JSON object, innermost first
    if "day" in d:
        d["day"] = date.fromisoformat(d["day"])
    return d

back = json.loads(text, object_hook=decode)
print(back["day"].year, type(back["day"]).__name__)   # 2026 date
```

```python filename:Python
import json
try:
    json.loads("{'single': 'quotes'}")        # Python-style dict text is NOT JSON
except json.JSONDecodeError as e:
    print(e.msg, "at position", e.pos)        # Expecting property name enclosed in double quotes at position 1
```

# CSV: reading &amp; writing

```python filename:Python
import csv, io

rows = [{"name": "Asha", "city": "Pune, MH"}, {"name": "Ravi", "city": 'Say "hi"'}]
buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=["name", "city"])
writer.writeheader()
writer.writerows(rows)
print(buf.getvalue().splitlines())   # ['name,city', 'Asha,"Pune, MH"', 'Ravi,"Say ""hi"""']   ← commas and quotes are escaped for you

reader = csv.reader(io.StringIO(buf.getvalue()))
header = next(reader)
print(header, list(reader))       # ['name', 'city'] [['Asha', 'Pune, MH'], ['Ravi', 'Say "hi"']]

raw = "name,score\nasha,91\nravi,84\n"
scores = [int(r["score"]) for r in csv.DictReader(io.StringIO(raw))]
print(sum(scores) / len(scores))  # 87.5
```

```python filename:Python
import csv, io
tsv = "a\tb\n1\t2\n"
print(list(csv.reader(io.StringIO(tsv), delimiter="\t")))    # [['a', 'b'], ['1', '2']]

buf = io.StringIO()
csv.writer(buf, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n").writerow(["x", 1.5, 2])
print(buf.getvalue().strip())                                # "x",1.5,2
```

> [!WARNING] Watch out
>
> Open CSV files with `open(path, "w", newline="", encoding="utf-8")`. Without `newline=""` you get blank lines between rows on Windows. And never split lines on `,` by hand — quoted fields contain commas.

> [!NOTE] Key point
>
> Every CSV value is read as a <strong>string</strong> — convert types yourself. For heavy tabular work use pandas (`pd.read_csv`).

# pickle — Python objects as bytes

```python filename:Python
import pickle

data = {"ids": (1, 2, 3), "tags": {"py"}, "nested": [b"raw", None, 3.5]}
blob = pickle.dumps(data)                    # tuples, sets, bytes: all preserved
restored = pickle.loads(blob)
print(type(blob).__name__, restored == data, type(restored["ids"]).__name__)   # bytes True tuple
```

> [!WARNING] Security
>
> <strong>Never unpickle data from an untrusted source.</strong> A pickle can instruct the loader to call any function (via `__reduce__`), i.e. run arbitrary code. Use JSON for anything that crosses a trust boundary.

> [!NOTE] How it stores classes
>
> By <em>import path</em> (`module.ClassName`), not code — the class must be importable when loading, and renaming it breaks old pickles.

> [!NOTE] Good uses
>
> Caching intermediate results, passing objects between your own processes (`multiprocessing` uses pickle).

> [!NOTE] Bad uses
>
> Long-term storage, APIs, anything shared across Python versions or teams.

> [!NOTE] shelve
>
> A persistent dict backed by pickle: `with shelve.open('cache') as db: db['k'] = obj`.

# sqlite3 — a database in the standard library

```python filename:Python
import sqlite3

con = sqlite3.connect(":memory:")            # or a file path
con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
with con:                                    # commits on success, rolls back on error
    con.executemany("INSERT INTO users (name) VALUES (?)", [("Asha",), ("Ravi",)])
print(con.execute("SELECT id, name FROM users ORDER BY id").fetchall())   # [(1, 'Asha'), (2, 'Ravi')]
print(con.execute("SELECT name FROM users WHERE id = ?", (2,)).fetchone())  # ('Ravi',)
con.close()
```

> [!WARNING] Watch out
>
> Always pass values as parameters (`?`), never with f-strings — string-built SQL is an injection hole.

# Config files: TOML &amp; INI

```python filename:Python
import tomllib, configparser

cfg = tomllib.loads("""
[server]
host = "0.0.0.0"
port = 8080
debug = false

[database]
pool = { min = 1, max = 5 }
""")
print(cfg["server"]["port"], cfg["server"]["debug"], cfg["database"]["pool"]["max"])   # 8080 False 5

cp = configparser.ConfigParser()
cp.read_string("""
[app]
name = notes
workers = 4
debug = yes
""")
print(cp["app"]["name"], cp.getint("app", "workers"), cp.getboolean("app", "debug"))   # notes 4 True
```

> [!NOTE] Key point
>
> TOML has real types (ints, booleans, dates, arrays); INI values are all strings until you call `getint` / `getboolean`. `tomllib` (3.11+) only reads — write TOML with the third-party `tomli-w`. Use `tomllib.load` with a file opened in <strong>binary</strong> mode.

# Binary layouts with struct

```python filename:Python
import struct

# "<" little-endian, H = unsigned 16-bit, I = unsigned 32-bit, f = 32-bit float
packed = struct.pack("<HIf", 7, 65536, 1.5)
print(len(packed), packed.hex())             # 10 0700000001000000c03f
print(struct.unpack("<HIf", packed))         # (7, 65536, 1.5)
print(struct.calcsize("<HIf"), struct.calcsize("HIf"))   # 10 12   ← native mode adds alignment padding
```

```question
JSON vs pickle — when would you use each?

---

JSON for data exchanged with other programs or stored long-term: it's text, language-neutral and safe to parse. Pickle only for short-lived, trusted, Python-to-Python data (caches, IPC) — it handles almost any Python object but is insecure and version-fragile.
```

```question
How do you serialize a datetime or a custom object to JSON?

---

Pass `default=` to `json.dumps` — a function that converts unsupported objects (e.g. `dt.isoformat()`, `dataclasses.asdict(obj)`) — or subclass `json.JSONEncoder`. Decode with `object_hook=` to turn the dicts back into rich types.
```
