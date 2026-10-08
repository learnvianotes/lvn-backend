output "db_endpoint" {
  description = "host:port; DATABASE_URL is assembled in Secrets Manager with the RDS-managed password"
  value       = aws_db_instance.this.endpoint
}

output "db_master_secret_arn" {
  description = "Secrets Manager secret RDS keeps the master credentials in"
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}
