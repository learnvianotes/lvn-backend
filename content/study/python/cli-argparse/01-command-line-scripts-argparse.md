---
id: 327d73a6-f94b-7bc4-9770-05ef06a8e959
key: topic:python/cli-argparse
subject: python
topic: cli-argparse
title: Command-Line Scripts & argparse
slug: command-line-scripts-argparse
order: 1
---

Turning a Python file into a proper command-line tool: a `main()` entry point, arguments parsed with `argparse`, clean exit codes and input from files or stdin.

# The script skeleton

```python filename:Python
#!/usr/bin/env python3
"""wordcount — count words in text files."""
import argparse
import sys


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Count words in text files.")
    parser.add_argument("files", nargs="+", help="files to read")
    parser.add_argument("-n", "--top", type=int, default=5, help="how many words to show")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    ...                       # do the work
    return 0                  # exit code: 0 = success


if __name__ == "__main__":
    raise SystemExit(main())
```

> [!NOTE] Shebang
>
> `#!/usr/bin/env python3` + `chmod +x wordcount.py` lets you run `./wordcount.py` directly on macOS/Linux.

> [!NOTE] main(argv=None)
>
> Taking `argv` as a parameter makes the CLI testable: `main(["a.txt", "-n", "3"])`.

> [!NOTE] Exit codes
>
> Return 0 on success and non-zero on failure — shells, CI and `&&` chains depend on it.

> [!NOTE] Entry points
>
> Packaged tools declare `[project.scripts] wordcount = "pkg.cli:main"` in `pyproject.toml`.

# sys.argv — the raw arguments

```python filename:Python
import sys

saved = sys.argv
sys.argv = ["greet.py", "Asha", "--loud"]    # what the shell would pass for: python greet.py Asha --loud
name = sys.argv[1]
loud = "--loud" in sys.argv[2:]
print(("HELLO " if loud else "hello ") + name)   # HELLO Asha
sys.argv = saved
```

> [!NOTE] Key point
>
> `sys.argv` is fine for one or two arguments. As soon as you have options, defaults, types or `--help`, switch to `argparse`.

# argparse — positional, optional, flags

```python filename:Python
import argparse

parser = argparse.ArgumentParser(prog="resize")
parser.add_argument("image")                                      # positional, required
parser.add_argument("-w", "--width", type=int, required=True)     # option with a value
parser.add_argument("--format", choices=["png", "jpg"], default="png")
parser.add_argument("-q", "--quiet", action="store_true")         # flag: True if present
parser.add_argument("-v", "--verbose", action="count", default=0) # -vv → 2
parser.add_argument("--tag", action="append", default=[])         # repeatable
parser.add_argument("extra", nargs="*")                           # zero or more

args = parser.parse_args(["cat.png", "-w", "300", "-vv", "--tag", "a", "--tag", "b", "x", "y"])
print(args.image, args.width, args.format, args.quiet)   # cat.png 300 png False
print(args.verbose, args.tag, args.extra)                # 2 ['a', 'b'] ['x', 'y']
print(vars(args)["width"] * 2)                           # 600
```

| Option | Meaning |
| --- | --- |
| `type=int` / `float` / `Path` / any callable | Convert (and validate) the string |
| `default=…` | Value when the option is absent |
| `required=True` | Make an option mandatory |
| `choices=[…]` | Restrict to allowed values |
| `nargs="?" / "*" / "+" / 2` | Optional one / any number / at least one / exactly two |
| `action="store_true"` | Boolean flag |
| `action="count"` | Count repetitions (`-vvv`) |
| `action="append"` | Collect repeated options into a list |
| `dest="name"`, `metavar="N"` | Attribute name / how the value is shown in help |

# Errors and --help for free

```python filename:Python
import argparse, io, contextlib

parser = argparse.ArgumentParser(prog="resize")
parser.add_argument("-w", "--width", type=int, required=True)

err = io.StringIO()
try:
    with contextlib.redirect_stderr(err):
        parser.parse_args(["-w", "wide"])
except SystemExit as e:
    print("exit code", e.code)                          # exit code 2
print(err.getvalue().strip().splitlines()[-1])
# resize: error: argument -w/--width: invalid int value: 'wide'
```

```text filename:Output
exit code 2
resize: error: argument -w/--width: invalid int value: 'wide'
```

```text filename:Terminal
$ python resize.py --help
usage: resize [-h] -w WIDTH [--format {png,jpg}] [-q] [-v] image

positional arguments:
  image

options:
  -h, --help            show this help message and exit
  -w, --width WIDTH
  --format {png,jpg}
  -q, --quiet
  -v, --verbose
```

# Subcommands (git-style)

```python filename:Python
import argparse

parser = argparse.ArgumentParser(prog="todo")
sub = parser.add_subparsers(dest="command", required=True)

add = sub.add_parser("add", help="add a task")
add.add_argument("text")
add.add_argument("--priority", type=int, default=3)

done = sub.add_parser("done", help="complete a task")
done.add_argument("id", type=int)

print(vars(parser.parse_args(["add", "buy milk", "--priority", "1"])))
# {'command': 'add', 'text': 'buy milk', 'priority': 1}
print(vars(parser.parse_args(["done", "7"])))    # {'command': 'done', 'id': 7}
```

```text filename:Output
{'command': 'add', 'text': 'buy milk', 'priority': 1}
{'command': 'done', 'id': 7}
```

# Reading input: files or stdin

```python filename:Python
import io, sys

def count_lines(stream) -> int:
    return sum(1 for line in stream if line.strip())

saved = sys.stdin
sys.stdin = io.StringIO("alpha\n\nbeta\ngamma\n")    # pretend: cat notes.txt | python count.py
print(count_lines(sys.stdin))                              # 3
sys.stdin = saved
```

```filename:Terminal
$ python count.py notes.txt            # read a file named on the command line
$ cat notes.txt | python count.py      # or read from a pipe
$ python count.py < notes.txt          # or from a redirect
$ python count.py notes.txt && echo ok # exit code 0 lets the chain continue
```

> [!NOTE] Key point
>
> `fileinput.input()` iterates over the lines of every file named in `sys.argv[1:]`, or stdin if there are none — the classic Unix-filter behaviour in one line.

> [!NOTE] click / typer
>
> Third-party libraries that build CLIs from decorators or type hints — nicer for big tools.

> [!NOTE] rich
>
> Colour, tables and progress bars in the terminal.

```question
Why use raise SystemExit(main()) instead of just calling main()?

---

It turns `main`'s return value into the process exit code, so shells and CI can tell success (0) from failure. Keeping logic in `main(argv)` also makes it importable and testable.
```

```question
How does argparse report errors?

---

It prints a usage line and an error message to stderr and exits with status 2 (by raising `SystemExit`). `--help` prints help and exits with 0.
```
