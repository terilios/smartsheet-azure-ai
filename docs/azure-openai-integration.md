# Azure OpenAI Integration Guide

This document provides a comprehensive guide for integrating Azure OpenAI with the ChatSheetAI application, focusing on private endpoint support through LiteLLM.

## Overview

ChatSheetAI uses Azure OpenAI for natural language processing capabilities. To support private endpoints and enhance reliability, we use LiteLLM as a proxy server between our application and Azure OpenAI.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ ChatSheetAI │────▶│   LiteLLM   │────▶│ Azure OpenAI│
│ Application │◀────│    Proxy    │◀────│    API      │
└─────────────┘     └─────────────┘     └─────────────┘
```

This architecture provides several benefits:

- Support for private endpoints
- Enhanced error handling and retry logic
- Consistent interface for different LLM providers
- Monitoring and logging capabilities

## Configuration

### 1. Azure OpenAI Setup

1. Create an Azure OpenAI resource in the Azure portal
2. Deploy a model (e.g., GPT-4)
3. Configure network settings (private endpoints if needed)
4. Get the API key and endpoint URL

### 2. LiteLLM Configuration

The application uses a `litellm.config.yaml` file to configure the LiteLLM proxy:

```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: gpt-4o-2024-08-06 # Your Azure OpenAI deployment name
      api_base: https://your-azure-openai-resource.openai.azure.com/
      api_version: "2024-08-01-preview"
      api_key: ${AZURE_OPENAI_API_KEY}

litellm_settings:
  drop_params: True
  set_verbose: True

environment_variables:
  AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY}
```

### 3. Application Configuration

Update your `server/.env` file with the following variables:

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=https://your-azure-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o-2024-08-06

# LiteLLM Proxy Configuration
LITELLM_API_BASE=http://localhost:4000
LITELLM_MODEL=gpt-4
```

## Private Endpoint Support

Azure OpenAI can be configured to only allow access through private endpoints. This enhances security by restricting access to your Azure OpenAI resources.

### Option 1: Run LiteLLM in the Same VNet

1. Deploy the LiteLLM proxy server in the same Virtual Network as your Azure OpenAI private endpoint
2. Configure ChatSheetAI to connect to the LiteLLM proxy server's internal IP address

```
LITELLM_API_BASE=http://10.0.0.5:4000  # Internal VNet IP
```

### Option 2: Use VNet Peering

1. Set up VNet peering between your application's VNet and the Azure OpenAI VNet
2. Ensure proper Network Security Groups (NSGs) are configured to allow traffic

### Option 3: Use Azure Private Link Service

1. Create a Private Link Service for your LiteLLM proxy
2. Connect to it from your application using a Private Endpoint

## Testing Connectivity

Use the provided test scripts to verify connectivity:

```bash
# Test LiteLLM connectivity
npm run test:litellm

# Test direct Azure OpenAI connectivity
node test-azure-openai.js
```

The `test-litellm-connectivity.js` script will:

1. Check if the LiteLLM proxy server is running
2. Test if it can successfully connect to Azure OpenAI
3. Provide detailed error messages and troubleshooting advice

## Troubleshooting

### LiteLLM Proxy Not Running

**Symptoms:**

- Error: "ECONNREFUSED"
- Error: "Could not connect to LiteLLM server"

**Solutions:**

1. Verify the LiteLLM server is running: `ps aux | grep litellm`
2. Check if the port is accessible: `curl http://localhost:4000/health`
3. Ensure no firewall is blocking the connection

### Azure OpenAI Authentication Issues

**Symptoms:**

- Status code 401 or 403
- Error message about invalid API key

**Solutions:**

1. Verify the `AZURE_OPENAI_API_KEY` environment variable is set correctly
2. Check if the API key has expired and needs to be regenerated
3. Ensure the API key has access to the specified deployment

### Model Not Found

**Symptoms:**

- Status code 404
- Error message about model not found

**Solutions:**

1. Verify the model name in `litellm.config.yaml` matches your Azure OpenAI deployment
2. Check if the deployment exists in your Azure OpenAI resource
3. Ensure the API version is correct for your deployment

### Network Connectivity Issues

**Symptoms:**

- Timeouts when connecting to Azure OpenAI
- Intermittent connection failures

**Solutions:**

1. Verify network connectivity from the LiteLLM proxy to Azure OpenAI
2. Check if private endpoints are configured correctly
3. Ensure DNS resolution is working properly

## Implementation Details

### LiteLLM Integration

The application integrates with LiteLLM through the `server/services/llm.ts` service:

```typescript
export async function getChatCompletion(
  options: ChatCompletionOptions
): Promise<CircuitBreakerResult<ChatCompletionResponse>> {
  const { messages, tools } = options;

  // Use LiteLLM proxy configuration
  const config = {
    apiBase: process.env.LITELLM_API_BASE || "http://localhost:4000",
    model: process.env.LITELLM_MODEL || "gpt-4",
  };

  // ... rest of the implementation
}
```

This service handles:

- Constructing the payload for the LLM request
- Sending the request to the LiteLLM proxy
- Processing the response
- Error handling and logging

### Error Handling

The application implements comprehensive error handling for LLM requests:

1. **Connection Errors**: Detected and reported with clear error messages
2. **Authentication Errors**: Handled with specific error messages
3. **Rate Limiting**: Detected and reported with appropriate messages
4. **Server Errors**: Handled with fallback mechanisms

### Monitoring and Logging

LiteLLM provides several options for monitoring:

1. **Prometheus Metrics**: Enable with `--telemetry prometheus`
2. **Detailed Logging**: Enable with `--detailed_debug`
3. **Request/Response Logging**: Configure in `litellm.config.yaml`

## Security Considerations

1. **API Key Protection**: Never commit API keys to version control
2. **Network Security**: Restrict access to the LiteLLM proxy server
3. **TLS/SSL**: Consider enabling HTTPS for the LiteLLM proxy in production
4. **Access Control**: Use Azure RBAC to control access to Azure OpenAI resources

## Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Private Link Documentation](https://learn.microsoft.com/en-us/azure/private-link/)
