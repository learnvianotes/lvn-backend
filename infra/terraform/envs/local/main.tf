# The local environment (ADR-0036): the sandbox's services as containers on one VM — PostgreSQL 16 with pgvector,
# Redis 7, S3-compatible storage (RustFS, ADR-0032), Mailpit instead of SES, Typesense (ADR-0055), the migration, the
# API, the worker, the web and one entrance. Secrets are generated here, as in the sandbox, and live only in the VM's state.

locals {
  images = {
    postgres  = "pgvector/pgvector:0.8.7-pg16"
    redis     = "redis:7.4.11-alpine"
    s3        = "rustfs/rustfs:1.0.1"
    mailpit   = "axllent/mailpit:v1.31.4"
    proxy     = "caddy:2.11.7-alpine"
    awscli    = "amazon/aws-cli:2.37.10"
    clamav    = "clamav/clamav:1.5.4"
    typesense = "typesense/typesense:30.2"
    # Monitoring (ADR-0089).
    otelcol      = "otel/opentelemetry-collector-contrib:0.111.0"
    prometheus   = "prom/prometheus:v2.55.1"
    alertmanager = "prom/alertmanager:v0.27.0"
    grafana      = "grafana/grafana:11.3.1"
  }
  apps    = var.api_image == "" ? 0 : 1
  web     = var.web_image == "" ? 0 : 1
  engine  = var.pdf_engine_image == "" ? 0 : 1
  buckets = { files = "${var.name}-files", restricted = "${var.name}-restricted" }
  s3_keys = { AWS_ACCESS_KEY_ID = random_password.s3_access_key.result, AWS_SECRET_ACCESS_KEY = random_password.s3_secret_key.result }
  # Container logs rotate instead of filling the disk.
  log_opts = { max-size = "10m", max-file = "3" }

  optional = {
    FIREBASE_PROJECT_ID = var.firebase_project_id
    SENTRY_DSN          = var.sentry_dsn
    # The local collector (ADR-0089) unless another endpoint is given.
    OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint != "" ? var.otel_exporter_otlp_endpoint : "http://otel-collector:4318"
  }
  # docs/architecture/env.md, as on Lightsail (ADR-0096); the differences are the endpoints and SMTP instead of Resend.
  backend_environment = merge(
    {
      APP_ENV            = var.environment
      LOG_LEVEL          = var.log_level
      API_PORT           = "4000"
      WORKER_HEALTH_PORT = "4001"
      # The entrance container is the only proxy whose X-Forwarded-For the API trusts.
      TRUST_PROXY_HOPS        = "1"
      CORS_ORIGINS            = var.public_url
      WEB_URL                 = var.public_url
      JWT_ISSUER              = var.public_url
      DATABASE_URL            = "postgresql://lvn:${random_password.postgres.result}@postgres:5432/lvn"
      REDIS_URL               = "redis://:${random_password.redis.result}@redis:6379"
      JWT_PRIVATE_KEY         = tls_private_key.jwt.private_key_pem_pkcs8
      JWT_PUBLIC_KEY          = tls_private_key.jwt.public_key_pem
      CODE_HMAC_SECRET        = random_password.code_hmac.result
      S3_ENDPOINT             = var.s3_public_url
      S3_REGION               = "us-east-1"
      S3_FORCE_PATH_STYLE     = "true"
      S3_ACCESS_KEY_ID        = random_password.s3_access_key.result
      S3_SECRET_ACCESS_KEY    = random_password.s3_secret_key.result
      S3_BUCKET               = local.buckets.files
      S3_RESTRICTED_BUCKET    = local.buckets.restricted
      MAIL_TRANSPORT          = "smtp"
      SMTP_URL                = "smtp://mailpit:1025"
      MAIL_FROM               = "${var.mail_from_name} <${var.mail_from_address}>"
      PASSWORD_BREACH_API_URL = "https://api.pwnedpasswords.com/range"
      # Public note pages refresh when a note changes (P2d): the API calls the web container directly.
      WEB_REVALIDATE_URL = "http://web:3000/api/revalidate"
      REVALIDATE_SECRET  = random_password.revalidate.result
      # Upload scans (ADR-0041). The local environment keeps uploads on (ADR-0097: off by default) for the live checks.
      CLAMAV_URL      = "tcp://clamav:3310"
      UPLOADS_ENABLED = "true"
      # Project workspaces' repository cards (ADR-0048): the providers' public APIs, no token.
      GITHUB_API_URL = "https://api.github.com"
      GITLAB_API_URL = "https://gitlab.com/api/v4"
      # Resources (ADR-0074): books by ISBN and their covers from Open Library, no key.
      OPEN_LIBRARY_URL        = "https://openlibrary.org"
      OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org"
      # Search on Typesense (ADR-0055); Postgres answers when it cannot.
      SEARCH_PROVIDER   = "typesense"
      TYPESENSE_URL     = "http://typesense:8108"
      TYPESENSE_API_KEY = random_password.typesense.result
      # AI on the dev machine's GPU (ADR-0058): its Ollama, through QEMU's user network.
      AI_PROVIDER    = var.ai_provider
      OLLAMA_URL     = var.ollama_url
      AI_CHAT_MODEL  = var.ai_chat_model
      AI_EMBED_MODEL = var.ai_embed_model
      # The budget breaker (ADR-0058), shown tripping and resetting by the lifecycle check.
      AI_MONTHLY_BUDGET_MICRO_USD = tostring(var.ai_monthly_budget_micro_usd)
      # Encrypts the provider keys saved on /admin/ai (ADR-0065).
      AI_KEYS_SECRET = random_password.ai_keys.result
    },
    { for k, v in local.optional : k => v if v != "" },
    var.extra_backend_environment,
  )
  env_list = [for k, v in local.backend_environment : "${k}=${v}"]
  # Health checks run inside the containers, which have node but no curl.
  node_check = "fetch('http://127.0.0.1:%d%s').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
}

