---
id: 46c63463-3061-790a-a6d6-ba2749704f17
key: topic:c/error-handling
subject: c
topic: error-handling
title: "Error Handling: errno & Return Codes"
slug: error-handling-errno-return-codes
order: 1
---

C has no exceptions. Functions report failure through their <strong>return value</strong> (`NULL`, `-1`, `EOF`), and the library adds detail in the global `errno`. Checking every result is the programmer’s job.

# Library conventions

| Function kind | Failure signal | Details |
| --- | --- | --- |
| Returns a pointer (`fopen`, `malloc`) | `NULL` | `errno` set (by POSIX) |
| Returns a count (`fread`, `scanf`) | Fewer items than requested / `EOF` | `feof` / `ferror` |
| POSIX system calls (`open`, `read`) | `-1` | `errno` |
| Conversions (`strtol`) | Result + `end` pointer | `errno == ERANGE` on overflow |
| Math (`sqrt(-1)`, `log(0)`) | NaN / ±HUGE\_VAL | `errno == EDOM` / `ERANGE` (if `math_errhandling` says so) |

# errno, strerror, perror

```c filename:C
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>

int main(void) {
    FILE *f = fopen("does-not-exist.txt", "r");
    if (f == NULL) {
        int saved = errno;                 /* save it: the next call may overwrite it */
        printf("fopen failed: errno=%d (%s)\n", saved, strerror(saved));
        printf("is ENOENT? %s\n", saved == ENOENT ? "yes" : "no");
        perror("fopen");                   /* prints "fopen: No such file..." to stderr */
    }

    errno = 0;                             /* strtol only sets errno on error: reset first */
    long v = strtol("99999999999999999999", NULL, 10);
    if (errno == ERANGE) printf("overflow, clamped to %ld\n", v);
    return 0;
}
```

```text filename:Output
fopen failed: errno=2 (No such file or directory)
is ENOENT? yes
overflow, clamped to 9223372036854775807
```

> [!WARNING] Watch out
>
> `errno` is only meaningful right after a function has <em>reported</em> failure. Successful calls may leave any value in it, so never test `errno` alone to detect an error.

# Designing your own error reporting

```c filename:C
#include <stdio.h>

typedef enum { ERR_OK = 0, ERR_EMPTY, ERR_RANGE, ERR_PARSE } Err;

const char *err_str(Err e) {
    static const char *msg[] = {"ok", "empty input", "out of range", "not a number"};
    return msg[e];
}

/* return the status; deliver the result through an out-parameter */
Err parse_percent(const char *s, int *out) {
    if (!s || !*s) return ERR_EMPTY;
    int v = 0;
    for (; *s; s++) {
        if (*s < '0' || *s > '9') return ERR_PARSE;
        v = v * 10 + (*s - '0');
        if (v > 100) return ERR_RANGE;
    }
    *out = v;
    return ERR_OK;
}

int main(void) {
    const char *inputs[] = {"42", "", "250", "4x"};
    for (int i = 0; i < 4; i++) {
        int p;
        Err e = parse_percent(inputs[i], &p);
        if (e == ERR_OK) printf("'%s' -> %d%%\n", inputs[i], p);
        else printf("'%s' -> error: %s\n", inputs[i], err_str(e));
    }
    return 0;
}
```

```text filename:Output
'42' -> 42%
'' -> error: empty input
'250' -> error: out of range
'4x' -> error: not a number
```

# Cleanup with goto

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int process(const char *path) {
    int rc = -1;
    char *buf = NULL;
    FILE *f = fopen(path, "w+");
    if (!f) goto out;

    buf = malloc(64);
    if (!buf) goto close_file;

    if (fputs("data\n", f) == EOF) goto free_buf;
    rewind(f);
    if (!fgets(buf, 64, f)) goto free_buf;
    printf("read back: %s", buf);
    rc = 0;                                 /* success */

free_buf:                                   /* release in reverse order of acquisition */
    free(buf);
close_file:
    fclose(f);
out:
    return rc;
}

int main(void) {
    printf("rc = %d\n", process("work.txt"));
    printf("rc = %d\n", process("no-such-dir/work.txt"));
    return 0;
}
```

```text filename:Output
read back: data
rc = 0
rc = -1
```

# Terminating

| Call | Effect |
| --- | --- |
| `return n;` from `main` | Same as `exit(n)` |
| `exit(status)` | Runs `atexit` handlers, flushes and closes streams, then ends the process |
| `_Exit(status)` / `_exit` | Ends immediately — no handlers, no flushing |
| `abort()` | Raises `SIGABRT` — abnormal termination, core dump; used by `assert` |
| `quick_exit` (C11) | Runs `at_quick_exit` handlers only |

```question
How do you handle errors in C without exceptions?

---

Return a status code (or `NULL`/`-1`) from every fallible function and pass results through out-parameters; check every return value; propagate errors upward; use `errno` / `strerror` for library failures; and structure cleanup with the `goto cleanup` pattern so each resource is released exactly once on every path. `setjmp`/`longjmp` exist for non-local jumps but skip cleanup and are rarely appropriate.
```

```question
Is errno thread-safe?

---

Yes on modern systems: since C11, `errno` is a macro that expands to a <em>thread-local</em> lvalue (often `(*__errno_location())`), so each thread has its own copy.
```
