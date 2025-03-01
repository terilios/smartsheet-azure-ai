# Azure OpenAI Integration Guide

This guide explains how to configure ChatSheetAI to work with Azure OpenAI, including setup for private endpoints.

## Overview

ChatSheetAI uses Azure OpenAI for natural language processing. There are two ways to connect to Azure OpenAI:

1. **Direct Connection** (Development only): Connect directly to Azure OpenAI API
2. **LiteLLM Proxy** (Recommended for production): Use a proxy server that handles connections to Azure OpenAI

The LiteLLM proxy approach is recommended for production environments, especially when Azure OpenAI is configured to use private endpoints.

## Why Use LiteLLM Proxy?

- **Private Endpoint Support**: Works with Azure OpenAI instances that only allow private network access
- **Rate Limiting**: Provides built-in rate limiting and queueing
- **Fallbacks**: Can configure fallback models if primary model is unavailable
- **Logging**: Detailed request/response logging for debugging
- **Cost Tracking**: Track token usage and costs

## Setup Instructions

### 1. Install LiteLLM

```bash
pip install litellm
```

### 2. Create LiteLLM Configuration

Create a file named `litellm.config.yaml` with the following content:

```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: gpt-4o-2024-08-06 # Your Azure OpenAI deployment name
      api_base: https://your-azure-openai-resource.openai.azure.com/
      api_version: "2024-08-01-preview" # Use your API version
      api_key: ${AZURE_OPENAI_API_KEY}

litellm_settings:
  drop_params: True
  set_verbose: True

environment_variables:
  AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY}
```

### 3. Start LiteLLM Proxy Server

```bash
litellm --config /path/to/litellm.config.yaml
```

By default, this will start a server on `http://localhost:8000`.

### 4. Configure ChatSheetAI

Update your `server/.env` file to include:

```
# LiteLLM Proxy Configuration
LITELLM_API_BASE=http://localhost:8000
LITELLM_MODEL=gpt-4
```

## Private Endpoint Configuration

If your Azure OpenAI instance is configured to use private endpoints, you need to ensure the LiteLLM proxy server is running in a network that can access those private endpoints.

### Option 1: Run LiteLLM in the Same VNet

1. Deploy the LiteLLM proxy server in the same Virtual Network as your Azure OpenAI private endpoint
2. Configure ChatSheetAI to connect to the LiteLLM proxy server's internal IP address

### Option 2: Use VNet Peering

1. Set up VNet peering between your application's VNet and the Azure OpenAI VNet
2. Ensure proper Network Security Groups (NSGs) are configured to allow traffic

### Option 3: Use Azure Private Link Service

1. Create a Private Link Service for your LiteLLM proxy
2. Connect to it from your application using a Private Endpoint

## Troubleshooting

### Testing Connectivity

Use the provided test script to verify connectivity:

```bash
node scripts/test-litellm-connectivity.js
```

This script will:

1. Check if the LiteLLM proxy server is running
2. Test if it can successfully connect to Azure OpenAI
3. Provide detailed error messages and troubleshooting advice

### Common Issues

#### LiteLLM Proxy Not Running

**Symptoms:**

- Error: "ECONNREFUSED"
- Error: "Could not connect to LiteLLM server"

**Solutions:**

1. Verify the LiteLLM server is running: `ps aux | grep litellm`
2. Check if the port is accessible: `curl http://localhost:8000/health`
3. Ensure no firewall is blocking the connection

#### Azure OpenAI Authentication Issues

**Symptoms:**

- Status code 401 or 403
- Error message about invalid API key

**Solutions:**

1. Verify the `AZURE_OPENAI_API_KEY` environment variable is set correctly
2. Check if the API key has expired and needs to be regenerated
3. Ensure the API key has access to the specified deployment

#### Model Not Found

**Symptoms:**

- Status code 404
- Error message about model not found

**Solutions:**

1. Verify the model name in `litellm.config.yaml` matches your Azure OpenAI deployment
2. Check if the deployment exists in your Azure OpenAI resource
3. Ensure the API version is correct for your deployment

#### Network Connectivity Issues

**Symptoms:**

- Timeouts when connecting to Azure OpenAI
- Intermittent connection failures

**Solutions:**

1. Verify network connectivity from the LiteLLM proxy to Azure OpenAI
2. Check if private endpoints are configured correctly
3. Ensure DNS resolution is working properly

## Advanced Configuration

### High Availability Setup

For production environments, consider running multiple LiteLLM proxy instances behind a load balancer:

1. Deploy multiple LiteLLM instances
2. Set up a load balancer (e.g., Nginx, HAProxy, or Azure Load Balancer)
3. Configure ChatSheetAI to connect to the load balancer endpoint

### Monitoring and Logging

LiteLLM provides several options for monitoring:

1. **Prometheus Metrics**: Enable with `--telemetry prometheus`
2. **Detailed Logging**: Enable with `--detailed_debug`
3. **Request/Response Logging**: Configure in `litellm.config.yaml`

## Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Private Link Documentation](https://learn.microsoft.com/en-us/azure/private-link/)
