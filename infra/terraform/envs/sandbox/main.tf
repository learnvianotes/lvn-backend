# Sandbox (§16.1): shared staging, QA and demos in its own AWS account, with no domain of its own — the site and API are
# served at CloudFront's https://<id>.cloudfront.net address (ADR-0035). Production is this root with production sizes
# in a separate account.

locals {
  public_url = module.edge.public_url
  # Generated here and stored in Secrets Manager; nothing to enter by hand.
  secrets = {
    DATABASE_URL         = module.data.database_url
    DATABASE_URL_MIGRATE = module.data.migrate_database_url
    REDIS_URL            = module.data.redis_url
    JWT_PRIVATE_KEY      = tls_private_key.jwt.private_key_pem_pkcs8
    JWT_PUBLIC_KEY       = tls_private_key.jwt.public_key_pem
    CODE_HMAC_SECRET     = random_password.code_hmac.result
  }
  backend_secret_names = ["DATABASE_URL", "REDIS_URL", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "CODE_HMAC_SECRET"]
  optional = {
    FIREBASE_PROJECT_ID         = var.firebase_project_id
    SENTRY_DSN                  = var.sentry_dsn
    OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint
  }
}

# RS256 key pair for access tokens (§7.1) and the secret that hashes short codes.
resource "tls_private_key" "jwt" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "random_password" "code_hmac" {
  length  = 48
  special = false
}

module "network" {
  source       = "../../modules/network"
  name         = var.name
  nat_gateways = var.nat_gateway ? 1 : 0
}

module "data" {
  source            = "../../modules/data"
  name              = var.name
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.data_security_group_id
  db_instance_class = var.db_instance_class
  redis_node_type   = var.redis_node_type
}

module "storage" {
  source      = "../../modules/storage"
  name        = var.name
  web_origins = [local.public_url]
}

module "secrets" {
  source = "../../modules/secrets"
  name   = var.name
  names  = concat(local.backend_secret_names, ["DATABASE_URL_MIGRATE"])
  values = local.secrets
}

module "mail" {
  source       = "../../modules/mail"
  from_address = var.mail_from_address
}

module "service" {
  source                          = "../../modules/service"
  name                            = var.name
  vpc_id                          = module.network.vpc_id
  private_subnet_ids              = module.network.private_subnet_ids
  app_subnet_ids                  = module.network.app_subnet_ids
  assign_public_ip                = module.network.apps_need_public_ip
  alb_security_group_id           = module.network.alb_security_group_id
  apps_security_group_id          = module.network.apps_security_group_id
  bucket_arns                     = module.storage.bucket_arns
  restricted_kms_key_arn          = module.storage.restricted_kms_key_arn
  mail_policy_json                = module.mail.send_policy_json
  backend_secret_arns             = { for k in local.backend_secret_names : k => module.secrets.arns[k] }
  migrate_database_url_secret_arn = module.secrets.arns["DATABASE_URL_MIGRATE"]
  api_count                       = var.api_count
  worker_count                    = var.worker_count
  web_count                       = var.web_count
  # docs/architecture/env.md — every URL from the environment (ADR-0022); web and API share the CloudFront origin.
  backend_environment = merge(
    {
      APP_ENV            = var.environment
      LOG_LEVEL          = var.log_level
      API_PORT           = "4000"
      WORKER_HEALTH_PORT = "4001"
      # CloudFront, then the ALB: the client is two proxies back.
      TRUST_PROXY_HOPS        = "2"
      CORS_ORIGINS            = local.public_url
      WEB_URL                 = local.public_url
      JWT_ISSUER              = local.public_url
      S3_REGION               = var.region
      S3_BUCKET               = module.storage.files_bucket
      S3_RESTRICTED_BUCKET    = module.storage.restricted_bucket
      MAIL_TRANSPORT          = "ses"
      SES_REGION              = var.region
      MAIL_FROM               = "${var.mail_from_name} <${var.mail_from_address}>"
      PASSWORD_BREACH_API_URL = "https://api.pwnedpasswords.com/range"
    },
    { for k, v in local.optional : k => v if v != "" },
    var.extra_backend_environment,
  )
  web_environment = {
    NEXT_PUBLIC_APP_ENV  = var.environment
    NEXT_PUBLIC_SITE_URL = local.public_url
    NEXT_PUBLIC_API_URL  = "${local.public_url}/graphql"
  }
}

module "edge" {
  source       = "../../modules/edge"
  name         = var.name
  alb_arn      = module.service.alb_arn
  alb_dns_name = module.service.alb_dns_name
}

resource "aws_budgets_budget" "monthly" {
  count        = var.budget_alert_email == "" ? 0 : 1
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_monthly_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
