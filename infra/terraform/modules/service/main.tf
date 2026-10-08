# ECS Fargate services behind one ALB (§16.2): web (Next.js) and api (NestJS) are public through the ALB, the worker
# is not. One immutable image per commit, promoted sandbox → production (`image_tag`). Migrations run as a one-off
# task from the api image before new api tasks start (`migrate` task definition).

data "aws_region" "current" {}

locals {
  apps = {
    api    = { port = 4000, cpu = var.api_cpu, memory = var.api_memory, count = var.api_count, public = true, health = "/health/ready", command = null }
    worker = { port = 4001, cpu = var.worker_cpu, memory = var.worker_memory, count = var.worker_count, public = false, health = null, command = ["node", "apps/worker/dist/main.js"] }
    web    = { port = 3000, cpu = var.web_cpu, memory = var.web_memory, count = var.web_count, public = true, health = "/", command = null }
  }
  # The worker runs from the api image (same contexts, ADR-0033); web has its own.
  images = {
    api     = "${aws_ecr_repository.this["api"].repository_url}:${var.image_tag}"
    worker  = "${aws_ecr_repository.this["api"].repository_url}:${var.image_tag}"
    web     = "${aws_ecr_repository.this["web"].repository_url}:${var.image_tag}"
    migrate = "${aws_ecr_repository.this["api"].repository_url}:${var.image_tag}"
  }
  backend_environment = [for k, v in var.backend_environment : { name = k, value = v }]
  backend_secrets     = [for k, arn in var.backend_secret_arns : { name = k, valueFrom = arn }]
}

resource "aws_ecr_repository" "this" {
  for_each             = toset(["api", "web"])
  name                 = "${var.name}/${each.value}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
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

# Execution role: pull images, write logs, read the task secrets.
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

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
    resources = concat(values(var.backend_secret_arns), values(var.web_secret_arns))
  }
}

resource "aws_iam_role_policy" "read_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.read_secrets.json
}

# Task role of api, worker and migrate: the two buckets, and the restricted bucket's key.
resource "aws_iam_role" "backend" {
  name               = "${var.name}-backend"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "backend" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject"]
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

resource "aws_iam_role" "web" {
  name               = "${var.name}-web"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_ecs_task_definition" "this" {
  for_each                 = merge(local.apps, { migrate = { port = null, cpu = 256, memory = 512, count = 0, public = false, health = null, command = ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"] } })
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
    image        = local.images[each.key]
    essential    = true
    command      = each.value.command
    portMappings = each.value.port == null ? [] : [{ containerPort = each.value.port, protocol = "tcp" }]
    environment  = each.key == "web" ? [for k, v in var.web_environment : { name = k, value = v }] : local.backend_environment
    secrets      = each.key == "web" ? [for k, arn in var.web_secret_arns : { name = k, valueFrom = arn }] : local.backend_secrets
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
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
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

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["web"].arn
  }
}

# api.<domain> → api; everything else → web.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["api"].arn
  }
  condition {
    host_header {
      values = [var.api_host]
    }
  }
}

resource "aws_ecs_service" "this" {
  for_each               = local.apps
  name                   = each.key
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.this[each.key].arn
  desired_count          = each.value.count
  launch_type            = "FARGATE"
  enable_execute_command = false
  propagate_tags         = "SERVICE"
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.apps_security_group_id]
    assign_public_ip = false
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
  depends_on = [aws_lb_listener.https]
}
