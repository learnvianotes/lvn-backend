variable "name" {
  type = string
}

variable "web_origins" {
  description = "Origins allowed to PUT and GET with pre-signed URLs, e.g. https://sandbox.learnvianotes.in"
  type        = list(string)
}