# RS256 key pair for access tokens (§7.1), the secret that hashes short codes, and the data services' passwords.
resource "tls_private_key" "jwt" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "random_password" "code_hmac" {
  length  = 48
  special = false
}

resource "random_password" "ai_keys" {
  length  = 48
  special = false
}

resource "random_password" "revalidate" {
  length  = 48
  special = false
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "random_password" "typesense" {
  length  = 40
  special = false
}

resource "random_password" "s3_access_key" {
  length  = 20
  special = false
}

resource "random_password" "s3_secret_key" {
  length  = 40
  special = false
}

resource "docker_image" "this" {
  for_each     = local.images
  name         = each.value
  keep_locally = true
}

resource "docker_network" "this" {
  name = var.name
}

resource "docker_volume" "this" {
  for_each = toset(["postgres", "s3", "clamav", "typesense", "redis", "prometheus", "grafana"])
  name     = "${var.name}-${each.key}"
}

resource "docker_container" "postgres" {
  name     = "${var.name}-postgres"
  image    = docker_image.this["postgres"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  env      = ["POSTGRES_USER=lvn", "POSTGRES_PASSWORD=${random_password.postgres.result}", "POSTGRES_DB=lvn"]
  # Query statistics for the performance review (Phase 9, as the AWS module's parameter group): the slowest queries by
  # total time, read with `CREATE EXTENSION pg_stat_statements` once (docs/runbooks/on-call.md).
  command = ["postgres", "-c", "shared_preload_libraries=pg_stat_statements", "-c", "pg_stat_statements.track=top"]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["postgres"]
  }
  volumes {
    volume_name    = docker_volume.this["postgres"].name
    container_path = "/var/lib/postgresql/data"
  }
  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U lvn -d lvn"]
    interval = "2s"
    retries  = 30
  }
  wait = true
}

resource "docker_container" "redis" {
  name     = "${var.name}-redis"
  image    = docker_image.this["redis"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  # BullMQ keeps its jobs in Redis (ADR-0089): nothing may be evicted (noeviction: a full Redis refuses writes, which
  # is seen, instead of dropping a job, which is not), and the append-only file, synced every second, keeps queued jobs
  # through a restart. The cap stays well inside the VM's memory.
  command = ["redis-server", "--requirepass", random_password.redis.result, "--maxmemory", "512mb", "--maxmemory-policy", "noeviction", "--appendonly", "yes", "--appendfsync", "everysec"]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["redis"]
  }
  volumes {
    volume_name    = docker_volume.this["redis"].name
    container_path = "/data"
  }
  healthcheck {
    # redis-cli reads the password from REDISCLI_AUTH.
    test     = ["CMD-SHELL", "redis-cli ping | grep -q PONG"]
    interval = "2s"
    retries  = 30
  }
  env  = ["REDISCLI_AUTH=${random_password.redis.result}"]
  wait = true
}

# S3 API on the VM's port 9000, which vm.sh publishes as s3_public_url: pre-signed URLs must reach it from outside.
resource "docker_container" "s3" {
  name     = "${var.name}-s3"
  image    = docker_image.this["s3"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  env = [
    "RUSTFS_ADDRESS=:9000",
    "RUSTFS_CONSOLE_ENABLE=false",
    "RUSTFS_ACCESS_KEY=${random_password.s3_access_key.result}",
    "RUSTFS_SECRET_KEY=${random_password.s3_secret_key.result}",
  ]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["s3"]
  }
  ports {
    internal = 9000
    external = 9000
  }
  volumes {
    volume_name    = docker_volume.this["s3"].name
    container_path = "/data"
  }
}

