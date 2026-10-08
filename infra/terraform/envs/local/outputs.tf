output "public_url" {
  value = var.public_url
}

output "s3_public_url" {
  value = var.s3_public_url
}

output "app_environment" {
  value = var.environment
}

output "images" {
  value = { api = var.api_image, web = var.web_image }
}
