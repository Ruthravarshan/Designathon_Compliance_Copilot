data "aws_availability_zones" "available" {
  state = "available"
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

locals {
  name_prefix = "${var.workload_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)
}

# -----------------------------------------------------------------------------
# Networking (VPC, Subnets across 2 AZs, NAT, Security Groups)
# -----------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "vpc-${local.name_prefix}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "igw-${local.name_prefix}" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false

  tags = { Name = "snet-${local.name_prefix}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = { Name = "snet-${local.name_prefix}-private-${count.index}" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "eip-${local.name_prefix}-nat" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "nat-${local.name_prefix}" }
  depends_on    = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  name        = "sg-${local.name_prefix}-alb"
  description = "Public HTTPS ingress to Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "sg-${local.name_prefix}-ecs"
  description = "Allow ALB traffic to ECS Fargate tasks on port 3000"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "data" {
  name        = "sg-${local.name_prefix}-data"
  description = "Allow Postgres (5432) and Redis (6379) only from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

# -----------------------------------------------------------------------------
# KMS, S3 Evidence Storage, ECR, and Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_kms_key" "data" {
  description             = "CMK for PolicyPulse RDS, S3, Secrets Manager, and CloudWatch Logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_s3_bucket" "evidence" {
  bucket = "${local.name_prefix}-evidence-${random_string.suffix.result}"
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "${local.name_prefix}-web"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name       = "${local.name_prefix}/runtime-secrets-${random_string.suffix.result}"
  kms_key_id = aws_kms_key.data.arn
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    DATABASE_URL         = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?sslmode=require"
    DIRECT_URL           = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?sslmode=require"
    REDIS_URL            = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
    AUTH_SECRET          = var.auth_secret
    CRON_SECRET          = var.cron_secret
    TOKEN_ENCRYPTION_KEY = var.token_encryption_key
    GEMINI_API_KEY       = var.gemini_api_key
  })
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL 16 & ElastiCache Redis 7
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "sbg-${local.name_prefix}-pg"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier              = "db-${local.name_prefix}"
  engine                  = "postgres"
  engine_version          = "16.4"
  instance_class          = var.environment == "prod" ? "db.t4g.medium" : "db.t4g.micro"
  allocated_storage       = var.environment == "prod" ? 100 : 20
  max_allocated_storage   = 500
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.data.arn
  db_name                 = "policypulse"
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.data.id]
  multi_az                = var.environment == "prod"
  publicly_accessible     = false
  backup_retention_period = var.environment == "prod" ? 35 : 7
  deletion_protection     = var.environment == "prod"
  skip_final_snapshot     = var.environment != "prod"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "sbg-${local.name_prefix}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "redis-${local.name_prefix}"
  description                = "PolicyPulse Redis 7 for distributed rate limiting and caching"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.environment == "prod" ? "cache.t4g.small" : "cache.t4g.micro"
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.data.arn
  automatic_failover_enabled = var.environment == "prod"
}

# -----------------------------------------------------------------------------
# ECS Fargate, ALB, CloudWatch Logs/Alarms, and IAM
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}-web"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

resource "aws_ecs_cluster" "main" {
  name = "ecs-${local.name_prefix}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "role-${local.name_prefix}-ecs-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_secrets_read" {
  name = "read-runtime-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
      Resource = [aws_secretsmanager_secret.app_secrets.arn, aws_kms_key.data.arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "role-${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_s3_evidence" {
  name = "s3-evidence-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
      Resource = [aws_s3_bucket.evidence.arn, "${aws_s3_bucket.evidence.arn}/*"]
    }]
  })
}

resource "aws_lb" "main" {
  name                       = substr("alb-${local.name_prefix}", 0, 32)
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "web" {
  name        = substr("tg-${local.name_prefix}-web", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "prod" ? "1024" : "512"
  memory                   = var.environment == "prod" ? "2048" : "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "hexa-web"
      image     = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [{
        containerPort = 3000
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "APP_URL", value = var.app_url },
        { name = "APP_VERSION", value = var.image_tag },
        { name = "LOG_LEVEL", value = "info" },
        { name = "TRUST_PROXY_HEADERS", value = "true" },
        { name = "DATABASE_POOL_MAX", value = "5" },
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.evidence.bucket }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
        { name = "DIRECT_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DIRECT_URL::" },
        { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_URL::" },
        { name = "AUTH_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:AUTH_SECRET::" },
        { name = "CRON_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:CRON_SECRET::" },
        { name = "TOKEN_ENCRYPTION_KEY", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:TOKEN_ENCRYPTION_KEY::" },
        { name = "GEMINI_API_KEY", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GEMINI_API_KEY::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.environment == "prod" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "hexa-web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggers when PolicyPulse web targets return > 5 5xx errors per minute."
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}
