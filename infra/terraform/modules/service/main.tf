# ECS Fargate services behind one internal ALB (§16.2): web (Next.js) and api (NestJS) take traffic from CloudFront
# through the ALB; the worker takes none. One image per commit, promoted sandbox → production. Migrations run as a
# one-off `migrate` task from the api image before new api tasks start (infra/scripts/deploy.sh).
#
# The image tags live in SSM Parameter Store, written by the deploy script: a plain `terraform apply` keeps whatever is
# deployed, and services stay at zero tasks until their first image is pushed.

data "aws_region" "current" {}

resource "aws_ssm_parameter" "image_tag" {
  for_each       = toset(["api", "web"])
  name           = "/${var.name}/deploy/${each.key}-image-tag"
  type           = "String"
  insecure_value = "none"
  lifecycle {
    ignore_changes = [insecure_value]
  }
}

locals {
  tags = { for k, p in aws_ssm_parameter.image_tag : k => p.insecure_value }
  apps = {
    api    = { port = 4000, cpu = var.api_cpu, memory = var.api_memory, count = var.api_count, public = true, health = "/health/ready", command = null, image = "api" }
    worker = { port = 4001, cpu = var.worker_cpu, memory = var.worker_memory, count = var.worker_count, public = false, health = null, command = ["node", "apps/worker/dist/main.js"], image = "api" }
    web    = { port = 3000, cpu = var.web_cpu, memory = var.web_memory, count = var.web_count, public = true, health = "/", command = null, image = "web" }
  }
  migrate = { port = null, cpu = 256, memory = 512, count = 0, public = false, health = null, command = ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"], image = "api" }

  backend_environment = [for k, v in var.backend_environment : { name = k, value = v }]
  backend_secrets     = [for k, arn in var.backend_secret_arns : { name = k, valueFrom = arn }]
  # Prisma's schema engine verifies TLS its own way, so migrations get their own DATABASE_URL.
  migrate_secrets = [for k, arn in merge(var.backend_secret_arns, { DATABASE_URL = var.migrate_database_url_secret_arn }) : { name = k, valueFrom = arn }]
}

resource "aws_ecr_repository" "this" {
  for_each             = toset(["api", "web"])
  name                 = "${var.name}/${each.value}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = var.allow_destroy
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 30 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 30 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_ecs_cluster" "this" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "this" {
  for_each          = toset(["api", "worker", "web", "migrate"])
  name              = "/ecs/${var.name}/${each.value}"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role: pull images, write logs, read the task secrets.
resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "read_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = concat(values(var.backend_secret_arns), [var.migrate_database_url_secret_arn])
  }
}

resource "aws_iam_role_policy" "read_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.read_secrets.json
}

# Task role of api, worker and migrate: the two buckets, the restricted bucket's key, and sending mail through SES.
resource "aws_iam_role" "backend" {
  name               = "${var.name}-backend"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "backend" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [for arn in values(var.bucket_arns) : "${arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = values(var.bucket_arns)
  }
  statement {
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [var.restricted_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "backend" {
  name   = "storage"
  role   = aws_iam_role.backend.id
  policy = data.aws_iam_policy_document.backend.json
}

resource "aws_iam_role_policy" "backend_mail" {
  name   = "mail"
  role   = aws_iam_role.backend.id
  policy = var.mail_policy_json
}

resource "aws_iam_role" "web" {
  name               = "${var.name}-web"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_ecs_task_definition" "this" {
  for_each                 = merge(local.apps, { migrate = local.migrate })
  family                   = "${var.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = each.key == "web" ? aws_iam_role.web.arn : aws_iam_role.backend.arn
  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
  container_definitions = jsonencode([{
    name         = each.key
    image        = "${aws_ecr_repository.this[each.value.image].repository_url}:${local.tags[each.value.image]}"
    essential    = true
    command      = each.value.command
    portMappings = each.value.port == null ? [] : [{ containerPort = each.value.port, protocol = "tcp" }]
    environment  = each.key == "web" ? [for k, v in var.web_environment : { name = k, value = v }] : local.backend_environment
    secrets      = each.key == "web" ? [] : each.key == "migrate" ? local.migrate_secrets : local.backend_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.this[each.key].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = each.key
      }
    }
    # The apps flush telemetry on SIGTERM; give them time before SIGKILL.
    stopTimeout = 30
  }])
}

resource "aws_lb" "this" {
  name                       = var.name
  internal                   = true
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.private_subnet_ids
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "this" {
  for_each             = { for k, v in local.apps : k => v if v.public }
  name                 = "${var.name}-${each.key}"
  port                 = each.value.port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30
  health_check {
    path                = each.value.health
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Viewers arrive over HTTPS at CloudFront; CloudFront → ALB stays inside AWS through the VPC origin.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["web"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["api"].arn
  }
  condition {
    path_pattern {
      values = ["/graphql", "/graphql/*", "/health/*"]
    }
  }
}

resource "aws_ecs_service" "this" {
  for_each               = local.apps
  name                   = each.key
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.this[each.key].arn
  desired_count          = local.tags[each.value.image] == "none" ? 0 : each.value.count
  launch_type            = "FARGATE"
  enable_execute_command = false
  propagate_tags         = "SERVICE"
  network_configuration {
    subnets          = var.app_subnet_ids
    security_groups  = [var.apps_security_group_id]
    assign_public_ip = var.assign_public_ip
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  dynamic "load_balancer" {
    for_each = each.value.public ? [each.key] : []
    content {
      target_group_arn = aws_lb_target_group.this[each.key].arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }
  depends_on = [aws_lb_listener.http]
}
