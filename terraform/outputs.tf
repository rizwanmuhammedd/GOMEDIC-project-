output "ec2_public_ip" {
  value = aws_eip.lb.public_ip
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.s3_distribution.domain_name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.frontend_bucket.id
}
