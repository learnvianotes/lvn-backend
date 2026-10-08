output "alb_dns_name" {
  description = "Alias sandbox.learnvianotes.in and api.sandbox.learnvianotes.in to this"
  value       = module.service.alb_dns_name
}

output "ecr_repositories" {
  value = module.service.ecr_repositories
}

output "db_endpoint" {
  value = module.data.db_endpoint
}

output "db_master_secret_arn" {
  value = module.data.db_master_secret_arn
}

output "redis_endpoint" {
  value = module.data.redis_endpoint
}

output "secret_arns" {
  value = module.secrets.arns
}

output "migrate_task_definition" {
  value = module.service.migrate_task_definition
}
