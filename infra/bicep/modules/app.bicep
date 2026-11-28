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

param imageTag string
param appUrl string
param appSubnetId string
param identityId string
param identityPrincipalId string
param keyVaultUri string
param databaseUrlSecretUri string
param redisUrlSecretUri string
param authSecretUri string
param cronSecretUri string
param tokenEncryptionKeyUri string
param geminiApiKeyUri string
param msftGraphClientSecretUri string
param msftGraphTenantId string
param msftGraphClientId string
param ingestionSourceUrls string
param storageAccountName string
param minReplicas int
param maxReplicas int

var acrName = toLower(take('acr${replace(workloadName, '-', '')}${environment}${suffix}', 50))
var logAnalyticsName = 'log-${workloadName}-${environment}'
var appInsightsName = 'appi-${workloadName}-${environment}'
var acaEnvName = 'cae-${workloadName}-${environment}'
var acaAppName = 'ca-${workloadName}-web-${environment}'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Premium' : 'Standard'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: environment == 'prod' ? 'Enabled' : 'Disabled'
  }
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityPrincipalId, acrPullRoleId)
  scope: acr
  properties: {
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: acaEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: appSubnetId
      internal: false
    }
    zoneRedundant: environment == 'prod'
  }
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: acaAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: identityId
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: databaseUrlSecretUri, identity: identityId }
        { name: 'redis-url', keyVaultUrl: redisUrlSecretUri, identity: identityId }
        { name: 'auth-secret', keyVaultUrl: authSecretUri, identity: identityId }
        { name: 'cron-secret', keyVaultUrl: cronSecretUri, identity: identityId }
        { name: 'token-encryption-key', keyVaultUrl: tokenEncryptionKeyUri, identity: identityId }
        { name: 'gemini-api-key', keyVaultUrl: geminiApiKeyUri, identity: identityId }
        { name: 'msft-graph-client-secret', keyVaultUrl: msftGraphClientSecretUri, identity: identityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'hexa-web'
          image: '${acr.properties.loginServer}/${workloadName}-web:${imageTag}'
          resources: {
            cpu: json(environment == 'prod' ? '1.0' : '0.5')
            memory: environment == 'prod' ? '2Gi' : '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'APP_URL', value: appUrl }
            { name: 'APP_VERSION', value: imageTag }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'TRUST_PROXY_HEADERS', value: 'true' }
            { name: 'DATABASE_POOL_MAX', value: '5' }
            { name: 'EMAIL_PROVIDER', value: 'smtp' }
            { name: 'GEMINI_AUTH_MODE', value: 'api-key' }
            { name: 'AZURE_KEY_VAULT_URI', value: keyVaultUri }
            { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccountName }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'MSFT_GRAPH_TENANT_ID', value: msftGraphTenantId }
            { name: 'MSFT_GRAPH_CLIENT_ID', value: msftGraphClientId }
            { name: 'INGESTION_SOURCE_URLS', value: ingestionSourceUrls }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DIRECT_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
            { name: 'TOKEN_ENCRYPTION_KEY', secretRef: 'token-encryption-key' }
            { name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' }
            { name: 'MSFT_GRAPH_CLIENT_SECRET', secretRef: 'msft-graph-client-secret' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 15
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullAssignment
  ]
}

resource emailCronJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'job-${workloadName}-email-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 120
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: '*/5 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      secrets: [
        { name: 'cron-secret', keyVaultUrl: cronSecretUri, identity: identityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'email-drain'
          image: 'mcr.microsoft.com/azure-cli:2.66.0'
          command: [
            '/bin/sh'
            '-c'
            'curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://${webApp.properties.configuration.ingress.fqdn}/api/cron/email"'
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
          ]
        }
      ]
    }
  }
}

resource watchCronJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'job-${workloadName}-watch-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: '0 4 * * 1'
        parallelism: 1
        replicaCompletionCount: 1
      }
      secrets: [
        { name: 'cron-secret', keyVaultUrl: cronSecretUri, identity: identityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'regulatory-watch'
          image: 'mcr.microsoft.com/azure-cli:2.66.0'
          command: [
            '/bin/sh'
            '-c'
            'curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://${webApp.properties.configuration.ingress.fqdn}/api/cron/watch"'
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
          ]
        }
      ]
    }
  }
}

output fqdn string = webApp.properties.configuration.ingress.fqdn
output acrLoginServer string = acr.properties.loginServer
output logAnalyticsWorkspaceId string = logAnalytics.id
