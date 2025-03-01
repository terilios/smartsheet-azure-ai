#!/usr/bin/env node

/**
 * Test script to verify direct connectivity to Azure OpenAI
 * This script serves as a fallback test when LiteLLM integration has issues
 * 
 * Usage:
 *   node scripts/test-azure-openai-fallback.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

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
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log(`${colors.bright}Checking environment variables...${colors.reset}`);
  
  const variables = {
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
  
  return allPresent;
}

/**
 * Test direct connectivity to Azure OpenAI
 */
async function testDirectAzureOpenAI() {
  console.log(`\n${colors.bright}Testing direct connectivity to Azure OpenAI...${colors.reset}`);
  
  const config = {
    apiBase: process.env.AZURE_OPENAI_API_BASE,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };
  
  console.log(`${colors.dim}URL: ${config.apiBase}${colors.reset}`);
  
  try {
    const url = `${config.apiBase}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Respond with a single word: "Fallback"' }
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
 * Main function
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}=== Azure OpenAI Fallback Test ====${colors.reset}\n`);
  
  // Check environment variables
  const envVarsOk = checkEnvironmentVariables();
  
  if (!envVarsOk) {
    console.log(`\n${colors.red}✗ Missing required environment variables. Please check your server/.env file.${colors.reset}`);
    process.exit(1);
  }
  
  // Test direct Azure OpenAI connection
  const directConnectionOk = await testDirectAzureOpenAI();
  
  console.log(`\n${colors.bright}${colors.cyan}=== Test Complete ====${colors.reset}`);
  
  // Provide summary
  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  if (directConnectionOk) {
    console.log(`${colors.green}✓ Direct Azure OpenAI connection is working${colors.reset}`);
    console.log(`${colors.green}✓ Fallback mechanism can use this connection${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Direct Azure OpenAI connection is not working${colors.reset}`);
    console.log(`${colors.red}✗ Fallback mechanism will not work${colors.reset}`);
    console.log(`${colors.dim}Please check the logs above for more details${colors.reset}`);
  }
}

main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});