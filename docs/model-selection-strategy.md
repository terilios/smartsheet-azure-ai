# Model Selection Strategy

This document outlines the strategy for selecting and configuring the AI model used in the ChatSheetAI application.

## Model Configuration Levels

The ChatSheetAI application has multiple levels where the model can be configured:

1. **Environment Variables** - The highest level configuration that affects the entire application
2. **LiteLLM Configuration** - Configuration specific to the LiteLLM proxy
3. **Application Code** - Default values and fallbacks in the code
4. **Runtime Configuration** - Optional dynamic configuration at runtime

## Environment Variables

The following environment variables in `server/.env` control the model selection:

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=https://your-azure-openai-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o-2024-08-06  # Deployment name in Azure
AZURE_OPENAI_MODEL=gpt-4o                  # Model type

# OpenAI API Configuration
OPENAI_API_KEY=your-openai-api-key

# LiteLLM Proxy Configuration
LITELLM_API_BASE=http://localhost:4000
LITELLM_MODEL=gpt-4o                       # Model to use with LiteLLM
```

## LiteLLM Configuration

The `litellm.config.yaml` file maps model names to specific configurations:

```yaml
model_list:
  - model_name: gpt-4o # This should match LITELLM_MODEL
    litellm_params:
      model: azure/gpt-4o # Provider/model format
      api_base: https://your-azure-openai-resource.openai.azure.com/
      api_version: "2024-08-01-preview"
      api_key: ${AZURE_OPENAI_API_KEY}
      deployment_id: gpt-4o-2024-08-06 # This should match AZURE_OPENAI_DEPLOYMENT
```

## Application Code

In the application code (`server/services/llm.ts`), there are default values that serve as fallbacks if environment variables are not set:

```typescript
// Use LiteLLM proxy configuration
const config = {
  apiBase: process.env.LITELLM_API_BASE || "http://localhost:4000",
  model: process.env.LITELLM_MODEL || "gpt-4o",
};

// Direct Azure OpenAI configuration
const azureConfig = {
  apiBase: process.env.AZURE_OPENAI_API_BASE,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
};
```

## Setting the Model for Deployment

To set which model to use for a deployment, follow these steps:

1. **Determine the Model Requirements**:

   - Consider the features needed (e.g., function calling, vision capabilities)
   - Evaluate performance requirements
   - Consider cost implications

2. **Configure Azure OpenAI**:

   - Create a deployment in the Azure OpenAI service with the desired model
   - Note the deployment name (e.g., `gpt-4o-2024-08-06`)
   - Note the model type (e.g., `gpt-4o`)

3. **Update Environment Variables**:

   - Set `AZURE_OPENAI_DEPLOYMENT` to the deployment name
   - Set `AZURE_OPENAI_MODEL` to the model type
   - Set `LITELLM_MODEL` to match the model type

4. **Update LiteLLM Configuration**:
   - Ensure `model_name` in `litellm.config.yaml` matches `LITELLM_MODEL`
   - Ensure `deployment_id` matches `AZURE_OPENAI_DEPLOYMENT`
   - Ensure `model` is set to `azure/[model-type]` (e.g., `azure/gpt-4o`)

## Model Selection Flow

When the application needs to generate a response using the AI model, it follows this flow:

1. Attempt to use LiteLLM with the configured model (`LITELLM_MODEL`)
2. If LiteLLM fails or is not configured, fall back to direct Azure OpenAI
3. Use the configured deployment (`AZURE_OPENAI_DEPLOYMENT`) with Azure OpenAI

## Changing Models

To change the model used by the application:

1. **For Development/Testing**:

   - Update the environment variables in `server/.env`
   - Update the LiteLLM configuration in `litellm.config.yaml`
   - Restart the application and LiteLLM proxy

2. **For Production**:
   - Update the environment variables in the deployment configuration
   - Update the LiteLLM configuration file in the deployment
   - Restart the application services

## Best Practices

1. **Consistency**: Ensure that the model type is consistent across all configuration levels
2. **Testing**: Test the model configuration before deploying to production
3. **Fallbacks**: Always have fallback options in case the primary model is unavailable
4. **Documentation**: Document any model changes, including the reason for the change and expected impacts
5. **Monitoring**: Monitor model performance and costs to ensure they meet requirements

## Example Configuration

Here's an example configuration for using the GPT-4o model:

**server/.env**:

```
AZURE_OPENAI_API_BASE=https://ai-idha-sbx-scus-001.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o-2024-08-06
AZURE_OPENAI_MODEL=gpt-4o

LITELLM_API_BASE=http://localhost:4000
LITELLM_MODEL=gpt-4o
```

**litellm.config.yaml**:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      api_base: https://ai-idha-sbx-scus-001.openai.azure.com/
      api_version: "2024-08-01-preview"
      api_key: ${AZURE_OPENAI_API_KEY}
      deployment_id: gpt-4o-2024-08-06
```

This configuration ensures that both LiteLLM and the direct Azure OpenAI integration use the same model, providing consistency across the application.
