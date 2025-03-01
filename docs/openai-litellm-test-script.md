# OpenAI LiteLLM Test Script

This document contains a script for testing the OpenAI API via LiteLLM. This script can be used to determine if the issues with LiteLLM are specific to Azure OpenAI or if they are more general LiteLLM configuration issues.

## Implementation

Create a new file at `scripts/test-openai-litellm.js` with the following content:

```javascript
#!/usr/bin/env node

/**
 * Test script to verify connectivity to OpenAI API via LiteLLM
 *
 * Usage:
 *   node scripts/test-openai-litellm.js
 *
 * This script tests:
 * 1. If the LiteLLM proxy server is reachable
 * 2. If the proxy can successfully connect to OpenAI API
 * 3. If the API key and other configuration is correct
 */

import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "server", ".env") });

// ANSI color codes for better readability
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log(
    `${colors.bright}Checking environment variables...${colors.reset}`
  );

  const variables = {
    LITELLM_API_BASE: process.env.LITELLM_API_BASE,
    LITELLM_MODEL: process.env.LITELLM_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "********" : undefined,
  };

  let allPresent = true;

  for (const [name, value] of Object.entries(variables)) {
    if (value) {
      console.log(
        `${colors.green}✓ ${name}${colors.reset}: ${
          name.includes("KEY") ? "********" : value
        }`
      );
    } else {
      console.log(`${colors.red}✗ ${name}${colors.reset}: Not set`);
      allPresent = false;
    }
  }

  return allPresent;
}

/**
 * Test if the LiteLLM server is running
 */
async function testServerAvailability() {
  console.log(
    `${colors.bright}Testing LiteLLM server availability...${colors.reset}`
  );
  console.log(
    `${colors.dim}URL: ${process.env.LITELLM_API_BASE}${colors.reset}`
  );

  try {
    const response = await fetch(`${process.env.LITELLM_API_BASE}/health`);

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ LiteLLM server is running${colors.reset}`);
      console.log(
        `${colors.dim}Server status: ${JSON.stringify(data)}${colors.reset}`
      );
      return true;
    } else {
      console.log(
        `${colors.red}✗ LiteLLM server returned status ${response.status}${colors.reset}`
      );
      console.log(
        `${colors.dim}Response: ${await response.text()}${colors.reset}`
      );
      return false;
    }
  } catch (error) {
    console.log(
      `${colors.red}✗ Could not connect to LiteLLM server${colors.reset}`
    );
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);

    if (error.code === "ECONNREFUSED") {
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
 * Test if the LiteLLM server can connect to OpenAI API
 */
async function testOpenAIConnection() {
  console.log(
    `\n${colors.bright}Testing OpenAI API connection through LiteLLM...${colors.reset}`
  );
  console.log(`${colors.dim}Model: openai/gpt-4o${colors.reset}`);

  try {
    const response = await fetch(
      `${process.env.LITELLM_API_BASE}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            {
              role: "user",
              content: 'Respond with a single word: "OpenAITest"',
            },
          ],
          max_tokens: 10,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      console.log(
        `${colors.green}✓ Successfully connected to OpenAI API via LiteLLM${colors.reset}`
      );
      console.log(`${colors.dim}Response: "${content}"${colors.reset}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(
        `${colors.red}✗ OpenAI API connection failed with status ${response.status}${colors.reset}`
      );
      console.log(`${colors.dim}Error: ${errorText}${colors.reset}`);

      // Provide specific troubleshooting advice based on error
      if (response.status === 401 || response.status === 403) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Check if the OPENAI_API_KEY environment variable is set correctly
2. Verify that the API key has access to the specified model
3. Check if the API key has expired
`);
      } else if (response.status === 404) {
        console.log(`
${colors.yellow}Troubleshooting:${colors.reset}
1. Verify that the model name in litellm.config.yaml is correct
2. Check if the model exists and is available to your account
`);
      }

      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Request to OpenAI API failed${colors.reset}`);
    console.log(`${colors.dim}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(
    `${colors.bright}${colors.cyan}=== OpenAI LiteLLM Test ====${colors.reset}\n`
  );

  // Check environment variables
  const envVarsOk = checkEnvironmentVariables();

  if (!envVarsOk) {
    console.log(
      `\n${colors.red}✗ Missing required environment variables. Please check your server/.env file.${colors.reset}`
    );
    process.exit(1);
  }

  console.log(""); // Empty line for readability

  // Run tests
  const serverAvailable = await testServerAvailability();

  if (serverAvailable) {
    await testOpenAIConnection();
  }

  console.log(
    `\n${colors.bright}${colors.cyan}=== Test Complete ====${colors.reset}`
  );

  // Provide summary
  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  if (!serverAvailable) {
    console.log(
      `${colors.yellow}⚠ LiteLLM server is not available. Make sure it's running with:${colors.reset}`
    );
    console.log(`${colors.dim}   npm run start:litellm${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ LiteLLM server is available${colors.reset}`);
  }
}

runTests().catch((error) => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});
```

## Usage

1. Make the script executable:

   ```bash
   chmod +x scripts/test-openai-litellm.js
   ```

2. Add the script to package.json:

   ```json
   "scripts": {
     // ... existing scripts
     "test:openai-litellm": "node scripts/test-openai-litellm.js"
   }
   ```

3. Run the script:
   ```bash
   npm run test:openai-litellm
   ```

## Expected Results

If the OpenAI API connection via LiteLLM is working correctly, you should see output similar to:

```
=== OpenAI LiteLLM Test ====

Checking environment variables...
✓ LITELLM_API_BASE: http://localhost:4000
✓ LITELLM_MODEL: gpt-4o
✓ OPENAI_API_KEY: ********

Testing LiteLLM server availability...
URL: http://localhost:4000
✓ LiteLLM server is running
Server status: {"healthy_endpoints":[],"unhealthy_endpoints":[],"healthy_count":0,"unhealthy_count":0}

Testing OpenAI API connection through LiteLLM...
Model: openai/gpt-4o
✓ Successfully connected to OpenAI API via LiteLLM
Response: "OpenAITest"

=== Test Complete ====

Summary:
✓ LiteLLM server is available
```

If there are issues with the connection, the script will provide detailed error messages and troubleshooting advice.

## Comparison with Azure OpenAI Test

After running this test, compare the results with the Azure OpenAI test:

1. If the OpenAI API test succeeds but the Azure OpenAI test fails, the issue is likely specific to the Azure OpenAI configuration in LiteLLM.

2. If both tests fail, the issue is likely with the LiteLLM configuration or setup.

3. If both tests succeed, then the issue may have been resolved by the configuration changes.

This comparison will help determine the next steps for the LiteLLM integration.
