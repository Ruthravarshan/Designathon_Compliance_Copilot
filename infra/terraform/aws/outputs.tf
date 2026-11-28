output "alb_dns_name" {
  description = "DNS name of the HTTPS Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for @hexa/web images."
  value       = aws_ecr_repository.web.repository_url
}

output "rds_endpoint" {
  description = "Private RDS PostgreSQL 16 endpoint."
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "Private ElastiCache Redis 7 primary endpoint."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "evidence_bucket" {
  description = "Encrypted S3 bucket for archived compliance circulars."
  value       = aws_s3_bucket.evidence.bucket
}
