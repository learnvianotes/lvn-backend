variable "name" {
  description = "Prefix of every container, volume and network"
  type        = string
  default     = "lvn-local"
}

variable "environment" {
  description = "APP_ENV of the apps: they run as in the AWS sandbox (no development shortcuts)"
  type        = string
  default     = "sandbox"
}

variable "public_url" {
  description = "The entrance as browsers and phones reach it (web, and the API at /graphql), e.g. http://100.70.234.41:8080"
  type        = string
}

variable "s3_public_url" {
  description = "The S3 endpoint as browsers and phones reach it: pre-signed upload and download URLs point here"
  type        = string
}

variable "api_image" {
  description = "Backend image (api, worker, migrations) loaded into the VM by deploy-local.sh; empty runs no apps yet"
  type        = string
  default     = ""
}

variable "web_image" {
  description = "Web image loaded into the VM by deploy-local.sh; empty runs no web yet"
  type        = string
  default     = ""
}

variable "pdf_engine_image" {
  description = "PDF engine image (workers/pdf-engine, ADR-0028) loaded into the VM by deploy-local.sh; empty runs none"
  type        = string
  default     = ""
}

variable "api_instances" {
  description = "API containers behind the entrance; two show that live updates fan out across instances (ADR-0042)"
  type        = number
  default     = 2
}

variable "pdf_engine_memory_mb" {
  description = "Memory the PDF engine may use; Docling on CPU needs about 2 GB for a large page"
  type        = number
  default     = 3072
}

variable "mail_from_address" {
  type    = string
  default = "no-reply@learnvianotes.local"
}

variable "mail_from_name" {
  type    = string
  default = "LearnViaNotes"
}

variable "firebase_project_id" {
  description = "Google sign-in (ADR-0007); empty switches it off"
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
  description = "Any other api/worker variable from docs/architecture/env.md"
  type        = map(string)
  default     = {}
}

# AI (ADR-0058): the host's Ollama, which the VM reaches at QEMU's host address. `none` switches AI off.
variable "ai_provider" {
  type    = string
  default = "ollama"
}

variable "ollama_url" {
  type    = string
  default = "http://10.0.2.2:11434"
}

variable "ai_chat_model" {
  type    = string
  default = "gemma4"
}

variable "ai_embed_model" {
  type    = string
  default = "embeddinggemma"
}
