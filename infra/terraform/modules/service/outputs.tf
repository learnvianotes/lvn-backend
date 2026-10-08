output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "migrate_task_family" {
  value = aws_ecs_task_definition.this["migrate"].family
}

output "image_tag_parameters" {
  description = "SSM parameters the deploy script writes the image tags to"
  value       = { for k, p in aws_ssm_parameter.image_tag : k => p.name }
}

output "deployed_image_tags" {
  value = local.tags
}
