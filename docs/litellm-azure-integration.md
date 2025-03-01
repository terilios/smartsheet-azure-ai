# LiteLLM Integration with Azure OpenAI

This document provides a comprehensive guide for integrating LiteLLM with Azure OpenAI in the ChatSheetAI application, with a focus on private endpoint support and authentication challenges.

## Overview

ChatSheetAI uses Azure OpenAI for natural language processing capabilities. To support private endpoints and enhance reliability, we use LiteLLM as a proxy server between our application and Azure OpenAI.

## Current Status

We have successfully implemented:

1. **LiteLLM Configuration**: Set up the LiteLLM proxy with Azure OpenAI configuration
2. **Environment Variables**: Added necessary environment variables for LiteLLM
3. **Test Scripts**: Created scripts to test connectivity to both LiteLLM and Azure OpenAI directly
4. **Documentation**: Created comprehensive documentation for setup and troubleshooting

However, we are currently experiencing an authentication issue when connecting to Azure OpenAI through LiteLLM. The direct connection to Azure OpenAI works, but the LiteLLM connection fails with a 401 error.

## Authentication Challenge

The current authentication error is:

```
AzureException AuthenticationError - Unauthorized. Access token is missing, invalid, audience is incorrect (https://cognitiveservices.azure.com) or have expired.
```

This suggests that there might be an issue with how LiteLLM is authenticating with Azure OpenAI. Possible causes include:

1. **API Key Format**: The API key might need to be formatted differently for LiteLLM
2. **Authentication Method**: LiteLLM might be using a different authentication method than expected
3. **Private Endpoint Configuration**: The private endpoint might require additional configuration

## Workaround

Until the authentication issue is resolved, we recommend using the direct Azure OpenAI connection for development purposes. The application is configured to fall back to direct Azure OpenAI if LiteLLM is not available.

## Setup Instructions

### 1. Install LiteLLM

```bash
pip install litellm
```

### 2. Configure LiteLLM

Create a `litellm.config.yaml` file in the project root:

```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: azure/gpt-4o
      api_base: https://your-azure-openai-resource.openai.azure.com/
      api_version: "2024-08-01-preview"
      api_key: ${AZURE_OPENAI_API_KEY}
      deployment_id: your-deployment-name
```

### 3. Configure Environment Variables

Update your `server/.env` file with the following variables:

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=https://your-azure-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_MODEL=gpt-4o

# LiteLLM Proxy Configuration
LITELLM_API_BASE=http://localhost:4000
LITELLM_MODEL=gpt-4
```

### 4. Start LiteLLM Proxy Server

```bash
npm run start:litellm
```

### 5. Test Connectivity

```bash
npm run test:litellm
```

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
- Error message about invalid API key or token

**Solutions:**

1. Verify the `AZURE_OPENAI_API_KEY` environment variable is set correctly
2. Check if the API key has expired and needs to be regenerated
3. Ensure the API key has access to the specified deployment
4. Try using a different authentication method (e.g., API key vs. token)

### Model Not Found

**Symptoms:**

- Status code 404
- Error message about model not found

**Solutions:**

1. Verify the model name in `litellm.config.yaml` matches your Azure OpenAI deployment
2. Check if the deployment exists in your Azure OpenAI resource
3. Ensure the API version is correct for your deployment

## Next Steps

To resolve the authentication issue, we plan to:

1. **Investigate Authentication Methods**: Research different authentication methods for Azure OpenAI with LiteLLM
2. **Test Different Configurations**: Try different configuration options in litellm.config.yaml
3. **Consult LiteLLM Documentation**: Look for specific guidance on Azure OpenAI private endpoints
4. **Consider Alternative Approaches**: Explore other proxy solutions if LiteLLM continues to have issues

## Resources

- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Private Link Documentation](https://learn.microsoft.com/en-us/azure/private-link/)
