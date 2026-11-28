# PolicyPulse Infrastructure-as-Code (`infra/`)

> **Important status:** All cloud templates in `infra/` (Azure Bicep, Terraform for Azure/AWS/GCP,
> Kubernetes manifests, and observability rules) are **unapplied enterprise reference blueprints**.
> No live Azure, AWS, or GCP cloud resources are provisioned or billed by this repository. The
> active demo deployment runs on Vercel + Supabase (see `docs/DEPLOYMENT.md`), with local Docker
> Compose (`docker-compose.yml`) as the development and fallback stack.

## Directory layout

| Path | Provider / Platform | Purpose |
| --- | --- | --- |
| `infra/bicep/` | Microsoft Azure (Bicep) | Modular VNet, Key Vault, ACR, PostgreSQL 16, Redis, Blob Storage, Container Apps, Scheduled Jobs, App Insights |
| `infra/terraform/azure/` | Microsoft Azure (Terraform) | Equivalent Azure topology in HCL for multi-cloud Terraform teams |
| `infra/terraform/aws/` | Amazon Web Services (Terraform) | Multi-AZ VPC, KMS, ECR, RDS PostgreSQL 16, ElastiCache Redis 7, S3, Secrets Manager, ALB + ECS Fargate, CloudWatch |
| `infra/terraform/gcp/` | Google Cloud Platform (Terraform) | VPC + Private Service Access, Artifact Registry, Cloud SQL PostgreSQL 16, Memorystore Redis 7, GCS, Secret Manager, Cloud Run v2, Cloud Scheduler |
| `infra/k8s/` | Kubernetes (Kustomize) | Restricted Pod Security namespace, non-root Deployment, HPA, PDB, NetworkPolicy, Ingress, and CronJobs |
| `infra/observability/` | Prometheus / SRE | SLO burn-rate policy and alert rules aligned with `docs/SCALABILITY.md` |

## Static validation commands (offline-safe, no cloud deploy)

When `az`, `terraform`, or `kubectl` + `kubeconform` are installed (or in `.github/workflows/infra-validate.yml`):

```bash
# Azure Bicep
az bicep build --file infra/bicep/main.bicep

# Terraform (Azure, AWS, GCP)
for cloud in azure aws gcp; do
  terraform -chdir=infra/terraform/$cloud fmt -check -recursive
  terraform -chdir=infra/terraform/$cloud init -backend=false
  terraform -chdir=infra/terraform/$cloud validate
done

# Kubernetes
kubectl kustomize infra/k8s | kubeconform -strict -summary
```

## Secret hygiene

- Never commit `.tfvars`, `.bicepparam`, or `secret.yaml` files containing real credentials.
- Copy `main.bicepparam.example`, `terraform.tfvars.example`, or `secret.example.yaml` locally and inject secrets through Key Vault / Secrets Manager / Secret Manager / External Secrets Operator at deploy time.
- Full multi-cloud mapping, governance, and SRE runbooks: [docs/INFRASTRUCTURE.md](../docs/INFRASTRUCTURE.md), [docs/RUNBOOK-INCIDENT.md](../docs/RUNBOOK-INCIDENT.md), [docs/DISASTER-RECOVERY.md](../docs/DISASTER-RECOVERY.md).
