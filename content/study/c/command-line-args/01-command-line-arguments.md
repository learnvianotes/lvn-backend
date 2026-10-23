---
id: e51a6ad3-8e88-7c73-8149-064213b83ad1
key: topic:c/command-line-args
subject: c
topic: command-line-args
title: Command-Line Arguments
slug: command-line-arguments
order: 1
---

`main(int argc, char *argv[])` receives the words typed after the program name: `argc` counts them, `argv` holds them as strings, and `argv[argc]` is always `NULL`.

```c filename:C%20%E2%80%94%20run%20as%3A%20.%2Fprog%20input.txt%20--verbose%2042
#include <stdio.h>

int main(int argc, char *argv[]) {
    printf("argc = %d\n", argc);
    for (int i = 0; i < argc; i++)
        printf("argv[%d] = \"%s\"\n", i, argv[i]);
    printf("argv[argc] is %s\n", argv[argc] == NULL ? "NULL" : "not NULL");
    return 0;
}
```

```text filename:Output
argc = 4
argv[0] = "./prog"
argv[1] = "input.txt"
argv[2] = "--verbose"
argv[3] = "42"
argv[argc] is NULL
```

# Converting and validating

```c filename:C%20%E2%80%94%20run%20as%3A%20.%2Fprog%2010%2020%20x7%20-5
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>

int parse_int(const char *s, long *out) {
    char *end;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (end == s || *end != '\0' || errno == ERANGE) return -1;
    *out = v;
    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s NUM...\n", argv[0]);
        return EXIT_FAILURE;
    }
    long sum = 0;
    for (int i = 1; i < argc; i++) {
        long v;
        if (parse_int(argv[i], &v) != 0) { printf("skipping '%s'\n", argv[i]); continue; }
        sum += v;
    }
    printf("sum = %ld\n", sum);
    return EXIT_SUCCESS;
}
```

```text filename:Output
skipping 'x7'
sum = 25
```

# Parsing options

```c filename:C%20%E2%80%94%20run%20as%3A%20.%2Fprog%20-n%202%20-v%20C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    int verbose = 0, count = 1;
    const char *name = "world";
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-v") == 0) verbose = 1;
        else if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) count = atoi(argv[++i]);
        else name = argv[i];
    }
    for (int i = 0; i < count; i++) printf("hello, %s\n", name);
    if (verbose) printf("(printed %d times)\n", count);
    return 0;
}
```

```text filename:Output
hello, C
hello, C
(printed 2 times)
```

> [!NOTE] Key point
>
> On POSIX systems, `getopt()` (`<unistd.h>`) and GNU `getopt_long()` handle combined flags (`-vn 2`), `--` and error messages for you.

- `argv[0]` is the program name <em>as invoked</em> — it may be a path, or anything the parent process chose.
- The shell does quoting and globbing: `./prog "a b" *.c` passes `a b` as one argument and expands `*.c` before your program starts.
- The strings in `argv` are modifiable and live until the program ends.
- Environment variables: `getenv("HOME")` from `<stdlib.h>`.

```question
What is argv\[argc\]?

---

Always a null pointer — the standard guarantees it. You can loop with `for (char **p = argv; *p; p++)` instead of counting.
```

```question
Why is argv declared as char \*argv\[\] and char \*\*argv interchangeably?

---

Because an array parameter is adjusted to a pointer: `char *argv[]` in a parameter list <em>is</em> `char **argv`. It points to the first element of an array of `char *`, each pointing to a NUL-terminated argument string.
```
