output "alb_dns_name" {
  description = "Point the web and api hosts here (Route 53 alias or CNAME)"
  value       = aws_lb.this.dns_name
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "migrate_task_definition" {
  description = "Run once per deploy before the api service updates (§16.2)"
  value       = aws_ecs_task_definition.this["migrate"].arn
}
