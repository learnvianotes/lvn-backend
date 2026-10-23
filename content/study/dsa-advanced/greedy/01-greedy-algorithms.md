---
id: 389fdf42-76bf-7a26-97b8-d76afa6bf71e
key: topic:dsa-advanced/greedy
subject: dsa-advanced
topic: greedy
title: Greedy Algorithms
slug: greedy-algorithms
order: 1
---

A greedy algorithm builds a solution one piece at a time, always taking the choice that looks best <strong>right now</strong> and never revisiting it. When the problem has the right structure this is the fastest possible approach; when it does not, greedy quietly returns a wrong answer.

> [!INFO]
>
> <strong>Greedy algorithm</strong> — an algorithm that makes the <em>locally optimal</em> choice at every step, hoping (or proving) that these local choices add up to a <em>globally optimal</em> solution. There is no backtracking and no look-ahead — a choice once made is final.

# Minimum coins — the motivating example

You have an infinite supply of coins of value `10, 5, 2, 1`. Someone asks for an amount — how do you pay it with the <strong>fewest coins</strong>? The natural instinct is greedy: hand over the largest coin that still fits, repeat.

> [!TIP] Example
>
> <strong>Input:</strong> `coins = [10, 5, 2, 1], amount = 52`<br><strong>Output:</strong> `6 (10 10 10 10 10 2)`<br><strong>Input:</strong> `coins = [10, 5, 2, 1], amount = 93`<br><strong>Output:</strong> `11 (10 ×9, 2, 1)`

> [!NOTE] Idea
>
> Sort the denominations in decreasing order. For each denomination take as many coins as still fit (`amount // coin`), subtract them and move to the next smaller coin. The amount shrinks fastest when the biggest coin is used first.

```python filename:Python
def min_coins(coins, amount):
    coins = sorted(coins, reverse=True)       # largest denomination first
    picked = []
    for x in coins:
        k = amount // x                       # as many of this coin as still fit
        picked.extend([x] * k)
        amount -= k * x
        if amount == 0:
            break
    return picked

for amount in (52, 93):
    picked = min_coins([10, 5, 2, 1], amount)
    print(f"{amount} → {len(picked)} coins: {' '.join(map(str, picked))}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

vector<int> minCoins(vector<int> coins, int amount) {
    sort(coins.rbegin(), coins.rend());            // largest denomination first
    vector<int> picked;
    for (int x : coins) {
        int k = amount / x;                        // as many of this coin as still fit
        for (int j = 0; j < k; j++) picked.push_back(x);
        amount -= k * x;
        if (amount == 0) break;
    }
    return picked;
}

int main() {
    for (int amount : {52, 93}) {
        vector<int> picked = minCoins({10, 5, 2, 1}, amount);
        cout << amount << " → " << picked.size() << " coins:";
        for (int c : picked) cout << " " << c;
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class Main {
    static List<Integer> minCoins(int[] coins, int amount) {
        int[] c = coins.clone();
        Arrays.sort(c);                                   // ascending …
        List<Integer> picked = new ArrayList<>();
        for (int i = c.length - 1; i >= 0; i--) {         // … so walk it backwards: largest first
            int k = amount / c[i];                        // as many of this coin as still fit
            for (int j = 0; j < k; j++) picked.add(c[i]);
            amount -= k * c[i];
            if (amount == 0) break;
        }
        return picked;
    }

    public static void main(String[] args) {
        for (int amount : new int[]{52, 93}) {
            List<Integer> picked = minCoins(new int[]{10, 5, 2, 1}, amount);
            StringBuilder sb = new StringBuilder();
            for (int x : picked) sb.append(' ').append(x);
            System.out.println(amount + " → " + picked.size() + " coins:" + sb);
        }
    }
}
```

```javascript filename:JavaScript
function minCoins(coins, amount) {
    const sorted = [...coins].sort((a, b) => b - a);   // largest denomination first
    const picked = [];
    for (const x of sorted) {
        const k = Math.floor(amount / x);               // as many of this coin as still fit
        for (let j = 0; j < k; j++) picked.push(x);
        amount -= k * x;
        if (amount === 0) break;
    }
    return picked;
}

for (const amount of [52, 93]) {
    const picked = minCoins([10, 5, 2, 1], amount);
    console.log(`${amount} → ${picked.length} coins: ${picked.join(" ")}`);
}
```

```text filename:Output
52 → 6 coins: 10 10 10 10 10 2
93 → 11 coins: 10 10 10 10 10 10 10 10 10 2 1
```

Time O(k log k) to sort k denominations, then O(k) · Space O(1) extra

> [!NOTE] Key point
>
> This works for `10, 5, 2, 1` (and for every real currency system) because each coin is at least double the next smaller one, so a larger coin never <em>has</em> to be replaced by several smaller ones. That is a property of the input, not of greedy in general — see the counterexample below.

# General structure of a greedy algorithm

