output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "apps_security_group_id" {
  value = aws_security_group.apps.id
}

output "data_security_group_id" {
  value = aws_security_group.data.id
}

output "app_subnet_ids" {
  description = "Where the ECS tasks run: private subnets behind NAT, or public subnets without it"
  value       = var.nat_gateways > 0 ? aws_subnet.private[*].id : aws_subnet.public[*].id
}

output "apps_need_public_ip" {
  value = var.nat_gateways == 0
}
