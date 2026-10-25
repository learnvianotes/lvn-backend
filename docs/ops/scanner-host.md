# Scanner host

The upload scanner (ADR-0102) is its own Lightsail instance. The API and the worker on the main instance stream each
uploaded file to it over the private network and store the verdict. This host runs ClamAV (`clamd` and freshclam, in
the one ClamAV image) and `apps/scanner`. It has no database and no R2 credentials.

Beta's main instance is `lvn-test` in Mumbai (`ap-south-1`), public address `13.204.214.142`. The scanner goes in
that same region so the two instances can use each other's private addresses. Lightsail does not route private
addresses across regions.

## 1. Provision the instance

Bundle `small_3_1` is the 2 GB plan. Availability zone `ap-south-1a`, the same region as `lvn-test`.

```bash
aws lightsail create-instances \
  --region ap-south-1 \
  --availability-zone ap-south-1a \
  --instance-names lvn-scan-beta \
  --blueprint-id ubuntu_24_04 \
  --bundle-id small_3_1 \
  --key-pair-name <lightsail-key>
```

Wait until the state is `running`, then record both addresses:

```bash
aws lightsail get-instance --region ap-south-1 --instance-name lvn-scan-beta \
  --query 'instance.{public:publicIpAddress,private:privateIpAddress}' --output table

aws lightsail get-instance --region ap-south-1 --instance-name lvn-test \
  --query 'instance.privateIpAddress' --output text
```

Instances in the same region reach each other on those private addresses. That path is not governed by the public
networking firewall below. A public firewall rule does not open or close it. The host firewall in the next section
does.

Optional, so the public address stops changing: `aws lightsail allocate-static-ip` and
`attach-static-ip --instance-name lvn-scan-beta`. The service does not use the public address.

## 2. Firewall

### Public ports

`put-instance-public-ports` replaces the whole list. Leave SSH, from one address, and nothing else. Do not open
8080 or 3310.

```bash
aws lightsail put-instance-public-ports \
  --region ap-south-1 \
  --instance-name lvn-scan-beta \
  --port-infos fromPort=22,toPort=22,protocol=tcp,cidrs=<your-ip>/32
```

Confirm with `aws lightsail get-instance-port-states --region ap-south-1 --instance-name lvn-scan-beta`. The only
open public port is 22, and only from that `/32`.

### Host firewall

SSH in (`ssh -i <key> ubuntu@<public-ip>`) and install ufw. Docker's published ports bypass ufw, which is why
`apps/scanner/compose.yaml` uses the host network and does not publish a port. clamd listens on `127.0.0.1:3310`.
The scanner listens on the private IP only.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <your-ip>/32 to any port 22 proto tcp
sudo ufw allow from <lvn-test-private-ip> to any port 8080 proto tcp
sudo ufw allow from <lvn-scan-beta-private-ip> to any port 8080 proto tcp
sudo ufw enable
sudo ufw status verbose
```

The scanner's own private address is in that list because the container health check connects to the private IP
from the host itself, and the source address is then the private IP, not `127.0.0.1`. Loopback stays open, so
clamd on `127.0.0.1` is reachable only from this machine.

Outgoing traffic stays allowed. freshclam downloads signatures on port 443. Do not set the default outgoing policy
to deny.

Also set `SCANNER_ALLOW_FROM` (below) to those same two private addresses. A neighbour instance in the region can
route to this private IP; ufw and the allow-list are what refuse it. An unsigned request is refused even from an
allowed address.

### Removing public SSH

Do this only after the main instance can reach the scanner on its private IP (a jump host). From `lvn-test`:

```bash
ssh -i <key> ubuntu@<lvn-scan-beta-private-ip>
```

Then close the public port. `close-instance-public-ports` removes one rule and leaves the rest of the list:

```bash
aws lightsail close-instance-public-ports \
  --region ap-south-1 \
  --instance-name lvn-scan-beta \
  --port-info fromPort=22,toPort=22,protocol=tcp