Every greedy algorithm has the same skeleton: order the candidates by some <em>selection rule</em>, then scan them once, keeping each candidate that keeps the partial solution <em>feasible</em>.

```text filename:Pseudocode%20of%20a%20greedy%20algorithm%20%E2%80%94%20a%20selection%20rule%20plus%20a%20feasibility%20check
getOptimal(items):
    res = empty solution
    while not all items considered:
        i = selectBestItem()          # the greedy choice (largest coin, earliest finish, …)
        if feasible(res + i):         # does adding i still respect the constraints?
            res = res + i
    return res
```

1. <strong>Define the selection rule</strong>

   What makes one candidate <em>look</em> better than another? Largest value, earliest finish, highest value-per-weight… This is the whole design — pick it wrong and the algorithm is wrong.

2. <strong>Sort (or use a heap)</strong>

   Usually the candidates are sorted once by the rule, costing `O(n log n)`; Huffman and Dijkstra instead pull the current best from a priority queue.

3. <strong>Scan once</strong>

   Walk the candidates in order; accept each one that is still feasible, skip the rest. No step is ever undone.

4. <strong>Prove it</strong>

   Argue that the greedy choice is always part of <em>some</em> optimal solution. Without this step you only have a heuristic.

# When greedy works — and when it fails

A greedy algorithm is correct only when the problem has two properties:

> [!NOTE] Greedy-choice property
>
> A globally optimal solution can be reached by making the locally optimal choice first — the first greedy pick is never a mistake. Proved by an <strong>exchange argument</strong>: take any optimal solution that does not contain the greedy choice, swap the greedy choice in, and show the result is no worse.

> [!NOTE] Optimal substructure
>
> After the greedy choice is made, what remains is a smaller instance of the same problem, and an optimal solution to the whole is the greedy choice plus an optimal solution to the remainder.

Change the coin system and the greedy-choice property disappears. With coins `18, 10, 1` and amount `20`, greedy grabs `18` first and is then forced to add two `1`s — three coins — while the optimum is `10 + 10`.

```python filename:Python
def greedy(coins, amount):
    count = 0
    for x in sorted(coins, reverse=True):
        count += amount // x
        amount %= x
    return count

def optimal(coins, amount):                     # dynamic programming — always correct
    best = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        for x in coins:
            if x <= a:
                best[a] = min(best[a], best[a - x] + 1)
    return best[amount]

print("greedy :", greedy([18, 1, 10], 20))     # 18 + 1 + 1
print("optimal:", optimal([18, 1, 10], 20))    # 10 + 10
```

```text filename:Output
greedy : 3
optimal: 2
```

> [!WARNING] Pitfall
>
> Greedy <em>looks</em> right on a few hand-made examples far more often than it <em>is</em> right. If you cannot state why the greedy choice is safe (an exchange argument), assume it is not and reach for dynamic programming — the 0/1 knapsack, general coin change and longest common subsequence are all problems where greedy fails.

# Where greedy is used

Greedy shines in two situations: problems with a provable greedy-choice property, where it gives the fastest exact algorithm, and hard problems where a fast <em>approximate</em> answer is good enough.

> [!NOTE] Activity selection
>
> Pick the maximum number of non-overlapping intervals — earliest finish first. Solved below.

> [!NOTE] Fractional knapsack
>
> Fill a bag of limited capacity with divisible items — highest value per weight first. Solved below.

> [!NOTE] Job sequencing
>
> Schedule unit-time jobs with deadlines for maximum profit — highest profit first. Solved below.

> [!NOTE] Huffman coding
>
> Build an optimal prefix code — repeatedly merge the two rarest symbols. Solved below.

> [!NOTE] Prim's & Kruskal's
>
> Minimum spanning tree — always add the cheapest safe edge (see Graphs).

> [!NOTE] Dijkstra's algorithm
>
> Shortest paths — always settle the closest unsettled vertex (see Graphs).

> [!NOTE] Approximation
>
> For <strong>NP-hard</strong> problems such as the Travelling Salesman Problem, greedy heuristics (nearest-neighbour, cheapest insertion) are used to get a reasonably good tour quickly, even though they do not guarantee the optimum.

# Activity selection problem

Given `n` activities with start and finish times, find the <strong>maximum number</strong> of activities a single person (or single-tasking machine) can perform — two activities can both be chosen only if they do not overlap.

> [!TIP] Example
>
> <strong>Input:</strong> `activities = [(2, 3), (1, 4), (5, 8), (6, 10)] as (start, finish)`<br><strong>Output:</strong> `2 → (2, 3) and (5, 8)`

> [!NOTE] Idea
>
> Always pick the activity that <strong>finishes earliest</strong> — it frees the machine as soon as possible and leaves the most room for the rest. Picking by shortest duration or earliest start both fail on simple counterexamples.

1. <strong>Sort by finish time</strong>

   Ascending — the activity ending first comes first.

