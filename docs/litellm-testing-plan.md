# LiteLLM Testing Plan

## Current Status

We've been working on integrating Azure OpenAI with the ChatSheetAI application using LiteLLM as a proxy. However, we've encountered authentication issues with the LiteLLM integration. The user has suggested testing with the gpt-4o model on OpenAI API using LiteLLM to assess the integration.

## Recent Updates

The following updates have been made to the configuration:

1. Updated `LITELLM_MODEL` from `gpt-4` to `gpt-4o` in the server/.env file
2. Added `OPENAI_API_KEY` to the server/.env file

## Recommended Changes to litellm.config.yaml

The current litellm.config.yaml file needs to be updated to match these changes:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      api_base: https://ai-idha-sbx-scus-001.openai.azure.com/
      api_version: "2024-08-01-preview"
      api_key: ${AZURE_OPENAI_API_KEY}
      deployment_id: gpt-4o-2024-08-06

  # Add OpenAI API configuration for testing
  - model_name: openai/gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: ${OPENAI_API_KEY}

litellm_settings:
  drop_params: True
  set_verbose: True

environment_variables:
  AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY}
  OPENAI_API_KEY: ${OPENAI_API_KEY}
```

## Testing Plan

1. **Update Configuration**:

   - Update the litellm.config.yaml file as recommended above
   - Ensure the server/.env file has the correct environment variables

2. **Restart LiteLLM Proxy**:

   - Stop the current LiteLLM proxy instance
   - Start a new instance with the updated configuration:
     ```bash
     npm run start:litellm
     ```

3. **Test Azure OpenAI via LiteLLM**:

   - Run the test script with the gpt-4o model:
     ```bash
     npm run test:litellm
     ```
   - Check if the authentication issues persist

4. **Test OpenAI API via LiteLLM**:

   - Create a new test script or modify the existing one to test the OpenAI API via LiteLLM
   - This will help determine if the issue is specific to Azure OpenAI or if it's a general LiteLLM configuration issue

5. **Compare Results**:
   - Compare the results of the Azure OpenAI test and the OpenAI API test
   - If the OpenAI API test works but the Azure OpenAI test doesn't, the issue is likely with the Azure OpenAI configuration
   - If both tests fail, the issue is likely with the LiteLLM configuration

## Fallback Strategy

If the LiteLLM integration continues to have issues, we have implemented a fallback mechanism that uses direct Azure OpenAI if LiteLLM fails. This ensures that the application will continue to function even if the LiteLLM integration is not working.

## Next Steps

Based on the results of the testing, we can decide whether to:

1. **Continue with LiteLLM Integration**:

   - If the tests are successful, we can continue with the LiteLLM integration
   - This would provide the benefits of private endpoint support, enhanced error handling, and monitoring

2. **Use Direct Azure OpenAI**:

   - If the tests continue to fail, we can focus on the direct Azure OpenAI integration
   - This would simplify the architecture and reduce potential points of failure

3. **Hybrid Approach**:
   - Continue with the current fallback mechanism
   - This gives us the best of both worlds - attempting to use LiteLLM first, but falling back to direct Azure OpenAI if needed

## Recommendation

Given the importance of private endpoint support for Azure OpenAI, I recommend continuing to explore the LiteLLM integration. The addition of the OpenAI API key provides an opportunity to test LiteLLM with a different API to help isolate the issue.

If the tests with OpenAI API are successful, it would suggest that the issue is specific to the Azure OpenAI configuration in LiteLLM, which we can then focus on resolving.
