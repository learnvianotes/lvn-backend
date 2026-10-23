---
id: cf0569df-fd7a-7264-ae7b-e57aaf8bd668
key: topic:c/file-io
subject: c
topic: file-io
title: File I/O
slug: file-i-o
order: 1
---

`<stdio.h>` works with <em>streams</em> (`FILE *`): open with `fopen`, read/write with the same family of functions you use for the console, and always `fclose`.

# Open modes

| Mode | Meaning | If file exists | If missing |
| --- | --- | --- | --- |
| `"r"` | Read | Read from start | Fails (`NULL`) |
| `"w"` | Write | <strong>Truncated to 0</strong> | Created |
| `"a"` | Append | Writes go to the end | Created |
| `"r+"` | Read + write | Kept | Fails |
| `"w+"` | Read + write | Truncated | Created |
| `"a+"` | Read + append | Kept, writes at end | Created |
| `"…b"` | Binary (`"rb"`, `"wb"`) | No newline translation (matters on Windows) |  |
| `"wx"` (C11) | Exclusive create | Fails | Created |

# Writing and reading text

```c filename:C
#include <stdio.h>

int main(void) {
    FILE *f = fopen("scores.txt", "w");
    if (f == NULL) { perror("fopen"); return 1; }
    fprintf(f, "asha 91\nravi 78\nmeera 85\n");
    fclose(f);

    f = fopen("scores.txt", "r");
    if (!f) { perror("fopen"); return 1; }
    char name[32];
    int score, total = 0, count = 0;
    while (fscanf(f, "%31s %d", name, &score) == 2) {   /* loop on the read, not on feof */
        printf("%-6s %d\n", name, score);
        total += score;
        count++;
    }
    fclose(f);
    printf("average %.1f\n", (double)total / count);
    return 0;
}
```

```text filename:Output
asha   91
ravi   78
meera  85
average 84.7
```

# Line by line with fgets, appending

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    FILE *f = fopen("log.txt", "w");
    if (!f) return 1;
    fputs("first\n", f);
    fclose(f);

    f = fopen("log.txt", "a");             /* keep existing content */
    if (!f) return 1;
    fputs("second\n", f);
    fputs("third\n", f);
    fclose(f);

    f = fopen("log.txt", "r");
    if (!f) return 1;
    char line[128];
    int n = 0;
    while (fgets(line, sizeof line, f)) {
        line[strcspn(line, "\n")] = '\0';
        printf("%d: %s\n", ++n, line);
    }
    fclose(f);
    return 0;
}
```

```text filename:Output
1: first
2: second
3: third
```

# Binary files: fwrite / fread / fseek

```c filename:C
#include <stdio.h>

typedef struct { int id; double price; } Item;

int main(void) {
    Item items[3] = {{1, 9.5}, {2, 20.0}, {3, 4.25}};
    FILE *f = fopen("items.bin", "wb");
    if (!f) return 1;
    size_t written = fwrite(items, sizeof items[0], 3, f);
    fclose(f);

    f = fopen("items.bin", "rb");
    if (!f) return 1;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);                          /* file size in bytes */
    printf("wrote %zu records, file is %ld bytes\n", written, size);

    Item it;
    fseek(f, 2 * (long)sizeof(Item), SEEK_SET);   /* random access: jump to record #2 */
    if (fread(&it, sizeof it, 1, f) == 1) printf("record 2: id=%d price=%.2f\n", it.id, it.price);
    rewind(f);
    if (fread(&it, sizeof it, 1, f) == 1) printf("record 0: id=%d\n", it.id);
    fclose(f);
    remove("items.bin");
    return 0;
}
```

```text filename:Output
wrote 3 records, file is 48 bytes
record 2: id=3 price=4.25
record 0: id=1
```

> [!WARNING] Watch out
>
> Raw `fwrite` of structs is not portable between machines: padding, endianness and type sizes differ. For interchange formats write fields explicitly in a fixed byte order.

# Character-level copy

```c filename:C
#include <stdio.h>

int copy_file(const char *src, const char *dst) {
    FILE *in = fopen(src, "rb");
    if (!in) return -1;
    FILE *out = fopen(dst, "wb");
    if (!out) { fclose(in); return -1; }
    int c;
    long bytes = 0;
    while ((c = fgetc(in)) != EOF) { fputc(c, out); bytes++; }
    int err = ferror(in) || ferror(out);
    fclose(in);
    fclose(out);
    return err ? -1 : (int)bytes;
}

int main(void) {
    FILE *f = fopen("a.txt", "w");
    if (!f) return 1;
    fputs("copy me\n", f);
    fclose(f);
    printf("copied %d bytes\n", copy_file("a.txt", "b.txt"));
    printf("missing source -> %d\n", copy_file("nope.txt", "c.txt"));
    return 0;
}
```

```text filename:Output
copied 8 bytes
missing source -> -1
```

| Function | Purpose |
| --- | --- |
| `fgetc` / `fputc` | One character |
| `fgets` / `fputs` | One line / string |
| `fscanf` / `fprintf` | Formatted text |
| `fread` / `fwrite` | Blocks of bytes (binary) |
| `fseek` / `ftell` / `rewind` | Move / query the file position |
| `feof` / `ferror` / `clearerr` | Why did the last read stop? |
| `fflush` | Push buffered output to the OS |
| `remove` / `rename` / `tmpfile` | File-system helpers |

> [!WARNING] Watch out
>
> `while (!feof(f)) { fgets(…); … }` processes the last line twice: `feof` only becomes true <em>after</em> a read has failed. Loop on the return value of the read function instead.

```question
What is the difference between text and binary mode?

---

On POSIX there is none. On Windows, text mode translates `\n` to `\r\n` on write (and back on read) and may treat Ctrl-Z as end-of-file; binary mode passes bytes through unchanged. Always use `"rb"`/`"wb"` for non-text data.
```

```question
Why must you call fclose?

---

It flushes buffered data to the file (without it, the last writes may be lost if the program crashes or calls `_exit`), releases the file descriptor (processes have a limited number) and frees the `FILE` structure. `exit` and returning from `main` close open streams, but relying on that hides bugs.
```
