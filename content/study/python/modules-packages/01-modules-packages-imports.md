---
id: 9f7f9a73-3504-7f72-89df-771a25b24273
key: topic:python/modules-packages
subject: python
topic: modules-packages
title: Modules, Packages & Imports
slug: modules-packages-imports
order: 1
---

A module is a `.py` file; a package is a folder of modules. `import` finds, runs and caches them — understanding that cycle explains `__name__`, circular imports and `sys.modules`.

# Importing

```python filename:Python
import math                          # whole module
from collections import Counter      # one name
import datetime as dt                # alias
print(math.sqrt(16), Counter("aab")["a"], dt.date(2026, 1, 1).year)   # 4.0 2 2026
```

1. <strong>Check the cache</strong>

   If the name is already in `sys.modules`, that module object is returned immediately.

2. <strong>Find</strong>

   Otherwise Python searches `sys.path`: the script's folder, `PYTHONPATH`, the standard library, then `site-packages`.

3. <strong>Execute once</strong>

   A new module object is created and the file's top-level code runs in its namespace.

4. <strong>Cache &amp; bind</strong>

   The module is stored in `sys.modules` and the name is bound in the importing namespace.

| Form | Binds | Use when |
| --- | --- | --- |
| `import json` | `json` | Default — the call site shows where names come from (`json.dumps`) |
| `import numpy as np` | `np` | Conventional short aliases |
| `from pathlib import Path` | `Path` | Names you use a lot |
| `from os import *` | Every public name | Almost never — pollutes the namespace and hides origins |

# Imports run once and are cached

```python filename:Python
import importlib, sys, tempfile
from pathlib import Path

folder = tempfile.mkdtemp()
Path(folder, "lvn_greet.py").write_text('print("module body runs")\nVALUE = 1\n')
sys.path.insert(0, folder)

import lvn_greet                  # runs the file: prints "module body runs"
import lvn_greet                  # cached in sys.modules: nothing printed
print("lvn_greet" in sys.modules, lvn_greet.VALUE)

lvn_greet.VALUE = 99
importlib.reload(lvn_greet)       # re-executes the file (prints again), resetting VALUE
print(lvn_greet.VALUE)

sys.path.remove(folder)
del sys.modules["lvn_greet"]
```

```text filename:Output
module body runs
True 1
module body runs
1
```

> [!NOTE] Key point
>
> Because a module runs once, module-level variables act like singletons — every importer shares the same object. It's also why top-level side effects (connecting to a DB, printing) happen at import time: keep them out of importable modules.

# `if __name__ == "__main__":`

```python filename:Python
# utils.py
def add(a, b):
    return a + b

if __name__ == "__main__":    # True only when run directly: python utils.py
    print(add(2, 3))          # 5
```

> [!NOTE] Key point
>
> When the file is imported, `__name__` is `"utils"`, so the demo code doesn't run. Use this guard for scripts, tests and anything with side effects.

# Module attributes

```python filename:Python
import json, os

print(json.__name__, os.path.__name__)                   # json posixpath
print(json.__file__.endswith("json/__init__.py"))        # True   ← json is a package
print(json.__doc__.splitlines()[0])                      # JSON (JavaScript Object Notation) <https://json.org> is a subset of
print(__name__)                                          # __main__
```

| Attribute | Holds |
| --- | --- |
| `__name__` | The module's import name (`"__main__"` for the script being run) |
| `__file__` | Path of the source file (absent for built-in modules like `sys`) |
| `__doc__` | The module docstring — the first string literal in the file |
| `__all__` | Names exported by `from module import *` |
| `__path__` | Only on packages: where to look for submodules |

# `__all__` and `import *`

```python filename:Python
import sys, tempfile
from pathlib import Path

folder = tempfile.mkdtemp()
Path(folder, "lvn_shapes.py").write_text(
    "__all__ = ['area']\n"
    "def area(r): return 3 * r * r\n"
    "def debug(): pass\n"
    "def _helper(): pass\n"
)
sys.path.insert(0, folder)
from lvn_shapes import *
print("area" in dir(), "debug" in dir(), "_helper" in dir())   # True False False
sys.path.remove(folder)
```

Without `__all__`, `import *` brings in every name that doesn't start with `_`. With it, only the listed names — `__all__` is how a module declares its public API.

# Packages

```filename:Layout
shop/
├── __init__.py        # marks a regular package; runs on "import shop"
├── __main__.py        # runs on "python -m shop"
├── cart.py
└── payments/
    ├── __init__.py
    └── upi.py

from shop.cart import Cart            # absolute import (preferred)
from .cart import Cart                # relative import (only inside the package)
from ..payments import upi            # two dots = parent package
```

> [!NOTE] __init__.py
>
> Runs when the package is imported. Often empty, or re-exports the public API: `from .cart import Cart`.

> [!NOTE] Namespace packages
>
> A folder <strong>without</strong> `__init__.py` still imports (PEP 420) and can be split across several directories — used by big plugin ecosystems. Prefer regular packages for your own code.

> [!NOTE] Relative imports
>
> `from . import x` works only inside a package; running such a file directly (`python shop/cart.py`) fails — use `python -m shop.cart`.

> [!NOTE] python -m pkg.mod
>
> Runs a module as a script with the right `sys.path`. `python -m http.server`, `python -m json.tool`, `python -m venv`, `python -m pip`.

# Importing by name: importlib

```python filename:Python
import importlib

mod = importlib.import_module("json")                     # module name as a string
print(mod.dumps([1, 2]))                                  # [1, 2]

plugin = "collections"                                    # e.g. read from a config file
Counter = getattr(importlib.import_module(plugin), "Counter")
print(Counter("aab")["a"])                                # 2
```

# Circular imports

`a.py` imports `b`, and `b.py` imports `a`. The second import finds `a` <strong>half-initialised</strong> in `sys.modules`, so names defined later in `a` don't exist yet.

```text filename:Typical%20error
ImportError: cannot import name 'User' from partially initialized module 'models'
(most likely due to a circular import)
```

1. <strong>Restructure</strong>: move the shared code into a third module both can import (usually the real fix).
2. Import the <strong>module</strong>, not the name: `import models` and use `models.User` at call time.
3. Move the import <strong>inside the function</strong> that needs it (deferred import).
4. For type hints only, guard with `if typing.TYPE_CHECKING:` and use string annotations.

# Virtual environments

Each project should install its dependencies into its own virtual environment — see <strong>Virtual Environments, pip &amp; Packaging</strong> for the full workflow.

```filename:Terminal
$ python3 -m venv .venv && source .venv/bin/activate
(.venv) $ pip install requests
```

```question
What happens when you import a module twice?

---

The first import finds, executes and caches it in `sys.modules`; the second just returns the cached module object — the file doesn't run again. `importlib.reload` forces re-execution.
```

```question
How do you fix a circular import?

---

Best: move the shared pieces into a separate module. Otherwise import the module rather than names from it, defer the import into a function, or use `TYPE_CHECKING` for imports needed only by type hints.
```
