---
id: ec271287-b156-79fe-b0a4-96e15db17d38
key: topic:cpp/chrono
subject: cpp
topic: chrono
title: Time with <chrono>
slug: time-with-chrono
order: 1
---

`<chrono>` models time with types: <em>durations</em> (`5s`, `250ms`), <em>time points</em> (a clock reading) and <em>clocks</em>. Units are checked at compile time — no more “was that seconds or milliseconds?”.

# Durations

```cpp filename:C%2B%2B
#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono_literals;
    using namespace std::chrono;

    auto timeout = 2s + 500ms;                         // std::chrono::milliseconds (2500)
    std::cout << timeout.count() << "ms\n";

    seconds s = duration_cast<seconds>(timeout);        // lossy conversion must be explicit
    std::cout << s.count() << "s\n";

    minutes m = 90min;
    hours h = duration_cast<hours>(m);
    std::cout << h.count() << "h " << (m - h).count() << "min\n";

    duration<double> secs = timeout;                    // floating-point seconds: implicit is fine
    std::cout << secs.count() << '\n';
    std::cout << (1h > 59min) << '\n';
}
```

```text filename:Output
2500ms
2s
1h 30min
2.5
1
```

# Measuring elapsed time

```cpp filename:C%2B%2B
#include <chrono>
#include <iostream>
#include <numeric>
#include <vector>

int main() {
    auto start = std::chrono::steady_clock::now();       // monotonic: right clock for measuring
    std::vector<long long> v(1'000'000);
    std::iota(v.begin(), v.end(), 1);
    long long sum = std::accumulate(v.begin(), v.end(), 0LL);
    auto end = std::chrono::steady_clock::now();

    auto us = std::chrono::duration_cast<std::chrono::microseconds>(end - start);
    std::cout << "sum = " << sum << '\n';
    std::cout << "took " << us.count() << " us\n";      // varies run to run
}
```

| Clock | Use |
| --- | --- |
| `steady_clock` | Measuring intervals (never goes backwards) |
| `system_clock` | Wall-clock time; convertible to calendar dates / `time_t` |
| `high_resolution_clock` | Alias of one of the above — prefer `steady_clock` explicitly |

# Calendar dates (C++20)

```cpp filename:C%2B%2B
#include <chrono>
#include <format>
#include <iostream>

int main() {
    using namespace std::chrono;
    year_month_day launch = 2024y / March / 15;
    sys_days d = launch;
    sys_days later = d + days(30);
    std::cout << std::format("{} -> {}\n", launch, year_month_day{later});
    std::cout << weekday{d} << ' ' << (2024y).is_leap() << '\n';
    std::cout << std::format("{}\n", 1500ms);
}
```

```text filename:Output
2024-03-15 -> 2024-04-14
Fri 1
1500ms
```

```question
Why use std::chrono instead of plain integers for time?

---

The unit is part of the type, so `sleep_for(5)` doesn't compile (5 what?) but `sleep_for(5s)` does, and conversions between units are exact and automatic when lossless (`2s` → `2000ms`) but must be explicit when lossy (`duration_cast`). That eliminates a whole class of unit bugs at zero run-time cost.
```
