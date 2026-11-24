---
id: 9fe1e504-eb55-78d2-8a54-2ee56da29656
key: topic:python/packaging
subject: python
topic: packaging
title: Virtual Environments, pip & Packaging
slug: virtual-environments-pip-packaging
order: 1
---

Isolate each project's dependencies in a virtual environment, pin them for reproducible installs, and describe your own project in `pyproject.toml` so it can be installed and published.

> [!INFO]
>
> <strong>Virtual environment</strong> — a directory with its own `python` executable and `site-packages`. Packages installed while it's active go there, not into the system Python — so two projects can use different versions of the same library.

# The venv lifecycle

```filename:Terminal
$ python3 -m venv .venv                   # create (once per project; don't commit it)
$ source .venv/bin/activate               # activate — Windows: .venv\Scripts\activate
(.venv) $ which python                    # → /path/to/project/.venv/bin/python
(.venv) $ python -m pip install --upgrade pip
(.venv) $ pip install "requests>=2.31" pytest
(.venv) $ deactivate                      # back to the system Python
$ rm -rf .venv                            # environments are disposable: delete & recreate
```

```python filename:Python
import sys
print("inside a venv:", sys.prefix != sys.base_prefix)   # True inside a venv, False otherwise
print(sys.version_info >= (3, 10))                      # True
```

> [!NOTE] Key point
>
> Activation only prepends `.venv/bin` to `PATH`. You can skip it entirely by calling the interpreter directly: `.venv/bin/python -m pytest`. Add `.venv/` to `.gitignore`.

# pip essentials

| Command | Does |
| --- | --- |
| `pip install pkg` | Install the latest compatible version (plus dependencies) |
| `pip install "pkg==1.4.2"` | Install an exact version |
| `pip install -U pkg` | Upgrade |
| `pip uninstall pkg` | Remove (dependencies stay installed) |
| `pip list` / `pip list --outdated` | What's installed / what can be upgraded |
| `pip show pkg` | Version, location, dependencies of one package |
| `pip freeze > requirements.txt` | Exact versions of everything installed |
| `pip install -r requirements.txt` | Install from a requirements file |
| `pip install -e .` | Editable install of the current project |

> [!WARNING] Watch out
>
> Prefer `python -m pip …` over bare `pip`: it guarantees you're installing into the interpreter you think you are. And never `sudo pip install` into the system Python.

# Version specifiers

| Specifier | Means |
| --- | --- |
| `==1.4.2` | Exactly 1.4.2 |
| `>=1.4,<2` | At least 1.4, below 2.0 |
| `~=1.4.2` | Compatible release: `>=1.4.2, ==1.4.*` |
| `~=1.4` | `>=1.4, ==1.*` (i.e. below 2.0) |
| `!=1.5.0` | Anything except 1.5.0 |
| `requests[socks]` | Install with an optional <em>extra</em> |
| `tomli; python_version < "3.11"` | Environment marker — only on older Pythons |

# requirements.txt vs lock files

> [!NOTE] Library
>
> Declares <strong>loose</strong> ranges (`requests>=2.28`) in `pyproject.toml` so it can coexist with other packages.

> [!NOTE] Application
>
> Pins <strong>exact</strong> versions of every package, including transitive ones, for reproducible deploys.

> [!NOTE] requirements.txt
>
> A plain list, often produced by `pip freeze` or `pip-compile`. No hashes by default.

> [!NOTE] Lock files
>
> `uv.lock`, `poetry.lock`, `pylock.toml` (PEP 751): exact versions + hashes for every platform, generated from your declared ranges.

# pyproject.toml

```python filename:pyproject.toml
[project]
name = "lvn-notes"
version = "0.3.0"
description = "Study notes toolkit"
readme = "README.md"
requires-python = ">=3.10"
dependencies = ["requests>=2.31", "rich~=13.7"]

[project.optional-dependencies]
dev = ["pytest>=8", "mypy", "ruff"]

[project.scripts]
lvn = "lvn_notes.cli:main"          # installs an `lvn` command

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
```

It's plain TOML, so the standard library can read it:

```python filename:Python
import tomllib

text = """
[project]
name = "lvn-notes"
requires-python = ">=3.10"
dependencies = ["requests>=2.31", "rich~=13.7"]
[project.scripts]
lvn = "lvn_notes.cli:main"
"""
meta = tomllib.loads(text)["project"]
print(meta["name"], meta["dependencies"])   # lvn-notes ['requests>=2.31', 'rich~=13.7']
print(tomllib.loads(text)["project"]["scripts"]["lvn"])   # lvn_notes.cli:main
```

# Project layout, editable installs &amp; publishing

```filename:src%20layout
lvn-notes/
├── pyproject.toml
├── README.md
├── src/
│   └── lvn_notes/
│       ├── __init__.py
│       └── cli.py
└── tests/
    └── test_cli.py
```

```filename:Terminal
(.venv) $ pip install -e ".[dev]"      # editable: code changes apply without reinstalling
(.venv) $ python -m pip install build twine
(.venv) $ python -m build              # → dist/lvn_notes-0.3.0.tar.gz and .whl
(.venv) $ twine upload dist/*          # publish to PyPI (use TestPyPI first)
```

> [!NOTE] Key point
>
> The `src/` layout stops tests from accidentally importing the package from the working directory — they must use the installed version, exactly like your users.

| Artifact | What it is |
| --- | --- |
| sdist (`.tar.gz`) | Source distribution — built on the user's machine |
| wheel (`.whl`) | Pre-built zip that installs by just unpacking — fast; platform-specific if it contains C extensions |

# The tool landscape

| Tool | Role |
| --- | --- |
| `venv` + `pip` | Built in. Enough for most projects |
| <strong>uv</strong> | Very fast Rust replacement for pip / venv / pip-tools; manages Python versions and `uv.lock` (`uv add`, `uv run`) |
| <strong>Poetry</strong> | Dependency management + lock file + build/publish in one tool |
| <strong>pipx</strong> | Installs CLI <em>applications</em> (black, httpie) each in its own isolated venv |
| <strong>conda</strong> | Environments with non-Python binaries too (CUDA, MKL) — popular in data science |
| <strong>pyenv</strong> | Install and switch between several Python versions |
| <strong>pip-tools</strong> | `pip-compile` turns loose `requirements.in` into pinned `requirements.txt` |

```question
Why use a virtual environment?

---

To isolate each project's dependencies: different projects can need different versions of the same library, and installing into the system Python can break OS tools. A venv also makes the dependency list explicit and reproducible.
```

```question
What is the difference between pip freeze output and pyproject.toml dependencies?

---

`pyproject.toml` lists the <em>direct</em> dependencies with compatible ranges — what your code needs. `pip freeze` lists <em>every</em> installed package at its exact version — a snapshot for reproducing one environment.
```

```question
What does pip install -e . do?

---

An editable (development) install: the package is registered in the environment but points at your source folder, so edits take effect immediately without reinstalling.
```
