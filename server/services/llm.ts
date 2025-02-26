import fetch from 'node-fetch';
import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Re-export ChatCompletionTool for use in other files
export type { ChatCompletionTool };

export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tools?: ChatCompletionTool[];
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export interface ChatCompletionSuccess {
  success: true;
  result: ChatCompletionResponse;
}

export interface ChatCompletionError {
  success: false;
  error: Error;
}

export type ChatCompletionReturn = ChatCompletionSuccess | ChatCompletionError;

export type CircuitBreakerResult<T> = {
  success: true;
  result: T;
} | {
  success: false;
  error: Error;
};

/**
 * Get a chat completion from Azure OpenAI
 */
export async function getChatCompletion(options: ChatCompletionOptions): Promise<CircuitBreakerResult<ChatCompletionResponse>> {
  const { messages, tools } = options;

  // Use exact configuration from test-azure-openai.js
  const config = {
    apiBase: process.env.AZURE_OPENAI_API_BASE,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };

  if (!config.apiBase || !config.apiKey || !config.apiVersion || !config.deployment) {
    return {
      success: false,
      error: new Error('Missing required Azure OpenAI configuration')
    };
  }

  const url = `${config.apiBase}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  try {
    // Construct the payload once to ensure consistency
    const payload: Record<string, any> = {
      messages,
      max_tokens: 800,
      temperature: 0.7,
      model: config.deployment
    };
    
    // Only include functions if tools are provided
    if (tools && tools.length > 0) {
      payload.functions = tools.map(tool => tool.function);
    }
    
    console.log("LLM Payload: ", JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${error}`);
    }

    const completion = await response.json() as ChatCompletionResponse;
    return {
      success: true,
      result: completion
    };
  } catch (error) {
    console.error('LLM error:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export default {
  getChatCompletion
};
