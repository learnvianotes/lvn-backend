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