2. <strong>Take the first activity</strong>

   It is always part of some optimal solution (exchange argument: any optimal solution's first activity can be swapped for this one without creating an overlap).

3. <strong>Scan the rest</strong>

   If the current activity starts <strong>at or after</strong> the finish of the last chosen one, choose it; otherwise it overlaps — skip it.

```text filename:Sorted%20by%20finish%20time%3B%20a%20candidate%20is%20accepted%20when%20it%20starts%20no%20earlier%20than%20the%20last%20accepted%20finish
time  1   2   3   4   5   6   7   8   9   10
(2,3)     ├───┤                                ✔ chosen (ends first)
(1,4) ├───────────┤                            ✘ starts at 1 < 3
(5,8)                 ├───────────┤            ✔ chosen (5 ≥ 3)
(6,10)                    ├───────────────┤    ✘ starts at 6 < 8
```

```python filename:Python
def max_activities(activities):
    activities = sorted(activities, key=lambda a: a[1])   # earliest finish first
    chosen = [activities[0]]
    for start, finish in activities[1:]:
        if start >= chosen[-1][1]:                        # no overlap with the last chosen one
            chosen.append((start, finish))
    return chosen

acts = [(2, 3), (1, 4), (5, 8), (6, 10)]
chosen = max_activities(acts)
print("selected:", " ".join(f"({s},{f})" for s, f in chosen))
print("count:", len(chosen))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

vector<pair<int,int>> maxActivities(vector<pair<int,int>> acts) {
    sort(acts.begin(), acts.end(),
         [](const pair<int,int>& a, const pair<int,int>& b) { return a.second < b.second; });  // earliest finish first
    vector<pair<int,int>> chosen = {acts[0]};
    for (size_t i = 1; i < acts.size(); i++)
        if (acts[i].first >= chosen.back().second)         // no overlap with the last chosen one
            chosen.push_back(acts[i]);
    return chosen;
}

int main() {
    vector<pair<int,int>> acts = {{2, 3}, {1, 4}, {5, 8}, {6, 10}};
    vector<pair<int,int>> chosen = maxActivities(acts);
    cout << "selected:";
    for (auto& [s, f] : chosen) cout << " (" << s << "," << f << ")";
    cout << "\ncount: " << chosen.size() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class Main {
    static List<int[]> maxActivities(int[][] acts) {
        Arrays.sort(acts, (a, b) -> a[1] - b[1]);             // earliest finish first
        List<int[]> chosen = new ArrayList<>();
        chosen.add(acts[0]);
        for (int i = 1; i < acts.length; i++)
            if (acts[i][0] >= chosen.get(chosen.size() - 1)[1])   // no overlap with the last chosen one
                chosen.add(acts[i]);
        return chosen;
    }

    public static void main(String[] args) {
        int[][] acts = {{2, 3}, {1, 4}, {5, 8}, {6, 10}};
        List<int[]> chosen = maxActivities(acts);
        StringBuilder sb = new StringBuilder("selected:");
        for (int[] a : chosen) sb.append(" (").append(a[0]).append(",").append(a[1]).append(")");
        System.out.println(sb);
        System.out.println("count: " + chosen.size());
    }
}
```

```javascript filename:JavaScript
function maxActivities(activities) {
    const acts = [...activities].sort((a, b) => a[1] - b[1]);   // earliest finish first
    const chosen = [acts[0]];
    for (let i = 1; i < acts.length; i++)
        if (acts[i][0] >= chosen[chosen.length - 1][1])          // no overlap with the last chosen one
            chosen.push(acts[i]);
    return chosen;
}

const acts = [[2, 3], [1, 4], [5, 8], [6, 10]];
const chosen = maxActivities(acts);
console.log("selected:", chosen.map(([s, f]) => `(${s},${f})`).join(" "));
console.log("count:", chosen.length);
```

```text filename:Output
selected: (2,3) (5,8)
count: 2
```

Time O(n log n) for the sort; O(n) if already sorted · Space O(1) extra

> [!NOTE] Key point
>
> <strong>Why earliest finish is safe (exchange argument).</strong> Let `S` be any optimal set of activities and let `g` be the activity that finishes first overall. Replace the first activity of `S` with `g`: `g` finishes no later, so it cannot overlap the second activity of `S`. The new set is still valid and has the same size — so an optimal solution containing the greedy choice always exists.

> [!WARNING] Pitfall
>
> Use `start >= last_finish`, not `>`. An activity may begin at the very instant the previous one ends; writing `>` throws away valid pairs like `(1, 3)` and `(3, 5)`.

# Fractional knapsack problem

A knapsack can carry at most `W` units of weight. Each item has a weight and a value, and — unlike the 0/1 knapsack — you may take <strong>any fraction</strong> of an item. Maximise the total value carried.

> [!TIP] Example
>
> <strong>Input:</strong> `weights = [50, 20, 30], values = [600, 500, 400], W = 70`<br><strong>Output:</strong> `1140.00`

> [!NOTE] Idea
>
> Value per unit weight is what matters. Sort the items by `value / weight` descending, take whole items while they fit, then fill the remaining capacity with a fraction of the next item and stop — the knapsack is full.

| Item (w, v) | Ratio v/w | Decision | Value added | Capacity left |
| --- | --- | --- | --- | --- |
| (20, 500) | 25.0 | take all | 500 | 50 |
| (30, 400) | 13.3 | take all | 400 | 20 |
| (50, 600) | 12.0 | take 20/50 | 600 × 20/50 = 240 | 0 |

```python filename:Python
def fractional_knapsack(items, capacity):
    items = sorted(items, key=lambda it: it[1] / it[0], reverse=True)   # best value per kg first
    total = 0.0
    for w, v in items:
        if capacity == 0:
            break
        if w <= capacity:                             # the whole item fits
            capacity -= w
            total += v
            print(f"item w={w} v={v}: take all → {v:.2f}")
        else:                                         # only a fraction fits — fill up and stop
            part = v * capacity / w
            print(f"item w={w} v={v}: take {capacity}/{w} → {part:.2f}")
            total += part
            capacity = 0
    return total

items = [(50, 600), (20, 500), (30, 400)]             # (weight, value)
print(f"max value: {fractional_knapsack(items, 70):.2f}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <iomanip>
#include <vector>
#include <algorithm>
using namespace std;

struct Item { int weight, value; };

double fractionalKnapsack(vector<Item> items, int capacity) {
    sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
        return (double)a.value / a.weight > (double)b.value / b.weight;   // best value per kg first
    });
    double total = 0;
    for (const Item& it : items) {
        if (capacity == 0) break;
        if (it.weight <= capacity) {                   // the whole item fits
            capacity -= it.weight;
            total += it.value;
            cout << "item w=" << it.weight << " v=" << it.value << ": take all → " << (double)it.value << "\n";
        } else {                                       // only a fraction fits — fill up and stop
            double part = (double)it.value * capacity / it.weight;
            cout << "item w=" << it.weight << " v=" << it.value << ": take " << capacity << "/" << it.weight
                 << " → " << part << "\n";
            total += part;
            capacity = 0;
        }
    }
    return total;
}

int main() {
    cout << fixed << setprecision(2);
    vector<Item> items = {{50, 600}, {20, 500}, {30, 400}};   // {weight, value}
    double best = fractionalKnapsack(items, 70);               // run first — it prints the steps
    cout << "max value: " << best << "\n";
}
```

```java filename:Java
import java.util.Arrays;
import java.util.Locale;

public class Main {
    static double fractionalKnapsack(int[][] items, int capacity) {
        Arrays.sort(items, (a, b) -> Double.compare((double) b[1] / b[0], (double) a[1] / a[0]));  // best ratio first
        double total = 0;
        for (int[] it : items) {
            int w = it[0], v = it[1];
            if (capacity == 0) break;
            if (w <= capacity) {                           // the whole item fits
                capacity -= w;
                total += v;
                System.out.println("item w=" + w + " v=" + v + ": take all → " + String.format(Locale.US, "%.2f", (double) v));
            } else {                                       // only a fraction fits — fill up and stop
                double part = (double) v * capacity / w;
                System.out.println("item w=" + w + " v=" + v + ": take " + capacity + "/" + w + " → "
                                   + String.format(Locale.US, "%.2f", part));
                total += part;
                capacity = 0;
            }
        }
        return total;
    }

    public static void main(String[] args) {
        int[][] items = {{50, 600}, {20, 500}, {30, 400}};   // {weight, value}
        double best = fractionalKnapsack(items, 70);           // run first — it prints the steps
        System.out.println(String.format(Locale.US, "max value: %.2f", best));
    }
}
```

```javascript filename:JavaScript
function fractionalKnapsack(items, capacity) {
    const sorted = [...items].sort((a, b) => b[1] / b[0] - a[1] / a[0]);   // best value per kg first
    let total = 0;
    for (const [w, v] of sorted) {
        if (capacity === 0) break;
        if (w <= capacity) {                               // the whole item fits
            capacity -= w;
            total += v;
            console.log(`item w=${w} v=${v}: take all → ${v.toFixed(2)}`);
        } else {                                           // only a fraction fits — fill up and stop
            const part = v * capacity / w;
            console.log(`item w=${w} v=${v}: take ${capacity}/${w} → ${part.toFixed(2)}`);
            total += part;
            capacity = 0;
        }
    }
    return total;
}

const items = [[50, 600], [20, 500], [30, 400]];         // [weight, value]
console.log(`max value: ${fractionalKnapsack(items, 70).toFixed(2)}`);
```

```text filename:Output
item w=20 v=500: take all → 500.00
item w=30 v=400: take all → 400.00
item w=50 v=600: take 20/50 → 240.00
max value: 1140.00
```

Time O(n log n) · Space O(1) extra (O(n) if the input must not be reordered)

> [!WARNING] Pitfall
>
> The ratio rule is only correct because items are <strong>divisible</strong>. In the 0/1 knapsack (take an item whole or not at all) the same greedy fails: with `W = 50` and items `(10, 60), (20, 100), (30, 120)` the ratio order gives `160`, but `100 + 120 = 220` is optimal. 0/1 knapsack needs dynamic programming.

# Job sequencing problem

Each job has a <strong>deadline</strong> and a <strong>profit</strong>, takes exactly one unit of time, and only one job can run at a time starting from time `0`. A job earns its profit only if it finishes by its deadline. Which jobs should be scheduled, and when, to maximise total profit?

> [!TIP] Example
>
> <strong>Input:</strong> `jobs = a(2, 100) b(1, 19) c(2, 27) d(1, 25) e(3, 15) as (deadline, profit), slots = 3`<br><strong>Output:</strong> `142 → slot 1: c, slot 2: a, slot 3: e`

> [!NOTE] Idea
>
> Consider jobs in <strong>decreasing order of profit</strong>. Give each job the <strong>latest free slot</strong> that is still before its deadline — leaving the earlier slots open for jobs with tighter deadlines that come later in the scan.

1. <strong>Sort by profit, descending</strong>

   a(100), c(27), d(25), b(19), e(15).

2. <strong>a (deadline 2)</strong>

   Latest free slot ≤ 2 is slot 2 → schedule a there.

3. <strong>c (deadline 2)</strong>

   Slot 2 is taken, slot 1 is free → schedule c in slot 1.

4. <strong>d (deadline 1), b (deadline 1)</strong>

   Slot 1 is taken → both are dropped.

5. <strong>e (deadline 3)</strong>

   Slot 3 is free → schedule e. Total profit 100 + 27 + 15 = 142.

```python filename:Python
def job_sequencing(jobs, slots):
    jobs = sorted(jobs, key=lambda j: j[2], reverse=True)   # most profitable first
    schedule = [None] * slots                               # schedule[s] = job running in slot s+1
    for name, deadline, profit in jobs:
        for s in range(min(slots, deadline) - 1, -1, -1):  # latest free slot before the deadline
            if schedule[s] is None:
                schedule[s] = (name, profit)
                break
    return schedule

jobs = [("a", 2, 100), ("b", 1, 19), ("c", 2, 27), ("d", 1, 25), ("e", 3, 15)]   # (name, deadline, profit)
total = 0
for s, job in enumerate(job_sequencing(jobs, 3)):
    if job is not None:
        print(f"slot {s + 1}: {job[0]} (profit {job[1]})")
        total += job[1]
print("total profit:", total)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

struct Job { string name; int deadline, profit; };

vector<Job> jobSequencing(vector<Job> jobs, int slots) {
    sort(jobs.begin(), jobs.end(),
         [](const Job& a, const Job& b) { return a.profit > b.profit; });   // most profitable first
    vector<Job> schedule(slots, Job{"", 0, 0});                // schedule[s] = job running in slot s+1
    for (const Job& j : jobs)
        for (int s = min(slots, j.deadline) - 1; s >= 0; s--)  // latest free slot before the deadline
            if (schedule[s].name.empty()) { schedule[s] = j; break; }
    return schedule;
}

int main() {
    vector<Job> jobs = {{"a", 2, 100}, {"b", 1, 19}, {"c", 2, 27}, {"d", 1, 25}, {"e", 3, 15}};
    vector<Job> schedule = jobSequencing(jobs, 3);
    int total = 0;
    for (int s = 0; s < (int)schedule.size(); s++) {
        if (schedule[s].name.empty()) continue;
        cout << "slot " << s + 1 << ": " << schedule[s].name << " (profit " << schedule[s].profit << ")\n";
        total += schedule[s].profit;
    }
    cout << "total profit: " << total << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static class Job {
        String name; int deadline, profit;
        Job(String n, int d, int p) { name = n; deadline = d; profit = p; }
    }

    static Job[] jobSequencing(List<Job> jobs, int slots) {
        jobs.sort((a, b) -> b.profit - a.profit);               // most profitable first
        Job[] schedule = new Job[slots];                         // schedule[s] = job running in slot s+1
        for (Job j : jobs)
            for (int s = Math.min(slots, j.deadline) - 1; s >= 0; s--)   // latest free slot before the deadline
                if (schedule[s] == null) { schedule[s] = j; break; }
        return schedule;
    }

    public static void main(String[] args) {
        List<Job> jobs = new ArrayList<>(List.of(new Job("a", 2, 100), new Job("b", 1, 19),
                new Job("c", 2, 27), new Job("d", 1, 25), new Job("e", 3, 15)));
        Job[] schedule = jobSequencing(jobs, 3);
        int total = 0;
        for (int s = 0; s < schedule.length; s++) {
            if (schedule[s] == null) continue;
            System.out.println("slot " + (s + 1) + ": " + schedule[s].name + " (profit " + schedule[s].profit + ")");
            total += schedule[s].profit;
        }
        System.out.println("total profit: " + total);
    }
}
```

```javascript filename:JavaScript
function jobSequencing(jobs, slots) {
    const sorted = [...jobs].sort((a, b) => b.profit - a.profit);   // most profitable first
    const schedule = new Array(slots).fill(null);                   // schedule[s] = job running in slot s+1
    for (const job of sorted)
        for (let s = Math.min(slots, job.deadline) - 1; s >= 0; s--)   // latest free slot before the deadline
            if (schedule[s] === null) { schedule[s] = job; break; }
    return schedule;
}

const jobs = [
    { name: "a", deadline: 2, profit: 100 }, { name: "b", deadline: 1, profit: 19 },
    { name: "c", deadline: 2, profit: 27 },  { name: "d", deadline: 1, profit: 25 },
    { name: "e", deadline: 3, profit: 15 },
];
let total = 0;
jobSequencing(jobs, 3).forEach((job, s) => {
    if (job === null) return;
    console.log(`slot ${s + 1}: ${job.name} (profit ${job.profit})`);
    total += job.profit;
});
console.log("total profit:", total);
```

```text filename:Output
slot 1: c (profit 27)
slot 2: a (profit 100)
slot 3: e (profit 15)
total profit: 142
```

Time O(n log n + n · slots) — O(n log n) with a disjoint-set to find the latest free slot · Space O(slots)

> [!WARNING] Pitfall
>
> Placing a job in the <strong>earliest</strong> free slot instead of the latest one is the common mistake: `a` would take slot 1, and then `c` (deadline 2) still fits in slot 2 here, but in general early slots are the scarce resource that tight-deadline jobs need. Scanning backwards from `min(slots, deadline)` keeps them free.

# Huffman coding

Huffman coding is a <strong>lossless compression</strong> scheme that gives each character a <strong>variable-length</strong> binary code: frequent characters get short codes, rare ones get long codes. Over the text `"aabbacbababbabbabaab…"` of 100 characters with frequencies `a: 70, b: 20, c: 10`, a fixed-length code spends 2 bits per character (200 bits); Huffman spends 130.

> [!TIP] Example
>
> <strong>Input:</strong> `frequencies = a: 70, b: 20, c: 10`<br><strong>Output:</strong> `a → 1, b → 01, c → 00 (130 bits total)`

> [!NOTE] Greedy idea
>
> The most frequent character must have the shortest code — so build the tree from the rarest characters upward, merging the two least frequent nodes at every step.

> [!NOTE] Prefix requirement
>
> For decompression to be unambiguous, no code may be a <strong>prefix</strong> of another. With `a = 1, b = 01, c = 00` the stream `1 00 1 01` can only mean `acab`. Leaves of a binary tree automatically satisfy this.

<strong>High-level idea.</strong> Build a binary tree in which every input character is a <strong>leaf</strong> and internal nodes carry a dummy character (`$`). Label every left edge `0` and every right edge `1`; the root-to-leaf path spells out the leaf's code. Then traverse the tree and print the codes.

```text filename:Building%20the%20Huffman%20tree%20with%20a%20min-heap%3B%20left%20edge%20%3D%200%2C%20right%20edge%20%3D%201
step 1  heap: c:10  b:20  a:70        pop c, b → new node $:30
step 2  heap: $:30  a:70              pop $, a → new node $:100
step 3  heap: $:100                   one node left — the root

           ($:100)
          0/     \1
      ($:30)      a:70   → a = 1
     0/    \1
   c:10    b:20          → c = 00, b = 01
```

1. <strong>Create the leaves</strong>

   One node per character with its frequency; push all of them into a <strong>min-heap</strong> keyed on frequency.

2. <strong>Merge while the heap has more than one node</strong>

   `left = extractMin()`, `right = extractMin()`; create a node with character `$`, frequency `left.freq + right.freq`, and the two popped nodes as children; push it back.

3. <strong>The last node is the root</strong>

   Its frequency is the total character count.

4. <strong>Print the codes</strong>

   `printCodes(root, "")`: at a leaf print the character and the accumulated string; otherwise recurse left with `code + "0"` and right with `code + "1"`.

> [!NOTE] Ties
>
> Two nodes may have the <strong>same frequency</strong>, and then the shape of the tree depends on which one the heap returns first. The code lengths — and the total compressed size — are identical either way, but the actual bit strings differ. The programs below break ties by <em>insertion order</em> so that all four print the same codes.

```python filename:Python
import heapq

class Node:
    def __init__(self, ch, freq, left=None, right=None):
        self.ch, self.freq, self.left, self.right = ch, freq, left, right

def build_huffman_tree(freq):
    heap, order = [], 0
    for ch, f in freq:                                      # (freq, insertion order, node) — order breaks ties
        heap.append((f, order, Node(ch, f)))
        order += 1
    heapq.heapify(heap)
    while len(heap) > 1:
        f1, _, left = heapq.heappop(heap)                   # the two least frequent nodes …
        f2, _, right = heapq.heappop(heap)
        heapq.heappush(heap, (f1 + f2, order, Node('$', f1 + f2, left, right)))   # … become siblings
        order += 1
    return heap[0][2]

def print_codes(node, code, codes):
    if node.ch != '$':                                      # leaf = an input character
        print(f"{node.ch}: {code}")
        codes[node.ch] = code
        return
    print_codes(node.left, code + "0", codes)
    print_codes(node.right, code + "1", codes)

freq = [('a', 70), ('b', 20), ('c', 10)]
root = build_huffman_tree(freq)
codes = {}
print_codes(root, "", codes)
total = sum(f * len(codes[ch]) for ch, f in freq)
chars = sum(f for _, f in freq)
print(f"total bits: {total} (fixed-length 2-bit codes: {2 * chars})")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
#include <string>
#include <vector>
#include <map>
using namespace std;

struct Node {
    char ch; int freq; Node *left, *right;
    Node(char c, int f, Node* l = nullptr, Node* r = nullptr) : ch(c), freq(f), left(l), right(r) {}
};
struct Entry { int freq, order; Node* node; };
struct ByFreq {                                             // min-heap on (freq, insertion order)
    bool operator()(const Entry& a, const Entry& b) const {
        return a.freq != b.freq ? a.freq > b.freq : a.order > b.order;
    }
};

Node* buildHuffmanTree(const vector<pair<char,int>>& freq) {
    priority_queue<Entry, vector<Entry>, ByFreq> heap;
    int order = 0;
    for (auto& [ch, f] : freq) heap.push({f, order++, new Node(ch, f)});
    while (heap.size() > 1) {
        Entry l = heap.top(); heap.pop();                   // the two least frequent nodes …
        Entry r = heap.top(); heap.pop();
        heap.push({l.freq + r.freq, order++, new Node('$', l.freq + r.freq, l.node, r.node)});  // … become siblings
    }
    return heap.top().node;
}

void printCodes(Node* n, const string& code, map<char,string>& codes) {
    if (n->ch != '$') {                                     // leaf = an input character
        cout << n->ch << ": " << code << "\n";
        codes[n->ch] = code;
        return;
    }
    printCodes(n->left, code + "0", codes);
    printCodes(n->right, code + "1", codes);
}

int main() {
    vector<pair<char,int>> freq = {{'a', 70}, {'b', 20}, {'c', 10}};
    Node* root = buildHuffmanTree(freq);
    map<char,string> codes;
    printCodes(root, "", codes);
    int total = 0, chars = 0;
    for (auto& [ch, f] : freq) { total += f * (int)codes[ch].size(); chars += f; }
    cout << "total bits: " << total << " (fixed-length 2-bit codes: " << 2 * chars << ")\n";
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;
import java.util.PriorityQueue;

public class Main {
    static class Node {
        char ch; int freq, order; Node left, right;
        Node(char c, int f, int o, Node l, Node r) { ch = c; freq = f; order = o; left = l; right = r; }
    }

    static Node buildHuffmanTree(char[] chars, int[] freqs) {
        PriorityQueue<Node> heap = new PriorityQueue<>((a, b) ->
                a.freq != b.freq ? a.freq - b.freq : a.order - b.order);   // min-heap on (freq, insertion order)
        int order = 0;
        for (int i = 0; i < chars.length; i++) heap.add(new Node(chars[i], freqs[i], order++, null, null));
        while (heap.size() > 1) {
            Node left = heap.poll();                                     // the two least frequent nodes …
            Node right = heap.poll();
            heap.add(new Node('$', left.freq + right.freq, order++, left, right));   // … become siblings
        }
        return heap.poll();
    }

    static void printCodes(Node n, String code, Map<Character, String> codes) {
        if (n.ch != '$') {                                               // leaf = an input character
            System.out.println(n.ch + ": " + code);
            codes.put(n.ch, code);
            return;
        }
        printCodes(n.left, code + "0", codes);
        printCodes(n.right, code + "1", codes);
    }

    public static void main(String[] args) {
        char[] chars = {'a', 'b', 'c'};
        int[] freqs = {70, 20, 10};
        Node root = buildHuffmanTree(chars, freqs);
        Map<Character, String> codes = new HashMap<>();
        printCodes(root, "", codes);
        int total = 0, count = 0;
        for (int i = 0; i < chars.length; i++) { total += freqs[i] * codes.get(chars[i]).length(); count += freqs[i]; }
        System.out.println("total bits: " + total + " (fixed-length 2-bit codes: " + 2 * count + ")");
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(ch, freq, order, left = null, right = null) {
        Object.assign(this, { ch, freq, order, left, right });
    }
}

class MinHeap {                               // keyed on (freq, insertion order) so ties are deterministic
    constructor() { this.a = []; }
    less(i, j) { const x = this.a[i], y = this.a[j]; return x.freq !== y.freq ? x.freq < y.freq : x.order < y.order; }
    swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
    push(node) {
        this.a.push(node);
        for (let i = this.a.length - 1; i > 0 && this.less(i, (i - 1) >> 1); i = (i - 1) >> 1) this.swap(i, (i - 1) >> 1);
    }
    pop() {
        const top = this.a[0], last = this.a.pop();
        if (this.a.length) {
            this.a[0] = last;
            for (let i = 0;;) {
                let m = i; const l = 2 * i + 1, r = l + 1;
                if (l < this.a.length && this.less(l, m)) m = l;
                if (r < this.a.length && this.less(r, m)) m = r;
                if (m === i) break;
                this.swap(i, m); i = m;
            }
        }
        return top;
    }
    get size() { return this.a.length; }
}

function buildHuffmanTree(freq) {
    const heap = new MinHeap();
    let order = 0;
    for (const [ch, f] of freq) heap.push(new Node(ch, f, order++));
    while (heap.size > 1) {
        const left = heap.pop();                                  // the two least frequent nodes …
        const right = heap.pop();
        heap.push(new Node('$', left.freq + right.freq, order++, left, right));   // … become siblings
    }
    return heap.pop();
}

function printCodes(n, code, codes) {
    if (n.ch !== '$') { console.log(`${n.ch}: ${code}`); codes[n.ch] = code; return; }   // leaf
    printCodes(n.left, code + "0", codes);
    printCodes(n.right, code + "1", codes);
}

const freq = [['a', 70], ['b', 20], ['c', 10]];
const codes = {};
printCodes(buildHuffmanTree(freq), "", codes);
const total = freq.reduce((s, [ch, f]) => s + f * codes[ch].length, 0);
const chars = freq.reduce((s, [, f]) => s + f, 0);
console.log(`total bits: ${total} (fixed-length 2-bit codes: ${2 * chars})`);
```

```text filename:Output
c: 00
b: 01
a: 1
total bits: 130 (fixed-length 2-bit codes: 200)
```

Time O(k log k) for k distinct characters (k − 1 merges, each O(log k) on the heap) · Space O(k) for the tree

> [!WARNING] Pitfall
>
> A text with a <strong>single distinct character</strong> produces a tree that is just one leaf and an empty code `""`. Real encoders special-case this (give it the code `0`). Also remember that the frequency table must be stored alongside the compressed data, or the decoder cannot rebuild the same tree.

# Interview Q&amp;A

```question
Greedy vs dynamic programming — how do you decide?

---

Both need optimal substructure. Greedy additionally needs the <strong>greedy-choice property</strong>: a locally best choice that is provably part of an optimal solution, so you never have to look at alternatives. DP is for problems where the best choice at a step depends on the solutions of sub-problems, so you must evaluate all options and keep the best (0/1 knapsack, general coin change, LCS). Greedy is faster — usually `O(n log n)` — but only when it is correct.
```

```question
Why does greedy work for Indian/US coins but not for arbitrary denominations?

---

In canonical coin systems every coin is worth at least as much as any combination of smaller coins that it could replace, so taking the largest coin never costs an extra coin later. Arbitrary systems like `{18, 10, 1}` break that: `20 = 10 + 10` beats `18 + 1 + 1`. Minimum coins for arbitrary denominations is a DP problem.
```

```question
Sketch the exchange argument for activity selection.

---

Let `g` be the activity with the earliest finish and `S` an optimal solution whose first activity (by finish) is `x ≠ g`. Since `g` finishes no later than `x`, `S − {x} + {g}` has no overlaps and the same size — so there is an optimal solution containing `g`. Remove `g` and all activities overlapping it; the remainder is the same problem on fewer activities, so induction finishes the proof.
```

```question
Why are Huffman codes prefix-free, and why does that matter?

---

Every character sits at a <strong>leaf</strong> of the tree, and a leaf's path can never be the prefix of another leaf's path (that other leaf would have to be inside its subtree). Prefix-freeness means the decoder can read bits one at a time and stop the moment it reaches a leaf — no separators between codes are needed.
```

```question
Is Huffman coding optimal?

---

Yes — among all prefix codes for a given set of <strong>per-symbol</strong> frequencies it minimises the expected code length (proved by an exchange argument: in an optimal tree the two rarest symbols are sibling leaves at maximum depth). It is not optimal when symbols are correlated or when fractional bits per symbol would help — arithmetic coding and context modelling do better there.
```

```question
Name a problem where the obvious greedy rule is wrong and give the counterexample.

---

0/1 knapsack by value-per-weight: `W = 50`, items `(10, 60), (20, 100), (30, 120)`. Ratios pick items 1 and 2 for value `160`, but items 2 and 3 give `220`. Another: activity selection by <em>shortest duration</em> — a short activity in the middle can block two longer ones on either side.
```
