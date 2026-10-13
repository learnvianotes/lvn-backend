locals {
  db_base = "postgresql://lvn:${random_password.db.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/lvn"
}

output "database_url" {
  description = "For the apps (node-postgres): TLS verified against the RDS CAs the image trusts (NODE_EXTRA_CA_CERTS)"
  value       = "${local.db_base}?sslmode=verify-full"
  sensitive   = true
}

output "migrate_database_url" {
  description = "For `prisma migrate deploy` (Prisma's schema engine): TLS verified against the RDS CA bundle in the image"
  value       = "${local.db_base}?sslmode=require&sslcert=/etc/ssl/certs/rds-global-bundle.pem&sslaccept=strict"
  sensitive   = true
}

locals {
  # The AWS stand-in (ADR-0066) has no Redis (main.tf): a placeholder host stands in; nothing connects to it there.
  redis_host = var.aws_emulator ? "${var.name}.emulated.cache.amazonaws.com" : aws_elasticache_replication_group.this[0].primary_endpoint_address
}

output "redis_url" {
  description = "TLS to ElastiCache (its certificates chain to a public CA)"
  value       = "rediss://${local.redis_host}:6379"
}

output "db_address" {
  value = aws_db_instance.this.address
}
