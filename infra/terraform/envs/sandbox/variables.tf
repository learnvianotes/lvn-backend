variable "region" {
  description = "Mumbai: closest to the learners and keeps their data in India (DPDP Act)"
  type        = string
  default     = "ap-south-1"
}

variable "web_host" {
  type    = string
  default = "sandbox.learnvianotes.in"
}

variable "api_host" {
  type    = string
  default = "api.sandbox.learnvianotes.in"
}

variable "certificate_arn" {
  description = "ACM certificate in var.region covering web_host and api_host"
  type        = string
}

variable "image_tag" {
  description = "Commit SHA built by CI and pushed to the ECR repositories"
  type        = string
}

variable "mail_from" {
  type    = string
  default = "LearnViaNotes <no-reply@sandbox.learnvianotes.in>"
}

variable "otel_exporter_otlp_endpoint" {
  description = "OTLP/HTTP collector for traces and metrics; empty turns them off"
  type        = string
  default     = ""
}
