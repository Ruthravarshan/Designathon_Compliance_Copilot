output "resource_group_name" {
  description = "Azure Resource Group name."
  value       = azurerm_resource_group.main.name
}

output "container_app_fqdn" {
  description = "Public FQDN for PolicyPulse web Container App."
  value       = azurerm_container_app.web.ingress[0].fqdn
}

output "acr_login_server" {
  description = "Azure Container Registry login server."
  value       = azurerm_container_registry.main.login_server
}

output "key_vault_uri" {
  description = "Azure Key Vault URI."
  value       = azurerm_key_vault.main.vault_uri
}

output "postgres_fqdn" {
  description = "Private FQDN of the PostgreSQL Flexible Server."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "storage_account_name" {
  description = "Blob storage account for archived compliance evidence."
  value       = azurerm_storage_account.evidence.name
}
