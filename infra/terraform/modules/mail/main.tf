# Email through Amazon SES (MAIL_TRANSPORT=ses): the sender address is an SES identity. After the first apply AWS emails
# that address a verification link; nothing is sent until it is clicked. A new SES account is in the sandbox — mail
# only to verified addresses, 200 a day — until production access is requested in the SES console. The apps send with
# their task role, so no SMTP password or key exists.

resource "aws_sesv2_email_identity" "sender" {
  email_identity = var.from_address
}

data "aws_iam_policy_document" "send" {
  statement {
    actions   = ["ses:SendEmail"]
    resources = [aws_sesv2_email_identity.sender.arn]
  }
}
