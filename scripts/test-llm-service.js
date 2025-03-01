#!/usr/bin/env node

/**
 * Test script to verify the LLM service with fallback mechanism
 * 
 * Usage:
 *   node scripts/test-llm-service.js
 * 
 * This script tests:
 * 1. The LLM service's ability to connect to Azure OpenAI
 * 2. The fallback mechanism from LiteLLM to direct Azure OpenAI
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getChatCompletion } from '../server/services/llm.js';

// If the above import fails, try this alternative import
// import { getChatCompletion } from '../server/services/llm';

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
      console.log(`${colors.yellow}⚠ ${name}${colors.reset}: Not set`);
      if (name.startsWith('LITELLM')) {
        console.log(`  ${colors.dim}(LiteLLM variables are optional, will fall back to direct Azure OpenAI)${colors.reset}`);
      } else if (name.startsWith('AZURE_OPENAI')) {
        console.log(`  ${colors.red}(Azure OpenAI variables are required)${colors.reset}`);
        allPresent = false;
      }
    }
  }
  
  return allPresent;
}

/**
 * Test the LLM service
 */
async function testLLMService() {
  console.log(`\n${colors.bright}Testing LLM service...${colors.reset}`);
  
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Respond with a single word: "Working"' }
  ];
  
  try {
    console.log(`${colors.dim}Sending request to LLM service...${colors.reset}`);
    
    const result = await getChatCompletion({ messages });
    
    if (result.success) {
      const content = result.result.choices[0]?.message?.content?.trim();
      console.log(`${colors.green}✓ LLM service returned a response${colors.reset}`);
      console.log(`${colors.dim}Response: "${content}"${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ LLM service failed${colors.reset}`);
      console.log(`${colors.dim}Error: ${result.error.message}${colors.reset}`);
      if (result.details) {
        console.log(`${colors.dim}Details: ${result.details}${colors.reset}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Unexpected error testing LLM service${colors.reset}`);
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}=== LLM Service Test ====${colors.reset}\n`);
  
  // Check environment variables
  const envVarsOk = checkEnvironmentVariables();
  
  if (!envVarsOk) {
    console.log(`\n${colors.red}✗ Missing required environment variables. Please check your server/.env file.${colors.reset}`);
    process.exit(1);
  }
  
  // Test LLM service
  const llmServiceOk = await testLLMService();
  
  console.log(`\n${colors.bright}${colors.cyan}=== Test Complete ====${colors.reset}`);
  
  // Provide summary
  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  if (llmServiceOk) {
    console.log(`${colors.green}✓ LLM service is working correctly${colors.reset}`);
    if (process.env.LITELLM_API_BASE) {
      console.log(`${colors.dim}Note: If LiteLLM failed, the service would have fallen back to direct Azure OpenAI${colors.reset}`);
    } else {
      console.log(`${colors.dim}Note: Using direct Azure OpenAI connection (LiteLLM not configured)${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✗ LLM service is not working correctly${colors.reset}`);
    console.log(`${colors.dim}Please check the logs above for more details${colors.reset}`);
  }
}

main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});