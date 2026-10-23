---
id: 485bb6df-d0c6-7d66-92c2-8fde4e5e427e
key: problem:sheet-150/lc-355
subject: sheet-150
topic: heap
title: Design Twitter
slug: design-twitter
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 355](https://leetcode.com/problems/design-twitter/)

# Problem

Design a simplified Twitter with operations: `postTweet()`, `getNewsFeed()` (10 most recent tweets), `follow()`, `unfollow()`.

# Understanding the problem

Newsfeed must retrieve the 10 most recent tweets posted by user or anyone they follow.

# Intuition

K-Way Merge with Heap: each user's tweets are already chronological. Push latest tweet from each followed user into heap, pop top 10.

# Approach

1. Store tweets per user in list `self.tweets[userId] = [(time, tweetId)]`.
2. For `getNewsFeed(userId)`: collect candidate users `following[userId] | {userId}`.
3. Push latest tweet tuple `(-time, tweetId, user, index)` for each user into heap.
4. Pop 10 times: append tweetId to result and push previous tweet `index - 1` from same user if exists.

# Naive Solution — Brute Force

Gather all tweets from followed users into one list and sort by timestamp.

```python filename:Python
from collections import defaultdict

class Twitter:

    def __init__(self):
        self.time = 0
        self.tweets = defaultdict(list)
        self.following = defaultdict(set)

    def postTweet(self, userId, tweetId):
        self.time += 1

        self.tweets[userId].append(
            (self.time, tweetId)
        )

    def getNewsFeed(self, userId):

        users = self.following[userId] | {userId}

        all_tweets = []

        for user in users:
            all_tweets.extend(
                self.tweets[user]
            )

        all_tweets.sort(
            reverse=True
        )

        return [
            tweet_id
            for _, tweet_id in all_tweets[:10]
        ]

    def follow(self, followerId, followeeId):
        if followerId != followeeId:
            self.following[followerId].add(
                followeeId
            )

    def unfollow(self, followerId, followeeId):
        self.following[followerId].discard(
            followeeId
        )
```

```cpp filename:C%2B%2B
class Twitter {
    int time = 0;
    unordered_map<int, vector<pair<int, int>>> tweets;  // user -> {time, tweetId}
    unordered_map<int, unordered_set<int>> following;

public:
    Twitter() {}

    void postTweet(int userId, int tweetId) {
        time++;

        tweets[userId].push_back({time, tweetId});
    }

    vector<int> getNewsFeed(int userId) {
        unordered_set<int> users = following[userId];
        users.insert(userId);

        vector<pair<int, int>> allTweets;

        for (int user : users) {
            allTweets.insert(allTweets.end(), tweets[user].begin(), tweets[user].end());
        }

        sort(allTweets.begin(), allTweets.end(), greater<pair<int, int>>());

        vector<int> result;
        for (int i = 0; i < (int)allTweets.size() && i < 10; i++) {
            result.push_back(allTweets[i].second);
        }

        return result;
    }

    void follow(int followerId, int followeeId) {
        if (followerId != followeeId) following[followerId].insert(followeeId);
    }

    void unfollow(int followerId, int followeeId) {
        following[followerId].erase(followeeId);
    }
};
```

```java filename:Java
class Twitter {
    private int time = 0;
    private Map<Integer, List<int[]>> tweets = new HashMap<>();  // user -> {time, tweetId}
    private Map<Integer, Set<Integer>> following = new HashMap<>();

    public Twitter() {}

    public void postTweet(int userId, int tweetId) {
        time++;

        tweets.computeIfAbsent(userId, key -> new ArrayList<>()).add(new int[]{time, tweetId});
    }

    public List<Integer> getNewsFeed(int userId) {
        Set<Integer> users = new HashSet<>(following.getOrDefault(userId, new HashSet<>()));
        users.add(userId);

        List<int[]> allTweets = new ArrayList<>();

        for (int user : users) {
            allTweets.addAll(tweets.getOrDefault(user, new ArrayList<>()));
        }

        allTweets.sort((a, b) -> Integer.compare(b[0], a[0]));

        List<Integer> result = new ArrayList<>();
        for (int i = 0; i < allTweets.size() && i < 10; i++) {
            result.add(allTweets.get(i)[1]);
        }

        return result;
    }

    public void follow(int followerId, int followeeId) {
        if (followerId != followeeId) {
            following.computeIfAbsent(followerId, key -> new HashSet<>()).add(followeeId);
        }
    }

    public void unfollow(int followerId, int followeeId) {
        Set<Integer> followees = following.get(followerId);
        if (followees != null) followees.remove(followeeId);
    }
}
```

```javascript filename:JavaScript
class Twitter {
    constructor() {
        this.time = 0;
        this.tweets = new Map();     // user -> [[time, tweetId], ...]
        this.following = new Map();  // user -> Set of followees
    }

    postTweet(userId, tweetId) {
        this.time++;

        if (!this.tweets.has(userId)) this.tweets.set(userId, []);
        this.tweets.get(userId).push([this.time, tweetId]);
    }

    getNewsFeed(userId) {
        const users = new Set(this.following.get(userId) || []);
        users.add(userId);

        const allTweets = [];

        for (const user of users) {
            allTweets.push(...(this.tweets.get(user) || []));
        }

        allTweets.sort((a, b) => b[0] - a[0]);

        return allTweets.slice(0, 10).map(([, tweetId]) => tweetId);
    }

    follow(followerId, followeeId) {
        if (followerId !== followeeId) {
            if (!this.following.has(followerId)) this.following.set(followerId, new Set());
            this.following.get(followerId).add(followeeId);
        }
    }

    unfollow(followerId, followeeId) {
        this.following.get(followerId)?.delete(followeeId);
    }
}
```

<strong>getNewsFeed: O(T log T) · Space: O(T + F)</strong>

# Optimized Code (Python 3)

```python filename:Python
import heapq
from collections import defaultdict

class Twitter:

    def __init__(self):
        self.time = 0
        self.tweets = defaultdict(list)
        self.following = defaultdict(set)

    def postTweet(self, userId, tweetId):
        self.time += 1

        self.tweets[userId].append(
            (self.time, tweetId)
        )

    def follow(self, followerId, followeeId):
        if followerId != followeeId:
            self.following[followerId].add(
                followeeId
            )

    def unfollow(self, followerId, followeeId):
        self.following[followerId].discard(
            followeeId
        )

    def getNewsFeed(self, userId):

        users = self.following[userId] | {userId}

        heap = []

        for user in users:
            tweets = self.tweets[user]

            if tweets:
                index = len(tweets) - 1
                time, tweet_id = tweets[index]

                heapq.heappush(
                    heap,
                    (-time, tweet_id, user, index)
                )

        result = []

        while heap and len(result) < 10:

            _, tweet_id, user, index = (
                heapq.heappop(heap)
            )

            result.append(tweet_id)

            index -= 1

            if index >= 0:
                time, tweet_id = (
                    self.tweets[user][index]
                )

                heapq.heappush(
                    heap,
                    (-time, tweet_id, user, index)
                )

        return result
```

```cpp filename:C%2B%2B
class Twitter {
    int time = 0;
    unordered_map<int, vector<pair<int, int>>> tweets;  // user -> {time, tweetId}
    unordered_map<int, unordered_set<int>> following;

public:
    Twitter() {}

    void postTweet(int userId, int tweetId) {
        time++;

        tweets[userId].push_back({time, tweetId});
    }

    void follow(int followerId, int followeeId) {
        if (followerId != followeeId) following[followerId].insert(followeeId);
    }

    void unfollow(int followerId, int followeeId) {
        following[followerId].erase(followeeId);
    }

    vector<int> getNewsFeed(int userId) {
        unordered_set<int> users = following[userId];
        users.insert(userId);

        priority_queue<array<int, 4>> heap;  // max-heap of {time, tweetId, user, index}

        for (int user : users) {
            auto& userTweets = tweets[user];

            if (!userTweets.empty()) {
                int index = userTweets.size() - 1;
                auto [time, tweetId] = userTweets[index];

                heap.push({time, tweetId, user, index});
            }
        }

        vector<int> result;

        while (!heap.empty() && result.size() < 10) {
            auto [_, tweetId, user, index] = heap.top();
            heap.pop();

            result.push_back(tweetId);

            index--;

            if (index >= 0) {
                auto [time, nextTweetId] = tweets[user][index];

                heap.push({time, nextTweetId, user, index});
            }
        }

        return result;
    }
};
```

```java filename:Java
class Twitter {
    private int time = 0;
    private Map<Integer, List<int[]>> tweets = new HashMap<>();  // user -> {time, tweetId}
    private Map<Integer, Set<Integer>> following = new HashMap<>();

    public Twitter() {}

    public void postTweet(int userId, int tweetId) {
        time++;

        tweets.computeIfAbsent(userId, key -> new ArrayList<>()).add(new int[]{time, tweetId});
    }

    public void follow(int followerId, int followeeId) {
        if (followerId != followeeId) {
            following.computeIfAbsent(followerId, key -> new HashSet<>()).add(followeeId);
        }
    }

    public void unfollow(int followerId, int followeeId) {
        Set<Integer> followees = following.get(followerId);
        if (followees != null) followees.remove(followeeId);
    }

    public List<Integer> getNewsFeed(int userId) {
        Set<Integer> users = new HashSet<>(following.getOrDefault(userId, new HashSet<>()));
        users.add(userId);

        // max-heap of {time, tweetId, user, index}
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(b[0], a[0]));

        for (int user : users) {
            List<int[]> userTweets = tweets.getOrDefault(user, new ArrayList<>());

            if (!userTweets.isEmpty()) {
                int index = userTweets.size() - 1;
                int[] tweet = userTweets.get(index);

                heap.offer(new int[]{tweet[0], tweet[1], user, index});
            }
        }

        List<Integer> result = new ArrayList<>();

        while (!heap.isEmpty() && result.size() < 10) {
            int[] top = heap.poll();
            int user = top[2], index = top[3];

            result.add(top[1]);

            index--;

            if (index >= 0) {
                int[] tweet = tweets.get(user).get(index);

                heap.offer(new int[]{tweet[0], tweet[1], user, index});
            }
        }

        return result;
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor(compare = (a, b) => a - b, items = []) {
        this.compare = compare;
        this.data = items;
        for (let i = (items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
    }

    size() { return this.data.length; }

    peek() { return this.data[0]; }

    push(value) {
        const data = this.data;
        data.push(value);
        let i = data.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.compare(data[i], data[parent]) >= 0) break;
            [data[i], data[parent]] = [data[parent], data[i]];
            i = parent;
        }
    }

    pop() {
        const data = this.data;
        const top = data[0];
        const last = data.pop();
        if (data.length > 0) {
            data[0] = last;
            this.siftDown(0);
        }
        return top;
    }

    siftDown(i) {
        const data = this.data;
        while (true) {
            const left = 2 * i + 1, right = left + 1;
            let smallest = i;
            if (left < data.length && this.compare(data[left], data[smallest]) < 0) smallest = left;
            if (right < data.length && this.compare(data[right], data[smallest]) < 0) smallest = right;
            if (smallest === i) return;
            [data[i], data[smallest]] = [data[smallest], data[i]];
            i = smallest;
        }
    }
}

class Twitter {
    constructor() {
        this.time = 0;
        this.tweets = new Map();     // user -> [[time, tweetId], ...]
        this.following = new Map();  // user -> Set of followees
    }

    postTweet(userId, tweetId) {
        this.time++;

        if (!this.tweets.has(userId)) this.tweets.set(userId, []);
        this.tweets.get(userId).push([this.time, tweetId]);
    }

    follow(followerId, followeeId) {
        if (followerId !== followeeId) {
            if (!this.following.has(followerId)) this.following.set(followerId, new Set());
            this.following.get(followerId).add(followeeId);
        }
    }

    unfollow(followerId, followeeId) {
        this.following.get(followerId)?.delete(followeeId);
    }

    getNewsFeed(userId) {
        const users = new Set(this.following.get(userId) || []);
        users.add(userId);

        const heap = new MinHeap((a, b) => b[0] - a[0]);  // max-heap by time

        for (const user of users) {
            const tweets = this.tweets.get(user) || [];

            if (tweets.length) {
                const index = tweets.length - 1;
                const [time, tweetId] = tweets[index];

                heap.push([time, tweetId, user, index]);
            }
        }

        const result = [];

        while (heap.size() > 0 && result.length < 10) {
            let [, tweetId, user, index] = heap.pop();

            result.push(tweetId);

            index--;

            if (index >= 0) {
                const [time, nextTweetId] = this.tweets.get(user)[index];

                heap.push([time, nextTweetId, user, index]);
            }
        }

        return result;
    }
}
```

<strong>getNewsFeed: O(F + 10 log F) · Space: O(F)</strong>

# Takeaway

<strong>Pattern</strong> — Sorted streams + Top K → K-Way Merge with Heap
