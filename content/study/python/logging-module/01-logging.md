---
id: e94d00e6-f59e-75cb-a954-f7bb554b8cdc
key: topic:python/logging-module
subject: python
topic: logging-module
title: Logging
slug: logging
order: 1
---

`logging` records what a program is doing — with severity levels, timestamps and destinations you can change without touching the code. It is how production code replaces `print`.

# Why not print?

|  | `print` | `logging` |
| --- | --- | --- |
| Severity | None | `DEBUG` → `CRITICAL`, filterable |
| Destination | stdout only | Console, files, syslog, HTTP… (handlers) |
| Metadata | Only what you type | Time, module, line, thread, level (formatters) |
| Turn off / on | Edit the code | Change the level or config |
| Libraries | Pollute the user's output | Silent unless the app configures logging |

# Levels

| Level | Value | Use for |
| --- | --- | --- |
| `DEBUG` | 10 | Detailed diagnostics while developing |
| `INFO` | 20 | Normal events: started, user logged in, job finished |
| `WARNING` | 30 | Something unexpected but handled — <em>the default threshold</em> |
| `ERROR` | 40 | An operation failed |
| `CRITICAL` | 50 | The program may not be able to continue |

# Quick start

```python filename:Python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)      # one logger per module

log.debug("not shown: below INFO")
log.info("server started on port %d", 8000)
log.warning("disk %s%% full", 91)
```

```text filename:Output
2026-09-29 14:05:09,123 INFO __main__: server started on port 8000
2026-09-29 14:05:09,124 WARNING __main__: disk 91% full
```

> [!NOTE] Key point
>
> `basicConfig` configures the root logger <strong>once</strong>, at the application's entry point. Library modules only call `logging.getLogger(__name__)` and log — they never configure handlers.

# Loggers, handlers, formatters

Logger `app.db` → level filter → Handler(s) → Formatter → Output

```python filename:Python
import io, logging

stream = io.StringIO()                                   # stands in for a console or file
handler = logging.StreamHandler(stream)
handler.setFormatter(logging.Formatter("%(levelname)-7s %(name)s | %(message)s"))

log = logging.getLogger("shop.orders")
log.setLevel(logging.DEBUG)
log.addHandler(handler)
log.propagate = False                                    # don't also send to the root logger

log.debug("cart has %d items", 3)
log.info("order %s placed", "A-17")
log.getChild("payments").error("card declined")          # child logger: shop.orders.payments

for line in stream.getvalue().splitlines():
    print(line)
```

```text filename:Output
DEBUG   shop.orders | cart has 3 items
INFO    shop.orders | order A-17 placed
ERROR   shop.orders.payments | card declined
```

> [!NOTE] Logger
>
> What you call (`log.info`). Named hierarchically with dots; children pass records up to parents.

> [!NOTE] Handler
>
> Where records go: `StreamHandler`, `FileHandler`, `RotatingFileHandler`, `TimedRotatingFileHandler`, `SysLogHandler`…

> [!NOTE] Formatter
>
> How a record looks: `%(asctime)s`, `%(levelname)s`, `%(name)s`, `%(lineno)d`, `%(message)s`…

> [!NOTE] Filter
>
> Extra rules to drop or enrich records (e.g. add a request id).

# Logging exceptions

```python filename:Python
import io, logging

stream = io.StringIO()
log = logging.getLogger("demo.exc")
log.addHandler(logging.StreamHandler(stream))
log.propagate = False

try:
    1 / 0
except ZeroDivisionError:
    log.exception("could not compute ratio")      # ERROR level + full traceback

lines = stream.getvalue().splitlines()
print(lines[0])            # could not compute ratio
print(lines[1])            # Traceback (most recent call last):
print(lines[-1])           # ZeroDivisionError: division by zero
```

# Configuring a real application

```python filename:Python
import logging.config

logging.config.dictConfig({
    "version": 1,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "plain", "level": "INFO"},
        "file": {"class": "logging.handlers.RotatingFileHandler", "formatter": "plain",
                 "filename": "app.log", "maxBytes": 1_000_000, "backupCount": 3},
    },
    "loggers": {"urllib3": {"level": "WARNING"}},          # quieten a chatty library
    "root": {"level": "DEBUG", "handlers": ["console", "file"]},
})
```

# Best practices

> [!TIP] Do
>
> Pass arguments separately — `log.info("user %s", uid)` — so the string is only built if the record is actually emitted.

> [!DANGER] Avoid
>
> `log.info(f"user {uid}")` in hot paths (always formatted), logging passwords or tokens, or `except: log.error(e)` without the traceback.

- One logger per module: `log = logging.getLogger(__name__)`.
- Libraries add `logging.NullHandler()` to their top-level logger and never call `basicConfig`.
- Use `log.exception(...)` inside `except` blocks to keep the traceback.
- In services, log structured data (JSON lines) so log platforms can search fields — `python-json-logger` or `structlog`.

```question
Why is logging.getLogger(\_\_name\_\_) the recommended pattern?

---

It creates a logger named after the module (`shop.orders`), so logger names mirror the package hierarchy. Configuration can then target a whole package (`shop`) or one module, and every record shows where it came from.
```

```question
What is the default logging level?

---

`WARNING`. `debug()` and `info()` messages are dropped until you lower the level (e.g. `basicConfig(level=logging.INFO)`).
```

```question
Why use %s arguments instead of f-strings in log calls?

---

Logging formats the message lazily — only if the record passes the level check. An f-string is built on every call even when the message is discarded. `%`-style arguments also let log aggregators group identical message templates.
```
