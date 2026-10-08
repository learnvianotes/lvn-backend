variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "apps_security_group_id" {
  type = string
}

variable "certificate_arn" {
  description = "ACM certificate for the web and api hosts"
  type        = string
}

variable "api_host" {
  description = "Host routed to the API, e.g. api.sandbox.learnvianotes.in"
  type        = string
}

variable "image_tag" {
  description = "Commit SHA of the images to run; the same tag is promoted from sandbox to production"
  type        = string
}

variable "backend_environment" {
  description = "Plain variables of api, worker and migrate (docs/architecture/env.md)"
  type        = map(string)
}

variable "backend_secret_arns" {
  description = "Secret ARN by variable name for api, worker and migrate"
  type        = map(string)
}

variable "web_environment" {
  type = map(string)
}

variable "web_secret_arns" {
  type    = map(string)
  default = {}
}

variable "bucket_arns" {
  type = map(string)
}

variable "restricted_kms_key_arn" {
  type = string
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