```

After that, SSH is only `ssh -J ubuntu@<lvn-test-public-ip> ubuntu@<lvn-scan-beta-private-ip>`. To open it again for
a break-glass session, run the `put-instance-public-ports` command above. The Lightsail browser SSH console also
still works from the AWS account that owns the instance.

## 3. Prepare the host

The 2 GB plan needs swap. On a live `small_3_1`, clamd sits at about 934 MB and about 355 MB is free, with the
2 GB swap in use. clamd is capped at 1450 MB and the scanner at 256 MB (heap 160 MB). Leave
`SCANNER_CONCURRENCY` at 2: two scans of a 500 MB video can fill the 640 MB tmpfs, and there is no room for a
second copy of the signature database. PDFs are streamed from the temp file in 64 KB reads. The PDF cap stays
at 50 MB (`SCANNER_PDF_MAX_BYTES`); do not raise it. A large video can push the box into swap rather than
getting the process killed.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Docker Engine and the Compose plugin from Docker's Ubuntu repository (the distro packages are older), and
add the user that will deploy to the `docker` group. Log in again so the group applies.

Clock: the HMAC timestamp allows 300 seconds of skew. `timedatectl` should show NTP synchronized. Ubuntu 24.04 does
this by default; if it does not, `sudo timedatectl set-ntp true`.

## 4. Deploy

The image is built on this host from a checkout. Put the secret outside the checkout so a later `git checkout` does
not remove it.

```bash
sudo install -d -m 700 -o "$USER" /opt/lvn-scan
git clone https://github.com/learnvianotes/lvn-backend.git /opt/lvn-scan/repo
cd /opt/lvn-scan/repo
git checkout <the commit the beta API is running>

umask 077
cat > /opt/lvn-scan/scanner.env << 'EOF'
SCANNER_PRIVATE_IP=<lvn-scan-beta-private-ip>
SCANNER_PORT=8080
SCANNER_SECRET=<openssl rand -hex 32>
SCANNER_ALLOW_FROM=<lvn-scan-beta-private-ip>,<lvn-test-private-ip>
EOF
chmod 600 /opt/lvn-scan/scanner.env

set -a && source /opt/lvn-scan/scanner.env && set +a
docker compose -f apps/scanner/compose.yaml up -d --build
```

The image ships an old signature database. On a new volume, `/init` runs freshclam once before clamd starts.
When the volume already has that old database, clamd loads it and freshclam's later download does not always
reload clamd, so `/readyz` stays not-ready (503, `signatures: stale`) until clamd answers `RELOAD`. Compose
replaces the image entrypoint with `apps/scanner/clamd-entry.sh`, which runs `/init` and
`apps/scanner/clamd-reload.sh`. The helper waits until clamd answers, and sends `RELOAD` once `daily.cvd` or
`daily.cld` has a higher version than the one clamd reports. It tries for 45 minutes, then exits.
`ConcurrentDatabaseReload` stays off: two databases do not fit. The first start can take several minutes.
`clamd` is not marked healthy until clamd answers (`start_period` is 6 minutes, then retries). The scanner's
own health check stays failing until `/readyz` sees a fresh database. Watch it:

```bash
docker compose -f apps/scanner/compose.yaml ps
docker compose -f apps/scanner/compose.yaml logs -f clamd
```

`docker compose ps` shows the scanner healthy only after `/readyz` sees clamd and a fresh signature database. An
unsigned request from this host is refused:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "http://${SCANNER_PRIVATE_IP}:8080/healthz"
```

That prints `401`.

From `lvn-test`, the same unsigned request also prints `401`. A request from any other address is dropped by ufw
(no answer, or a timeout).

### Later deploys

```bash
cd /opt/lvn-scan/repo
git fetch origin && git checkout <new-commit>
set -a && source /opt/lvn-scan/scanner.env && set +a
docker compose -f apps/scanner/compose.yaml up -d --build
```

freshclam keeps the signatures current inside the `clamd` container. The database lives in the `clamdb` volume, so
a rebuild does not download it again.

## 5. Secrets

Generate one secret and put the same value on both hosts. `openssl rand -hex 32` prints 64 hex characters.

### This host

`/opt/lvn-scan/scanner.env`, mode 600:

| Variable | Value |
| --- | --- |
| `SCANNER_PRIVATE_IP` | This instance's private address. Compose binds it |
| `SCANNER_SECRET` | The shared HMAC key |
| `SCANNER_ALLOW_FROM` | This instance's private address and `lvn-test`'s private address, comma-separated |
| `SCANNER_PORT` | `8080` unless you also change the URL on the main host |

