---
id: 83c5dde4-0e13-7a18-b746-f64a1b90de51
key: topic:c/string-functions
subject: c
topic: string-functions
title: string.h Functions
slug: string-h-functions
order: 1
---

`<string.h>` provides string (`str…`) and raw memory (`mem…`) functions. None of them allocate memory or check destination sizes — you supply buffers big enough.

| Function | Does | Notes |
| --- | --- | --- |
| `strlen(s)` | Length excluding `\0` | O(n) |
| `strcpy(d, s)` / `strncpy(d, s, n)` | Copy | `strcpy` overflows if `d` is too small; `strncpy` may <strong>not</strong> NUL-terminate |
| `strcat(d, s)` / `strncat(d, s, n)` | Append | `strncat` always terminates; `n` = max chars to append |
| `strcmp(a, b)` / `strncmp` | Compare | &lt;0, 0, &gt;0 — not just −1/0/1 |
| `strchr(s, c)` / `strrchr` | First / last occurrence of a char | Returns pointer or `NULL` |
| `strstr(h, n)` | Find substring | Pointer or `NULL` |
| `strspn` / `strcspn` | Length of prefix made of / not made of a set | `s[strcspn(s, "\n")] = 0` strips a newline |
| `strtok(s, delims)` | Split into tokens | Modifies `s`, keeps hidden static state — not reentrant |
| `memcpy(d, s, n)` | Copy `n` bytes | Regions must <strong>not</strong> overlap |
| `memmove(d, s, n)` | Copy `n` bytes | Overlap-safe |
| `memset(p, byte, n)` | Fill bytes | Sets <em>bytes</em>, not ints |
| `memcmp(a, b, n)` | Compare bytes | Don’t use on structs (padding bytes) |

# Copy, concatenate, compare

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    char buf[32];
    strcpy(buf, "Hello");
    strcat(buf, ", ");
    strncat(buf, "world!!!", 6);          /* append at most 6 chars */
    printf("%s (%zu)\n", buf, strlen(buf));

    printf("%d %d %d\n", strcmp("apple", "apple") == 0,
           strcmp("apple", "banana") < 0, strcmp("b", "a") > 0);
    printf("%d\n", strncmp("prefix-match", "prefix-other", 6) == 0);
    return 0;
}
```

```text filename:Output
Hello, world! (13)
1 1 1
1
```

# Searching

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    const char *path = "/usr/local/bin/gcc";
    const char *slash = strrchr(path, '/');
    printf("file: %s\n", slash + 1);
    printf("dir length: %td\n", slash - path);

    const char *hit = strstr(path, "local");
    printf("found \"local\" at index %td\n", hit - path);
    printf("%s\n", strchr(path, 'z') == NULL ? "no z" : "has z");
    printf("vowel-free prefix of \"strength\": %zu\n", strcspn("strength", "aeiou"));
    return 0;
}
```

```text filename:Output
file: gcc
dir length: 14
found "local" at index 5
no z
vowel-free prefix of "strength": 3
```

# Tokenising with strtok

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    char csv[] = "name,,age;city";              /* must be writable */
    for (char *tok = strtok(csv, ",;"); tok; tok = strtok(NULL, ",;"))
        printf("[%s] ", tok);                    /* empty fields are skipped */
    printf("\n");
    return 0;
}
```

```text filename:Output
[name] [age] [city]
```

# Memory functions

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    int a[5] = {1, 2, 3, 4, 5}, b[5];
    memcpy(b, a, sizeof a);                  /* copy the whole array */

    memmove(a + 1, a, 3 * sizeof a[0]);      /* overlapping shift right */
    for (int i = 0; i < 5; i++) printf("%d ", a[i]);
    printf("\n");

    memset(b, 0, sizeof b);                  /* zero is safe for any type */
    printf("%d %d\n", b[0], b[4]);

    int ones[2];
    memset(ones, 1, sizeof ones);            /* sets BYTES to 1: 0x01010101 */
    printf("%d\n", ones[0]);
    return 0;
}
```

```text filename:Output
1 1 2 3 5
0 0
16843009
```

# Buffer overflow with strcpy

```c filename:C%20%E2%80%94%20stack-buffer-overflow%20caught%20by%20AddressSanitizer
#include <stdio.h>
#include <string.h>

int main(void) {
    char small[8];
    const char *input = "this is far too long";
    strcpy(small, input);          /* writes 21 bytes into 8 */
    printf("%s\n", small);
    return 0;
}
```

```c filename:C%20%E2%80%94%20the%20safe%20version
#include <stdio.h>
#include <string.h>

int main(void) {
    char small[8];
    const char *input = "this is far too long";
    snprintf(small, sizeof small, "%s", input);   /* truncates, always terminates */
    printf("%s\n", small);
    return 0;
}
```

```text filename:Output
this is
```

> [!WARNING] Watch out
>
> `strncpy(d, s, n)` does <strong>not</strong> add `'\0'` when `s` has `n` or more characters, and it pads with zeros otherwise. Prefer `snprintf(d, size, "%s", s)` or set `d[n - 1] = '\0'` yourself.

```question
What is the difference between memcpy and memmove?

---

Both copy `n` bytes. `memcpy` assumes the source and destination do not overlap (undefined behaviour if they do), so it can copy in any order and is slightly faster. `memmove` handles overlap correctly, as if copying through a temporary buffer.
```

```question
Why is strtok considered unsafe?

---

It modifies the input string (writes `\0` over delimiters), cannot be used on string literals, and keeps a hidden static pointer between calls — so it is not thread-safe and you cannot tokenise two strings at once. POSIX `strtok_r` takes the state as a parameter.
```
