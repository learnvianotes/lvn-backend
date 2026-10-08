# Sandbox (§16.1): shared staging, QA, demos and store review, in its own AWS account. Production is a copy of this
# root with production sizes (multi-AZ, deletion protection, two NAT gateways, more tasks) in a separate account.

locals {
  name = "lvn-sandbox"
  # Values held in Secrets Manager; each must be set before the first deploy (README).
  backend_secrets = ["DATABASE_URL", "REDIS_URL", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "CODE_HMAC_SECRET", "RESEND_API_KEY", "SENTRY_DSN"]
}

module "network" {
  source = "../../modules/network"
  name   = local.name
}

module "data" {
  source            = "../../modules/data"
  name              = local.name
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.data_security_group_id
}

module "storage" {
  source      = "../../modules/storage"
  name        = local.name
  web_origins = ["https://${var.web_host}"]
}

module "secrets" {
  source = "../../modules/secrets"
  name   = local.name
  names  = local.backend_secrets
}

module "service" {
  source                 = "../../modules/service"
  name                   = local.name
  vpc_id                 = module.network.vpc_id
  public_subnet_ids      = module.network.public_subnet_ids
  private_subnet_ids     = module.network.private_subnet_ids
  alb_security_group_id  = module.network.alb_security_group_id
  apps_security_group_id = module.network.apps_security_group_id
  certificate_arn        = var.certificate_arn
  api_host               = var.api_host
  image_tag              = var.image_tag
  bucket_arns            = module.storage.bucket_arns
  restricted_kms_key_arn = module.storage.restricted_kms_key_arn
  backend_secret_arns    = module.secrets.arns
  # docs/architecture/env.md — every URL from the environment (ADR-0022).
  backend_environment = merge(
    {
      APP_ENV                 = "sandbox"
      LOG_LEVEL               = "info"
      RELEASE                 = var.image_tag
      API_PORT                = "4000"
      WORKER_HEALTH_PORT      = "4001"
      TRUST_PROXY_HOPS        = "1"
      CORS_ORIGINS            = "https://${var.web_host}"
      WEB_URL                 = "https://${var.web_host}"
      JWT_ISSUER              = "https://${var.api_host}"
      S3_REGION               = var.region
      S3_BUCKET               = module.storage.files_bucket
      S3_RESTRICTED_BUCKET    = module.storage.restricted_bucket
      MAIL_FROM               = var.mail_from
      MAIL_TRANSPORT          = "resend"
      PASSWORD_BREACH_API_URL = "https://api.pwnedpasswords.com/range"
    },
    var.otel_exporter_otlp_endpoint == "" ? {} : { OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint },
  )
  web_environment = {
    NEXT_PUBLIC_APP_ENV  = "sandbox"
    NEXT_PUBLIC_SITE_URL = "https://${var.web_host}"
    NEXT_PUBLIC_API_URL  = "https://${var.api_host}/graphql"
  }
}
