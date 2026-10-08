# VPC with public subnets (NAT, or the tasks when there is no NAT) and private subnets (the internal ALB, RDS, Redis,
# and the tasks when there is a NAT) in two availability zones. Nothing accepts traffic from the internet directly:
# viewers reach the ALB only through CloudFront (§16.2).

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.cidr_block, 8, count.index)
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.name}-public-${local.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.this.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index + 10)
  tags              = { Name = "${var.name}-private-${local.azs[count.index]}", Tier = "private" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = var.name }
}

resource "aws_eip" "nat" {
  count  = var.nat_gateways
  domain = "vpc"
  tags   = { Name = "${var.name}-nat-${count.index}" }
}

# NAT gives tasks in private subnets their egress (ECR, Secrets Manager, SES, Google). 0 saves its cost: the tasks then
# run in the public subnets with public IPs, still reachable only from the ALB's security group.
resource "aws_nat_gateway" "this" {
  count         = var.nat_gateways
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "${var.name}-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "${var.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.this.id
  dynamic "route" {
    for_each = var.nat_gateways > 0 ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.this[min(count.index, var.nat_gateways - 1)].id
    }
  }
  tags = { Name = "${var.name}-private-${count.index}" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Internal ALB: HTTP from CloudFront (VPC origin) only"
  vpc_id      = aws_vpc.this.id
}

# CloudFront reaches the internal ALB through its VPC origin from these AWS-managed addresses.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_apps" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.apps.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 4000
}

resource "aws_security_group" "apps" {
  name        = "${var.name}-apps"
  description = "ECS tasks: reachable from the ALB only"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_ingress_rule" "apps_from_alb" {
  security_group_id            = aws_security_group.apps.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 4000
}

# Tasks reach Postgres, Redis, S3, Secrets Manager, ECR and the mail/OAuth providers.
resource "aws_vpc_security_group_egress_rule" "apps_out" {
  security_group_id = aws_security_group.apps.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "data" {
  name        = "${var.name}-data"
  description = "Postgres and Redis: reachable from the ECS tasks only (spec 16.2)"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_ingress_rule" "postgres_from_apps" {
  security_group_id            = aws_security_group.data.id
  referenced_security_group_id = aws_security_group.apps.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_apps" {
  security_group_id            = aws_security_group.data.id
  referenced_security_group_id = aws_security_group.apps.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}
