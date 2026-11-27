@description('Primary Azure region.')
param location string

@description('Workload name prefix.')
param workloadName string

@description('Environment name.')
param environment string

@description('Deterministic short suffix.')
param suffix string

@description('Resource tags.')
param tags object

@secure()
param authSecret string

@secure()
param cronSecret string

@secure()
param tokenEncryptionKey string

@secure()
param geminiApiKey string

@secure()
param msftGraphClientSecret string

var keyVaultName = take('kv-${workloadName}-${environment}-${suffix}', 24)
var identityName = 'id-${workloadName}-${environment}'
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentity.id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
  }
}

resource authSecretRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-secret'
  properties: {
    value: authSecret
  }
}

resource cronSecretRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cron-secret'
  properties: {
    value: cronSecret
  }
}

resource tokenEncryptionKeyRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'token-encryption-key'
  properties: {
    value: tokenEncryptionKey
  }
}

resource geminiApiKeyRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'gemini-api-key'
  properties: {
    value: empty(geminiApiKey) ? 'unconfigured-placeholder' : geminiApiKey
  }
}

resource msftGraphClientSecretRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'msft-graph-client-secret'
  properties: {
    value: empty(msftGraphClientSecret) ? 'unconfigured-placeholder' : msftGraphClientSecret
  }
}

output identityId string = managedIdentity.id
output identityPrincipalId string = managedIdentity.properties.principalId
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output authSecretUri string = authSecretRes.properties.secretUri
output cronSecretUri string = cronSecretRes.properties.secretUri
output tokenEncryptionKeyUri string = tokenEncryptionKeyRes.properties.secretUri
output geminiApiKeyUri string = geminiApiKeyRes.properties.secretUri
output msftGraphClientSecretUri string = msftGraphClientSecretRes.properties.secretUri
