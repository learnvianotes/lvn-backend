# The public entrance (§16.2) with no domain of its own: CloudFront serves HTTPS on its https://<id>.cloudfront.net
# address and reaches the internal ALB privately through a VPC origin. Web and API share that one origin (/graphql goes
# to the API), so there is no CORS and the session cookie is first-party. A custom domain later is an alias and an ACM
# certificate on this distribution.

# The AWS stand-in (ADR-0066): Moto has no VPC origins and no cache or origin request policies. There the distribution
# reaches the ALB as a plain custom origin, and the managed policies are named by their fixed, documented ids.
locals {
  vpc_origin = !var.aws_emulator
  policy_ids = var.aws_emulator ? {
    disabled   = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    optimized  = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    all_viewer = "216adef6-5c7f-47e4-b989-5492eafa07d3"
    } : {
    disabled   = data.aws_cloudfront_cache_policy.disabled[0].id
    optimized  = data.aws_cloudfront_cache_policy.optimized[0].id
    all_viewer = data.aws_cloudfront_origin_request_policy.all_viewer[0].id
  }
}

moved {
  from = aws_cloudfront_vpc_origin.alb
  to   = aws_cloudfront_vpc_origin.alb[0]
}

resource "aws_cloudfront_vpc_origin" "alb" {
  count = local.vpc_origin ? 1 : 0
  vpc_origin_endpoint_config {
    name                   = var.name
    arn                    = var.alb_arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"
    origin_ssl_protocols {
      quantity = 1
      items    = ["TLSv1.2"]
    }
  }
  timeouts {
    create = "30m"
  }
}

data "aws_cloudfront_cache_policy" "disabled" {
  count = var.aws_emulator ? 0 : 1
  name  = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  count = var.aws_emulator ? 0 : 1
  name  = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  count = var.aws_emulator ? 0 : 1
  name  = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = var.name
  price_class     = var.price_class
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id   = "alb"
    domain_name = var.alb_dns_name
    dynamic "vpc_origin_config" {
      for_each = local.vpc_origin ? [1] : []
      content {
        vpc_origin_id = aws_cloudfront_vpc_origin.alb[0].id
      }
    }
    dynamic "custom_origin_config" {
      for_each = local.vpc_origin ? [] : [1]
      content {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Pages and the API: never cached here; the apps set their own caching headers. Every header, cookie and query string
  # reaches the origin (sessions, GraphQL, emailed links).
  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = local.policy_ids.disabled
    origin_request_policy_id = local.policy_ids.all_viewer
    compress                 = true
  }

  # Next's build assets are content-hashed and immutable.
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.policy_ids.optimized
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
