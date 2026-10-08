variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  description = "Where the internal ALB lives"
  type        = list(string)
}

variable "app_subnet_ids" {
  description = "Where the tasks run (network module's app_subnet_ids)"
  type        = list(string)
}

variable "assign_public_ip" {
  description = "True when the tasks run in public subnets (no NAT gateway)"
  type        = bool
}

variable "alb_security_group_id" {
  type = string
}

variable "apps_security_group_id" {
  type = string
}

variable "backend_environment" {
  description = "Plain variables of api, worker and migrate (docs/architecture/env.md)"
  type        = map(string)
}

variable "backend_secret_arns" {
  description = "Secret ARN by variable name for api, worker and migrate"
  type        = map(string)
}

variable "migrate_database_url_secret_arn" {
  description = "DATABASE_URL for the migrate task (Prisma's own TLS settings)"
  type        = string
}

variable "web_environment" {
  type = map(string)
}

variable "bucket_arns" {
  type = map(string)
}

variable "restricted_kms_key_arn" {
  type = string
}

variable "mail_policy_json" {
  description = "IAM policy that lets the backend send mail (mail module)"
  type        = string
}

variable "allow_destroy" {
  description = "Let `terraform destroy` delete image repositories that still hold images (sandbox)"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_count" {
  type    = number
  default = 1
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "worker_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "web_count" {
  type    = number
  default = 1
}