Do not put `DATABASE_URL` or any `S3_*` / R2 key in this file. Compose sets `CLAMAV_URL=tcp://127.0.0.1:3310` itself.
The other knobs (`SCANNER_MAX_BYTES`, `SCANNER_CONCURRENCY`, `SCANNER_RATE_PER_MINUTE`,
`SCANNER_SIGNATURE_MAX_AGE_HOURS`) have defaults in `apps/scanner/compose.yaml` and `docs/architecture/env.md`.
Concurrency defaults to 2, the same as `SCAN_QUEUE_CONCURRENCY` on the main host. A third scan, or more than 60
authenticated scan calls a minute from one address, is answered `429` with `Retry-After`. The worker waits and tries
again. Two scans of a 500 MB video can fill the 640 MB tmpfs; leave concurrency at 2 on this 2 GB host.

### The main instance

Both the API and the worker read the same `backend.env`. On Lightsail that file is filled from the GitHub
environment secret `LVN_BACKEND_EXTRA_ENV` (see `docs/runbooks/lightsail.md`). Add lines, do not replace the rest of
the secret:

```
SCAN_MODE=remote
SCANNER_URL=http://<lvn-scan-beta-private-ip>:8080
SCANNER_SECRET=<the same hex secret>
SCANNER_TIMEOUT_MS=180000
SCAN_QUEUE_CONCURRENCY=2
SCAN_JOB_ATTEMPTS=5
```

`SCAN_QUEUE_CONCURRENCY` must match this host's `SCANNER_CONCURRENCY`. The upload windows
(`UPLOADS_PER_MINUTE` 10, `UPLOADS_PER_DAY` 100, `UPLOAD_BYTES_PER_DAY` 524288000, `UPLOAD_PENDING_SCANS` 5,
`UPLOADS_PER_IP_PER_MINUTE` 30) apply without being set. A platform admin can change them, and the queue
concurrency, from the admin settings. The worker reads concurrency when it starts.

Do not set `CLAMAV_URL` on this instance while `SCAN_MODE=remote`. Redeploy lvn-backend so both containers pick the
lines up. Uploads stay off until `LVN_UPLOADS_ENABLED=true` as well (ADR-0097); a remote upload is then pending
until this service returns a clean verdict.

`SCAN_MODE=local` is the in-process clamd path (ADR-0041) and needs `CLAMAV_URL` instead of `SCANNER_URL`.
`SCAN_MODE=off` scans nothing. Leaving `SCAN_MODE` unset keeps that older rule: `CLAMAV_URL` means local, otherwise
off. Development may point `SCANNER_URL` at `http://127.0.0.1:8080`. Sandbox and production refuse anything that is
not a private IPv4 address.

Rotating `SCANNER_SECRET`: `docs/runbooks/rotate-secrets.md`. Change both hosts before expecting scans to succeed.
Until they match, files stay `PENDING` and are not served.

## What stays on the main server

The database, the R2 credentials, quarantine (the copy into the restricted bucket), image and video variants, and
the decision to serve a file. College ID cards are not sent here: they never enter the scan queue (ADR-0099).

Remote mode does not call this service from the media job. `FileReady` adds one job to the Redis queue `file-scan`
(job id is the file id, so a second enqueue is a no-op). The worker runs two of those jobs at a time. Each job tries
the HTTP call three times. The job itself is retried with exponential backoff (about 15s, then 30s, 60s, 120s, each
up to 20% shorter) and gives up after five attempts. That copy sits on `file-scan-dlq`, and the file is `FAILED`
and still not served. An open circuit pauses `file-scan` until it closes. One user has one scan in flight.

A `PENDING` file whose job is gone is queued again every 10 minutes (`retry-pending-scans`). A job that already
failed is left failed. While `/readyz` is not ready (stale signatures, or clamd down during the reload), the
worker pauses `file-scan` and puts the job back without using an attempt. That wait is not a failure: the file
stays `PENDING`, the circuit breaker stays closed, and nothing is reported. The last failed attempt of a scan
that did run is reported with the file owner's user id. Queue depth, wait, scan
time and failures are logged (`scan result=…`) and counted (`lvn.scan.wait`, `lvn.scan.duration`,
`lvn.scan.failures`). `adminMetrics.scans` shows how many files are pending or failed.
