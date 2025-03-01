# LiteLLM Setup Guide for ChatSheetAI

This guide explains how to set up and configure LiteLLM as a proxy for Azure OpenAI in the ChatSheetAI application, with a focus on supporting private endpoints.

## Overview

ChatSheetAI uses Azure OpenAI for natural language processing. To support private endpoints and enhance reliability, we use LiteLLM as a proxy server between our application and Azure OpenAI.

### Why Use LiteLLM?

- **Private Endpoint Support**: Works with Azure OpenAI instances that only allow private network access
- **Reliability**: Provides retry logic, fallbacks, and better error handling
- **Monitoring**: Detailed request/response logging for debugging
- **Cost Tracking**: Track token usage and costs
- **Rate Limiting**: Built-in rate limiting and queueing

## Setup Instructions

### 1. Install LiteLLM

```bash
pip install litellm
```

### 2. Configure LiteLLM

The application includes a `litellm.config.yaml` file in the project root. This file configures how LiteLLM connects to Azure OpenAI.

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

Update this file with your specific Azure OpenAI deployment details:

- `model`: Your Azure OpenAI deployment name
- `api_base`: Your Azure OpenAI endpoint URL
- `api_version`: The API version you're using

### 3. Start LiteLLM Proxy Server

Use the provided npm script to start the LiteLLM proxy server:

```bash
npm run start:litellm
```

This will start a local proxy server at `http://localhost:4000` by default.

### 4. Configure ChatSheetAI

Update your `server/.env` file with the LiteLLM configuration:

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

```
LITELLM_API_BASE=http://10.0.0.5:8000  # Internal VNet IP
```

### Option 2: Use VNet Peering

1. Set up VNet peering between your application's VNet and the Azure OpenAI VNet
2. Ensure proper Network Security Groups (NSGs) are configured to allow traffic

### Option 3: Use Azure Private Link Service

1. Create a Private Link Service for your LiteLLM proxy
2. Connect to it from your application using a Private Endpoint

## Testing Connectivity

Use the provided test script to verify connectivity:

```bash
npm run test:litellm
```

This script will:

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
2. Check if the port is accessible: `curl http://localhost:8000/health`
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

Add these options to the `start:litellm` script in package.json:

```json
"start:litellm": "litellm --config litellm.config.yaml --telemetry prometheus --detailed_debug"
```

## Security Considerations

1. **API Key Protection**: Never commit API keys to version control
2. **Network Security**: Restrict access to the LiteLLM proxy server
3. **TLS/SSL**: Consider enabling HTTPS for the LiteLLM proxy in production

## Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Private Link Documentation](https://learn.microsoft.com/en-us/azure/private-link/)
