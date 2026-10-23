---
id: a4fc9d78-3e17-7d7d-9d22-b834eee1b510
key: topic:c/strings
subject: c
topic: strings
title: Strings in C
slug: strings-in-c
order: 1
---

C has no string type. A string is an array of `char` terminated by a <strong>NUL byte</strong> `'\0'` — every string function walks the bytes until it finds that terminator.

# Arrays vs pointers to literals

```c filename:C
#include <stdio.h>
#include <string.h>

int main(void) {
    char s1[] = "hello";            /* array of 6 bytes (a writable copy) */
    char s2[10] = "hi";             /* rest zero-filled */
    const char *s3 = "world";       /* pointer to a read-only literal */

    s1[0] = 'H';                    /* fine: s1 is our own array */
    printf("%s %s %s\n", s1, s2, s3);
    printf("sizeof: %zu %zu %zu\n", sizeof s1, sizeof s2, sizeof s3);
    printf("strlen: %zu %zu %zu\n", strlen(s1), strlen(s2), strlen(s3));
    return 0;
}
```

```text filename:Output
Hello hi world
sizeof: 6 10 8
strlen: 5 2 5
```

|  | `char s[] = "hello";` | `const char *p = "hello";` |
| --- | --- | --- |
| What it is | Array of 6 `char`, initialised from the literal | Pointer to a literal stored in read-only memory |
| Modifiable? | Yes | <strong>No</strong> — writing is undefined behaviour (usually a crash) |
| `sizeof` | 6 (includes `\0`) | 8 (size of a pointer) |
| Reassignable? | No (`s = "x"` is an error) | Yes (`p = "x"` points elsewhere) |

# The terminator is everything

```c filename:C
#include <stdio.h>

int main(void) {
    char word[] = {'c', 'a', 't', '\0'};    /* same as "cat" */
    printf("%s\n", word);
    word[1] = '\0';                         /* cut the string short */
    printf("%s\n", word);
    for (int i = 0; i < 4; i++) printf("%d ", word[i]);
    printf("\n");
    return 0;
}
```

```text filename:Output
cat
c
99 0 116 0
```

# Writing string functions yourself

```c filename:C
#include <stdio.h>
#include <ctype.h>

size_t my_strlen(const char *s) {
    const char *p = s;
    while (*p) p++;
    return (size_t)(p - s);
}

void reverse(char *s) {
    size_t n = my_strlen(s);
    for (size_t i = 0, j = n ? n - 1 : 0; i < j; i++, j--) {
        char t = s[i]; s[i] = s[j]; s[j] = t;
    }
}

int is_palindrome(const char *s) {
    size_t i = 0, j = my_strlen(s);
    while (i < j) {
        if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j - 1])) return 0;
        i++; j--;
    }
    return 1;
}

int count_words(const char *s) {
    int words = 0, in_word = 0;
    for (; *s; s++) {
        if (isspace((unsigned char)*s)) in_word = 0;
        else if (!in_word) { in_word = 1; words++; }
    }
    return words;
}

int main(void) {
    char buf[] = "stressed";
    reverse(buf);
    printf("%s %zu\n", buf, my_strlen(buf));
    printf("%d %d\n", is_palindrome("Racecar"), is_palindrome("hello"));
    printf("%d\n", count_words("  the quick  brown fox "));
    return 0;
}
```

```text filename:Output
desserts 8
1 0
4
```

# Converting between strings and numbers

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    char *end;
    long n = strtol("  1234xyz", &end, 10);       /* stops at the first non-digit */
    printf("%ld, rest = \"%s\"\n", n, end);
    printf("%ld %ld\n", strtol("ff", NULL, 16), strtol("101", NULL, 2));
    printf("%.2f\n", strtod("3.14159", NULL));
    printf("%d\n", atoi("42"));                   /* no error reporting at all */

    char out[32];
    int len = snprintf(out, sizeof out, "%d-%s-%.1f", 7, "ab", 2.5);
    printf("%s (%d chars)\n", out, len);
    return 0;
}
```

```text filename:Output
1234, rest = "xyz"
255 5
3.14
42
7-ab-2.5 (8 chars)
```

> [!NOTE] Key point
>
> Prefer `strtol` / `strtod` over `atoi` / `atof`: they report where parsing stopped and set `errno` to `ERANGE` on overflow. Use `snprintf` (never `sprintf`) to build strings safely.

# Pitfalls

```c filename:C%20%E2%80%94%20writing%20to%20a%20string%20literal%20(bus%20error%20%2F%20segfault%20at%20run%20time)
int main(void) {
    char *s = "hello";      /* legal in C (not C++), but the literal is read-only */
    s[0] = 'H';             /* undefined behaviour: crashes on most systems */
    return 0;
}
```

- Forgetting room for `'\0'`: `char s[5] = "hello";` compiles in C but has no terminator.
- Comparing with `==` compares <em>addresses</em> — use `strcmp`.
- Returning a pointer to a local `char` array from a function (it dies on return).
- Passing a plain `char` (possibly negative) to `isalpha` / `toupper` — cast to `unsigned char` first.

```question
What is the difference between char s\[\] = "abc" and char \*s = "abc"?

---

The first creates a 4-byte array on the stack (or in `.data`) initialised with a copy of the literal — you can modify it. The second creates a pointer to the literal itself, which lives in read-only memory; modifying it is undefined behaviour. `sizeof` gives 4 vs 8.
```

```question
How is the length of a C string determined?

---

By scanning for the NUL terminator — `strlen` is O(n). The length is not stored anywhere, which is why repeated `strlen` calls in a loop condition (`for (i = 0; i < strlen(s); i++)`) make a loop O(n²).
```