# Uploads from the web: browsers PUT to pre-signed URLs with content-type and x-amz-meta-* headers. RustFS 1.0.1 does not
# match listed AllowedHeaders (any requested header failed the preflight), so the local rule allows all headers; on
# Lightsail, R2 keeps a narrow list (docs/runbooks/lightsail.md).
locals {
  # Uploads from the web's origin; reads from anywhere, because a read URL is itself the permission and the phone's PDF
  # reader runs in a web view without a web origin (ADR-0040). ExposeHeaders: PDFs load by range requests.
  files_cors = jsonencode({ CORSRules = [
    { AllowedMethods = ["PUT", "GET"], AllowedOrigins = [var.public_url], AllowedHeaders = ["*"], ExposeHeaders = ["Accept-Ranges", "Content-Range", "Content-Length", "ETag"], MaxAgeSeconds = 600 },
    { AllowedMethods = ["GET"], AllowedOrigins = ["*"], AllowedHeaders = ["*"], ExposeHeaders = ["Accept-Ranges", "Content-Range", "Content-Length", "ETag"], MaxAgeSeconds = 600 },
  ] })
}

# The two buckets (on Lightsail they are R2's, ADR-0096), with the files bucket's CORS rule.
resource "terraform_data" "buckets" {
  triggers_replace = [docker_container.s3.id, local.buckets, local.files_cors]
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    environment = local.s3_keys
    command     = <<-EOT
      set -euo pipefail
      s3() { docker run --rm --network ${docker_network.this.name} -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION=us-east-1 ${local.images.awscli} --endpoint-url http://s3:9000 s3api "$@"; }
      for _ in $(seq 1 30); do s3 list-buckets >/dev/null 2>&1 && break; sleep 1; done
      for b in ${join(" ", values(local.buckets))}; do s3 head-bucket --bucket "$b" 2>/dev/null || s3 create-bucket --bucket "$b" >/dev/null; done
      s3 put-bucket-cors --bucket ${local.buckets.files} --cors-configuration '${local.files_cors}'
    EOT
  }
  depends_on = [docker_image.this]
}

# Every email the environment sends, readable on the host at 127.0.0.1:LVN_VM_MAIL_PORT (SES's place in the sandbox).
resource "docker_container" "mailpit" {
  name     = "${var.name}-mailpit"
  image    = docker_image.this["mailpit"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["mailpit"]
  }
  ports {
    internal = 8025
    external = 8025
  }
}

# ClamAV's clamd for the worker's upload scans (ADR-0041). It loads its signatures on start (and fetches updates), so
# it needs about 1.5 GB of memory and a few minutes before it answers; until then scans are retried.
resource "docker_container" "clamav" {
  name     = "${var.name}-clamav"
  image    = docker_image.this["clamav"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  memory   = 2048
  env = [
    # Uploads go up to 500 MB (video, §8.1): clamd must take streams that large.
    "CLAMD_CONF_StreamMaxLength=600M",
    "CLAMD_CONF_MaxScanSize=600M",
    "CLAMD_CONF_MaxFileSize=600M",
    # Signatures take about 1 GB; reloading them beside the loaded set would double that past the cap. Scans wait for
    # the few seconds of a reload instead.
    "CLAMD_CONF_ConcurrentDatabaseReload=no",
  ]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["clamav"]
  }
  volumes {
    container_path = "/var/lib/clamav"
    volume_name    = docker_volume.this["clamav"].name
  }
}

# Search (ADR-0055). Derived data: the worker rebuilds every collection from Postgres if this volume is lost.
resource "docker_container" "typesense" {
  name     = "${var.name}-typesense"
  image    = docker_image.this["typesense"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  memory   = 1024
  command  = ["--data-dir", "/data", "--api-key", random_password.typesense.result]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["typesense"]
  }
  volumes {
    volume_name    = docker_volume.this["typesense"].name
    container_path = "/data"
  }
  healthcheck {
    # The image has bash but neither curl nor wget.
    test     = ["CMD", "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8108 && printf 'GET /health HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q '\"ok\":true' <&3"]
    interval = "5s"
    retries  = 24
  }
  wait         = true
  wait_timeout = 120
}

# Migrations with the new backend image, before any api or worker container on it starts (deploy.sh's migrate task).
resource "terraform_data" "migrate" {
  count            = local.apps
  triggers_replace = [var.api_image]
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    environment = { DATABASE_URL = local.backend_environment.DATABASE_URL }
    command     = "docker run --rm --network ${docker_network.this.name} -e DATABASE_URL ${var.api_image} node scripts/migrate-and-sync.mjs"
  }
  depends_on = [docker_container.postgres]
}

