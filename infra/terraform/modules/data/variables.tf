variable "name" {
  type = string
}

variable "subnet_ids" {
  description = "Private subnets"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group that admits the ECS tasks only"
  type        = string
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_storage_gb" {
  type    = number
  default = 20
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "multi_az" {
  description = "Standby database and a Redis replica in a second AZ (production)"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "deletion_protection" {
  description = "Refuse to delete the database (production); sandbox is reset weekly (§16.1)"
  type        = bool
  default     = false
}

variable "aws_emulator" {
  description = "true only for the AWS stand-in (ADR-0066): leaves out what Moto cannot create"
  type        = bool
  default     = false
}
