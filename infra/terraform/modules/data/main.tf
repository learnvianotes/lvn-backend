# PostgreSQL 16 (pgvector is created by the migrations) and Redis 7, private and encrypted (§16.2). The database master
# password is generated and kept by RDS in Secrets Manager; Terraform state never holds it.

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "this" {
  identifier                      = var.name
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.db_instance_class
  allocated_storage               = var.db_storage_gb
  max_allocated_storage           = var.db_storage_gb * 4
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "lvn"
  username                        = "lvn"
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [var.security_group_id]
  parameter_group_name            = aws_db_parameter_group.this.name
  multi_az                        = var.multi_az
  publicly_accessible             = false
  backup_retention_period         = var.backup_retention_days
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = !var.deletion_protection
  final_snapshot_identifier       = var.deletion_protection ? "${var.name}-final" : null
  performance_insights_enabled    = true
  auto_minor_version_upgrade      = true
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.name
  description                = "LearnViaNotes ${var.name}: sessions, rate limits, BullMQ queues"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.multi_az ? 2 : 1
  automatic_failover_enabled = var.multi_az
  multi_az_enabled           = var.multi_az
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [var.security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # BullMQ needs keys kept, not evicted.
  parameter_group_name = "default.redis7"
}
