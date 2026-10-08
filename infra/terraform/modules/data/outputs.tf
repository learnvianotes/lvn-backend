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

output "redis_url" {
  description = "TLS to ElastiCache (its certificates chain to a public CA)"
  value       = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
}

output "db_address" {
  value = aws_db_instance.this.address
}
