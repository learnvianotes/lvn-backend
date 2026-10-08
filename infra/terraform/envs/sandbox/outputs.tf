output "public_url" {
  description = "The site; the API is <public_url>/graphql. Add its host to Firebase → Authentication → Authorized domains"
  value       = local.public_url
}

output "region" {
  value = var.region
}

output "ecr_repositories" {
  value = module.service.ecr_repositories
}

output "cluster_name" {
  value = module.service.cluster_name
}

output "migrate_task_family" {
  value = module.service.migrate_task_family
}

output "app_subnet_ids" {
  value = module.network.app_subnet_ids
}

output "apps_security_group_id" {
  value = module.network.apps_security_group_id
}

output "assign_public_ip" {
  value = module.network.apps_need_public_ip
}

output "image_tag_parameters" {
  value = module.service.image_tag_parameters
}

output "deployed_image_tags" {
  value = module.service.deployed_image_tags
}

output "app_environment" {
  description = "APP_ENV, for the web build"
  value       = var.environment
}
