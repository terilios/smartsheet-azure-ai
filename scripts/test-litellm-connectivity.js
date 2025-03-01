#!/usr/bin/env node

/**
 * Test script to verify connectivity to the LiteLLM proxy server and Azure OpenAI
 * 
 * Usage:
 *   node scripts/test-litellm-connectivity.js
 * 
 * This script tests:
 * 1. If the LiteLLM proxy server is reachable
 * 2. If the proxy can successfully connect to Azure OpenAI
 * 3. If the API key and other configuration is correct
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

// Configuration
const config = {
  apiBase: process.env.LITELLM_API_BASE || 'http://localhost:4000',
  model: process.env.LITELLM_MODEL || 'gpt-4'
};

// ANSI color codes for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Test if the LiteLLM server is running
 */
async function testServerAvailability() {
  console.log(`${colors.bright}Testing LiteLLM server availability...${colors.reset}`);
  console.log(`${colors.dim}URL: ${config.apiBase}${colors.reset}`);
  
  try {
    const response = await fetch(`${config.apiBase}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ LiteLLM server is running${colors.reset}`);
      console.log(`${colors.dim}Server status: ${JSON.stringify(data)}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ LiteLLM server returned status ${response.status}${colors.reset}`);
      console.log(`${colors.dim}Response: ${await response.text()}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Could not connect to LiteLLM server${colors.reset}`);
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Make sure the LiteLLM server is running
2. Check if the LITELLM_API_BASE environment variable is set correctly
3. Try running: npm run start:litellm
`);
    }
    
    return false;
  }
}

/**
 * Test if the LiteLLM server can connect to Azure OpenAI
 */
async function testAzureOpenAIConnection() {
  console.log(`\n${colors.bright}Testing Azure OpenAI connection through LiteLLM...${colors.reset}`);
  console.log(`${colors.dim}Model: ${config.model}${colors.reset}`);
  
  try {
    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Respond with a single word: "Connected"' }
        ],
        max_tokens: 10
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      console.log(`${colors.green}✓ Successfully connected to Azure OpenAI${colors.reset}`);
      console.log(`${colors.dim}Response: "${content}"${colors.reset}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`${colors.red}✗ Azure OpenAI connection failed with status ${response.status}${colors.reset}`);
      console.log(`${colors.dim}Error: ${errorText}${colors.reset}`);
      
      // Provide specific troubleshooting advice based on error
      if (response.status === 401 || response.status === 403) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Check if the AZURE_OPENAI_API_KEY environment variable is set correctly
2. Verify that the API key has access to the specified model
3. Check if the Azure OpenAI resource allows access from the current IP address
`);
      } else if (response.status === 404) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Verify that the model name in litellm.config.yaml is correct
2. Check if the deployment exists in your Azure OpenAI resource
`);
      }
      
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Request to Azure OpenAI failed${colors.reset}`);
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Test direct connectivity to Azure OpenAI (for comparison)
 */
async function testDirectAzureOpenAI() {
  console.log(`\n${colors.bright}Testing direct connectivity to Azure OpenAI (for comparison)...${colors.reset}`);
  
  const azureConfig = {
    apiBase: process.env.AZURE_OPENAI_API_BASE,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };
  
  if (!azureConfig.apiBase || !azureConfig.apiKey || !azureConfig.apiVersion || !azureConfig.deployment) {
    console.log(`${colors.yellow}⚠ Skipping direct Azure OpenAI test - missing configuration${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.dim}URL: ${azureConfig.apiBase}${colors.reset}`);
  
  try {
    const url = `${azureConfig.apiBase}/openai/deployments/${azureConfig.deployment}/chat/completions?api-version=${azureConfig.apiVersion}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureConfig.apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Respond with a single word: "DirectConnected"' }
        ],
        max_tokens: 10
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      console.log(`${colors.green}✓ Successfully connected directly to Azure OpenAI${colors.reset}`);
      console.log(`${colors.dim}Response: "${content}"${colors.reset}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`${colors.red}✗ Direct Azure OpenAI connection failed with status ${response.status}${colors.reset}`);
      console.log(`${colors.dim}Error: ${errorText}${colors.reset}`);
      
      if (response.status === 401 || response.status === 403) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Check if the AZURE_OPENAI_API_KEY environment variable is set correctly
2. Verify that the API key has access to the specified deployment
`);
      } else if (response.status === 404) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Verify that the deployment name is correct
2. Check if the deployment exists in your Azure OpenAI resource
`);
      }
      
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Direct request to Azure OpenAI failed${colors.reset}`);
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Check if the AZURE_OPENAI_API_BASE URL is correct
2. Verify that your network can reach the Azure OpenAI endpoint
3. If using private endpoints, ensure you're in the correct network
`);
    }
    
    return false;
  }
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log(`${colors.bright}Checking environment variables...${colors.reset}`);
  
  const variables = {
    'LITELLM_API_BASE': process.env.LITELLM_API_BASE,
    'LITELLM_MODEL': process.env.LITELLM_MODEL,
    'AZURE_OPENAI_API_BASE': process.env.AZURE_OPENAI_API_BASE,
    'AZURE_OPENAI_API_KEY': process.env.AZURE_OPENAI_API_KEY ? '********' : undefined,
    'AZURE_OPENAI_API_VERSION': process.env.AZURE_OPENAI_API_VERSION,
    'AZURE_OPENAI_DEPLOYMENT': process.env.AZURE_OPENAI_DEPLOYMENT
  };
  
  let allPresent = true;
  
  for (const [name, value] of Object.entries(variables)) {
    if (value) {
      console.log(`${colors.green}✓ ${name}${colors.reset}: ${name.includes('KEY') ? '********' : value}`);
    } else {
      console.log(`${colors.red}✗ ${name}${colors.reset}: Not set`);
      allPresent = false;
    }
  }
  
  if (!allPresent) {
    console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Make sure you have a server/.env file with all required variables
2. Check if the variables are properly exported in your environment
`);
  }
  
  return allPresent;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}=== LiteLLM Connectivity Test ====${colors.reset}\n`);
  
  // Check environment variables
  checkEnvironmentVariables();
  
  console.log(''); // Empty line for readability
  
  // Run tests
  const serverAvailable = await testServerAvailability();
  
  if (serverAvailable) {
    await testAzureOpenAIConnection();
  }
  
  // Test direct connection for comparison
  await testDirectAzureOpenAI();
  
  console.log(`\n${colors.bright}${colors.cyan}=== Test Complete ====${colors.reset}`);
  
  // Provide summary
  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  if (!serverAvailable) {
    console.log(`${colors.yellow}⚠ LiteLLM server is not available. Make sure it's running with:${colors.reset}`);
    console.log(`${colors.dim}   npm run start:litellm${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ LiteLLM server is available${colors.reset}`);
  }
}

runTests().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});