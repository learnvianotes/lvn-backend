variable "name" {
  type = string
}

variable "alb_arn" {
  type = string
}

variable "alb_dns_name" {
  type = string
}

variable "price_class" {
  description = "PriceClass_200 includes India; PriceClass_All adds South America and Australia"
  type        = string
  default     = "PriceClass_200"
}

variable "aws_emulator" {
  description = "true only for the AWS stand-in (ADR-0066): leaves out what Moto cannot create"
  type        = bool
  default     = false
}

variable "api_requests_per_address_per_5_minutes" {
  description = "The edge's flood limit for /graphql from one address (ADR-0090); a campus behind one address stays well under it"
  type        = number
  default     = 10000
}
