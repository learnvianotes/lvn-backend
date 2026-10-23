---
id: 9ce5efb0-2739-7971-b1a9-e9e134ebda2f
key: topic:javascript/nodejs-essentials
subject: javascript
topic: nodejs-essentials
title: Node.js Essentials
slug: node-js-essentials
order: 1
---

Node.js is V8 plus libuv plus a standard library for files, networking, processes and streams — JavaScript outside the browser.

# Architecture

Your JS → V8 (executes) → Node bindings → libuv (event loop + thread pool) → OS

- Network I/O is non-blocking at the OS level; file-system, DNS lookups, crypto and zlib use libuv's thread pool (4 threads by default).
- One JS thread per process; scale with `cluster`, `worker_threads`, or multiple processes behind a load balancer.
- Globals: `process`, `Buffer`, `globalThis`, `setImmediate`, `structuredClone`, `fetch`; no `window` or `document`.

# path and process

```javascript filename:JavaScript
import path from "node:path";
const file = "/home/asha/projects/app/src/index.test.js";
console.log(path.basename(file), path.extname(file), path.dirname(file));
console.log(path.join("/a/b", "../c", "d.txt"), path.resolve("/root", "x", "..", "y"));
console.log(path.parse("/tmp/report.pdf"));
console.log(typeof process.argv, process.argv.length >= 2, process.platform.length > 0);
const port = Number(process.env.PORT ?? 3000);          // env vars are strings or undefined
console.log(port, typeof process.exitCode);
```

```text filename:Output
index.test.js .js /home/asha/projects/app/src
/a/c/d.txt /root/y
{
  root: '/',
  dir: '/tmp',
  base: 'report.pdf',
  ext: '.pdf',
  name: 'report'
}
object true true
3000 undefined
```

# The fs module (promises API)

```javascript filename:JavaScript
import { writeFile, readFile, appendFile, readdir, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

await mkdir("data/logs", { recursive: true });
await writeFile("data/logs/app.log", "started\n");
await appendFile("data/logs/app.log", "ready\n");
const text = await readFile("data/logs/app.log", "utf8");
console.log(text.trim().split("\n"));
console.log(await readdir("data"), (await stat("data/logs/app.log")).size);
try {
  await readFile("missing.txt", "utf8");
} catch (e) {
  console.log(e.code);
}
await rm("data", { recursive: true });
console.log(existsSync("data"));
```

```text filename:Output
[ 'started', 'ready' ]
[ 'logs' ] 14
ENOENT
false
```

> [!NOTE] Key point
>
> Use `node:fs/promises` with `await` in application code. The `*Sync` variants block the event loop — fine in CLI scripts and at startup, harmful inside a server request handler.

# A minimal HTTP server

```javascript filename:JavaScript
import http from "node:http";
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ method: req.method, path: req.url }));
});
server.listen(0, async () => {
  const { port } = server.address();
  const body = await (await fetch(`http://localhost:${port}/hello?x=1`)).json();
  console.log(body);
  server.close();
});
```

```text filename:Output
{ method: 'GET', path: '/hello?x=1' }
```

# npm and package.json

```filename:Terminal
$ npm init -y                    # create package.json
$ npm install express            # dependency  → "dependencies"
$ npm install -D vitest          # dev-only    → "devDependencies"
$ npm run test                   # run a script from "scripts"
$ npx eslint .                   # run a package binary without installing globally
$ npm ci                         # clean, exact install from package-lock.json (CI)
```

| Version range | Accepts |
| --- | --- |
| `"4.18.2"` | Exactly that version |
| `"^4.18.2"` | `>=4.18.2 <5.0.0` — minor + patch updates (npm's default) |
| `"~4.18.2"` | `>=4.18.2 <4.19.0` — patch updates only |

```question
Is Node.js single-threaded?

---

Your JavaScript runs on a single main thread with an event loop, but Node itself uses libuv's thread pool for file I/O, DNS, crypto and compression, and you can create more JS threads with `worker_threads`.
```
