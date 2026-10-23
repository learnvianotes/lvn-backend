---
id: 26ea6640-6af9-767b-8c3f-e912e13258c2
key: topic:c/best-practices
subject: c
topic: best-practices
title: Best Practices & Tooling
slug: best-practices-tooling
order: 1
---

C rewards discipline. These habits and tools prevent most of the bugs covered in these notes.

# Compile and test

| Practice | How |
| --- | --- |
| Maximum warnings | `-Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wformat=2`, and `-Werror` in CI |
| Sanitizers in debug/test builds | `-fsanitize=address,undefined` (and `thread` for concurrent code) |
| Memory checking | `valgrind --leak-check=full ./app` |
| Static analysis | `clang --analyze`, `clang-tidy`, `cppcheck`, `gcc -fanalyzer` |
| Debugger | `gdb` / `lldb` with `-g -O0`: breakpoints, `bt`, `print`, watchpoints |
| Fuzzing | libFuzzer / AFL++ for parsers and anything taking untrusted input |
| Formatting | `clang-format` — never argue about braces again |
| Hardening | `-D_FORTIFY_SOURCE=2 -O2 -fstack-protector-strong` |

# Coding habits

> [!NOTE] Initialise everything
>
> `int count = 0;`, `struct cfg c = {0};`, `char *p = NULL;`. Uninitialised reads are undefined.

> [!NOTE] Check every return value
>
> `malloc`, `fopen`, `scanf`, `fread`, `snprintf`, `strtol`… Ignoring failures turns errors into crashes elsewhere.

> [!NOTE] Carry sizes with buffers
>
> `void f(char *buf, size_t len)`. Use `snprintf`, `fgets`, `memcpy` with explicit sizes. Never `gets`, avoid `strcpy`/`sprintf`.

> [!NOTE] Clear ownership
>
> Document who frees each allocation; pair every `create` with a `destroy`; `NULL` pointers after `free`.

> [!NOTE] const and static by default
>
> `const` for read-only pointers; `static` for file-private functions and globals.

> [!NOTE] Small functions, few globals
>
> Pass state explicitly. Globals make code untestable and thread-unsafe.

> [!NOTE] Prefer functions to macros
>
> `static inline` functions and `enum` constants are type-checked; keep macros for what only macros can do.

> [!NOTE] Use the right types
>
> `size_t` for sizes, `<stdint.h>` for exact widths, `unsigned` for bits, `bool` for flags.

# A defensive pattern in one place

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char  *data;
    size_t len;
} Text;

/* returns 0 on success; on failure *out is untouched and nothing leaks */
int text_read_file(const char *path, Text *out) {
    int rc = -1;
    char *buf = NULL;
    FILE *f = fopen(path, "rb");
    if (!f) goto done;
    if (fseek(f, 0, SEEK_END) != 0) goto done;
    long size = ftell(f);
    if (size < 0) goto done;
    rewind(f);
    buf = malloc((size_t)size + 1);
    if (!buf) goto done;
    if (fread(buf, 1, (size_t)size, f) != (size_t)size) goto done;
    buf[size] = '\0';
    out->data = buf;
    out->len = (size_t)size;
    buf = NULL;                  /* ownership transferred to *out */
    rc = 0;
done:
    free(buf);                   /* free(NULL) is fine */
    if (f) fclose(f);
    return rc;
}

int main(void) {
    FILE *f = fopen("note.txt", "w");
    if (!f) return 1;
    fputs("clean C", f);
    fclose(f);

    Text t = {0};
    if (text_read_file("note.txt", &t) == 0) {
        printf("%zu bytes: %s\n", t.len, t.data);
        free(t.data);
    }
    printf("missing file -> %d\n", text_read_file("missing.txt", &t));
    return 0;
}
```

```text filename:Output
7 bytes: clean C
missing file -> -1
```

# Debugging workflow

```filename:Terminal
$ gcc -g -O0 -Wall -Wextra -fsanitize=address,undefined app.c -o app
$ ./app                       # sanitizer reports file:line of the first bad access
$ gdb ./app                   # or: lldb ./app
(gdb) break parse_line        # stop in a function
(gdb) run input.txt
(gdb) next / step / finish    # step over / into / out of
(gdb) print *node             # inspect memory
(gdb) bt                      # backtrace after a crash
(gdb) watch count             # stop when a variable changes
```

```question
How would you debug a segmentation fault?

---

Rebuild with `-g -fsanitize=address,undefined` and rerun — the sanitizer usually names the exact bad access and where the memory was allocated/freed. Otherwise run under `gdb`/`lldb` (or load the core dump) and take a backtrace (`bt`) to see the crashing line, then inspect the pointers involved. Valgrind is the alternative when you cannot recompile.
```