resource "docker_container" "api" {
  count        = local.apps * var.api_instances
  name         = count.index == 0 ? "${var.name}-api" : "${var.name}-api-${count.index + 1}"
  image        = var.api_image
  restart      = "unless-stopped"
  log_opts     = local.log_opts
  env          = local.env_list
  stop_timeout = 30
  networks_advanced {
    name = docker_network.this.id
    # "api" is any instance (the web's server-side calls); "api-N" is this one (the entrance balances over them).
    aliases = ["api", "api-${count.index + 1}"]
  }
  healthcheck {
    test         = ["CMD", "node", "-e", format(local.node_check, 4000, "/health/ready")]
    interval     = "5s"
    retries      = 12
    start_period = "10s"
  }
  wait         = true
  wait_timeout = 180
  depends_on   = [terraform_data.migrate, terraform_data.buckets, docker_container.redis, docker_container.mailpit, docker_container.typesense]
}

resource "docker_container" "worker" {
  count        = local.apps
  name         = "${var.name}-worker"
  image        = var.api_image
  command      = ["node", "apps/worker/dist/main.js"]
  restart      = "unless-stopped"
  log_opts     = local.log_opts
  env          = local.env_list
  stop_timeout = 30
  networks_advanced {
    name = docker_network.this.id
  }
  healthcheck {
    test         = ["CMD", "node", "-e", format(local.node_check, 4001, "/health/ready")]
    interval     = "5s"
    retries      = 12
    start_period = "10s"
  }
  wait         = true
  wait_timeout = 180
  depends_on   = [terraform_data.migrate, terraform_data.buckets, docker_container.redis, docker_container.mailpit, docker_container.typesense]
}

# The PDF engine (ADR-0028): Docling and RapidOCR on CPU, one PDF at a time, reading jobs from Redis and files from
# storage inside the network. It answers the notes context through Redis; nothing reaches it from outside.
resource "docker_container" "pdf_engine" {
  count        = local.engine
  name         = "${var.name}-pdf-engine"
  image        = var.pdf_engine_image
  restart      = "unless-stopped"
  log_opts     = local.log_opts
  memory       = var.pdf_engine_memory_mb
  stop_timeout = 60
  env = [
    "REDIS_URL=redis://:${random_password.redis.result}@redis:6379",
    "S3_ENDPOINT=http://s3:9000",
    "S3_REGION=us-east-1",
    "S3_FORCE_PATH_STYLE=true",
    "S3_ACCESS_KEY_ID=${random_password.s3_access_key.result}",
    "S3_SECRET_ACCESS_KEY=${random_password.s3_secret_key.result}",
    "PDF_ENGINE_CONCURRENCY=1",
    "PDF_ENGINE_OCR_LANGUAGES=en",
  ]
  networks_advanced {
    name = docker_network.this.id
  }
  depends_on = [terraform_data.buckets, docker_container.redis]
}

resource "docker_container" "web" {
  count    = local.web
  name     = "${var.name}-web"
  image    = var.web_image
  restart  = "unless-stopped"
  log_opts = local.log_opts
  env = [
    "NEXT_PUBLIC_APP_ENV=${var.environment}",
    "NEXT_PUBLIC_SITE_URL=${var.public_url}",
    "NEXT_PUBLIC_API_URL=${var.public_url}/graphql",
    "NEXT_PUBLIC_LIVE_URL=${replace(var.public_url, "/^http/", "ws")}/graphql/live",
    # Server-side rendering (public note pages) reaches the API inside the network, not through the entrance.
    "API_INTERNAL_URL=http://api:4000/graphql",
    "REVALIDATE_SECRET=${random_password.revalidate.result}",
  ]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["web"]
  }
  healthcheck {
    test         = ["CMD", "node", "-e", format(local.node_check, 3000, "/")]
    interval     = "5s"
    retries      = 12
    start_period = "10s"
  }
  wait         = true
  wait_timeout = 180
}

# On the VM's port 80, which vm.sh publishes as public_url.
resource "docker_container" "proxy" {
  name     = "${var.name}-proxy"
  image    = docker_image.this["proxy"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  networks_advanced {
    name = docker_network.this.id
  }
  ports {
    internal = 80
    external = 80
  }
  upload {
    file    = "/etc/caddy/Caddyfile"
    content = templatefile("${path.module}/Caddyfile.tftpl", { api = join(" ", [for i in range(var.api_instances) : "api-${i + 1}:4000"]), web = "web:3000", grafana = "grafana:3000" })
  }
}
