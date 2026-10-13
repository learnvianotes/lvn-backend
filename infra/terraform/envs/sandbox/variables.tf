# Every value comes from envs/<env>/.env as TF_VAR_<name> (run.sh loads it). Defaults suit a sandbox.

variable "name" {
  description = "Prefix of every resource"
  type        = string
  default     = "lvn-sandbox"
}

variable "environment" {
  description = "APP_ENV of the apps: sandbox or production"
  type        = string
  default     = "sandbox"
}

variable "region" {
  description = "AWS region; ap-south-1 (Mumbai) keeps learners' data in India"
  type        = string
  default     = "ap-south-1"
}

variable "nat_gateway" {
  description = "false saves the NAT gateway: tasks then run in public subnets (still reachable only from the ALB)"
  type        = bool
  default     = true
}

variable "mail_from_address" {
  description = "Sender address you own; SES emails it a verification link after the first apply"
  type        = string
}

variable "mail_from_name" {
  type    = string
  default = "LearnViaNotes"
}

variable "firebase_project_id" {
  description = "Firebase project whose Google sign-ins the API accepts; empty switches Google sign-in off"
  type        = string
  default     = ""
}

variable "sentry_dsn" {
  type    = string
  default = ""
}

variable "otel_exporter_otlp_endpoint" {
  type    = string
  default = ""
}

variable "log_level" {
  type    = string
  default = "info"
}

variable "extra_backend_environment" {
  description = "Any other api/worker variable (docs/architecture/env.md), e.g. {\"DIGITAL_CONSENT_AGE\" = \"18\"}"
  type        = map(string)
  default     = {}
}

variable "budget_monthly_usd" {
  type    = number
  default = 150
}

variable "budget_alert_email" {
  description = "Where the monthly budget alerts go; empty creates no budget"
  type        = string
  default     = ""
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "api_count" {
  type    = number
  default = 1
}

variable "worker_count" {
  type    = number
  default = 1
}

variable "web_count" {
  type    = number
  default = 1
}

variable "aws_emulator" {
  description = "true only for the AWS stand-in (ADR-0066): an AWS emulator (Moto) at AWS_ENDPOINT_URL instead of AWS"
  type        = bool
  default     = false
}
