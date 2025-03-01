import fetch from 'node-fetch';
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getSheetInfo } from "./sheet-data";

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
  statusCode?: number;
  details?: string;
}

export type ChatCompletionReturn = ChatCompletionSuccess | ChatCompletionError;

export type CircuitBreakerResult<T> = {
  success: true;
  result: T;
} | {
  success: false;
  error: Error;
  statusCode?: number;
  details?: string;
};

/**
 * Get a chat completion using LiteLLM proxy to Azure OpenAI
 * Falls back to direct Azure OpenAI if LiteLLM fails
 */
export async function getChatCompletion(options: ChatCompletionOptions): Promise<CircuitBreakerResult<ChatCompletionResponse>> {
  const { messages, tools } = options;

  // Try LiteLLM first if configured
  if (process.env.LITELLM_API_BASE) {
    const liteLLMResult = await getLiteLLMCompletion(options);
    
    // If successful, return the result
    if (liteLLMResult.success) {
      return liteLLMResult;
    }
    
    // Otherwise, log the error and fall back to direct Azure OpenAI
    console.log(`[LLM Fallback] LiteLLM failed: ${liteLLMResult.error.message}. Falling back to direct Azure OpenAI.`);
  } else {
    console.log('[LLM Info] LITELLM_API_BASE not set, using direct Azure OpenAI');
  }
  
  // Fall back to direct Azure OpenAI
  return getDirectAzureOpenAICompletion(options);
}

/**
 * Get a chat completion using LiteLLM proxy
 */
async function getLiteLLMCompletion(options: ChatCompletionOptions): Promise<CircuitBreakerResult<ChatCompletionResponse>> {
  const { messages, tools } = options;

  // Use LiteLLM proxy configuration
  const config = {
    apiBase: process.env.LITELLM_API_BASE || 'http://localhost:4000',
    model: process.env.LITELLM_MODEL || 'gpt-4'
  };

  if (!config.apiBase) {
    return {
      success: false,
      error: new Error('Missing required LiteLLM configuration'),
      details: 'LITELLM_API_BASE environment variable is not set'
    };
  }

  const url = `${config.apiBase}/chat/completions`;
  const requestStartTime = Date.now();

  try {
    // Construct the payload once to ensure consistency
    const payload: Record<string, any> = {
      messages,
      max_tokens: 800,
      temperature: 0.7,
      model: config.model
    };
    
    // Only include tools if provided
    if (tools && tools.length > 0) {
      payload.tools = tools;
    }
    
    console.log(`[LiteLLM Request] ${new Date().toISOString()} - Model: ${config.model}`);
    console.log(`[LiteLLM Request] Payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - requestStartTime;
    console.log(`[LiteLLM Response] Status: ${response.status}, Time: ${responseTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = errorText;
      }
      
      console.error(`[LiteLLM Error] Status: ${response.status}, Details:`, errorDetails);
      
      // Handle specific error types
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication error: Invalid API key or insufficient permissions`);
      } else if (response.status === 404) {
        throw new Error(`Resource not found: Check if the LiteLLM proxy is running`);
      } else if (response.status === 429) {
        throw new Error(`Rate limit exceeded: Too many requests`);
      } else if (response.status >= 500) {
        throw new Error(`Server error: The LLM service is experiencing issues`);
      }
      
      throw new Error(`LiteLLM API error (${response.status}): ${errorText}`);
    }

    const completion = await response.json() as ChatCompletionResponse;
    console.log(`[LiteLLM Success] Received response with ${completion.choices.length} choices`);
    
    return {
      success: true,
      result: completion
    };
  } catch (error) {
    // Categorize errors for better diagnostics
    let statusCode: number | undefined;
    let details: string | undefined;
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      statusCode = 503;
      details = 'Connection error: Unable to reach the LiteLLM proxy server';
      console.error('[LiteLLM Connection Error]', error.message);
    } else {
      console.error('[LiteLLM Error]', error);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      statusCode,
      details
    };
  }
}

/**
 * Get a chat completion directly from Azure OpenAI
 */
async function getDirectAzureOpenAICompletion(options: ChatCompletionOptions): Promise<CircuitBreakerResult<ChatCompletionResponse>> {
  const { messages, tools } = options;

  // Use Azure OpenAI configuration
  const config = {
    apiBase: process.env.AZURE_OPENAI_API_BASE,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };

  if (!config.apiBase || !config.apiKey || !config.deployment) {
    return {
      success: false,
      error: new Error('Missing required Azure OpenAI configuration'),
      details: 'AZURE_OPENAI_API_BASE, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT environment variables are required'
    };
  }

  const url = `${config.apiBase}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;
  const requestStartTime = Date.now();

  try {
    // Construct the payload once to ensure consistency
    const payload: Record<string, any> = {
      messages,
      max_tokens: 800,
      temperature: 0.7
    };
    
    // Only include tools if provided
    if (tools && tools.length > 0) {
      payload.tools = tools;
    }
    
    console.log(`[Azure OpenAI Request] ${new Date().toISOString()} - Deployment: ${config.deployment}`);
    console.log(`[Azure OpenAI Request] Payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - requestStartTime;
    console.log(`[Azure OpenAI Response] Status: ${response.status}, Time: ${responseTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = errorText;
      }
      
      console.error(`[Azure OpenAI Error] Status: ${response.status}, Details:`, errorDetails);
      
      // Handle specific error types
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication error: Invalid API key or insufficient permissions`);
      } else if (response.status === 404) {
        throw new Error(`Resource not found: Check if the deployment exists`);
      } else if (response.status === 429) {
        throw new Error(`Rate limit exceeded: Too many requests`);
      } else if (response.status >= 500) {
        throw new Error(`Server error: The Azure OpenAI service is experiencing issues`);
      }
      
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }

    const completion = await response.json() as ChatCompletionResponse;
    console.log(`[Azure OpenAI Success] Received response with ${completion.choices.length} choices`);
    
    return {
      success: true,
      result: completion
    };
  } catch (error) {
    // Categorize errors for better diagnostics
    let statusCode: number | undefined;
    let details: string | undefined;
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      statusCode = 503;
      details = 'Connection error: Unable to reach the Azure OpenAI service';
      console.error('[Azure OpenAI Connection Error]', error.message);
    } else {
      console.error('[Azure OpenAI Error]', error);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      statusCode,
      details
    };
  }
}

export function enhanceSystemPrompt(originalPrompt: string, sheetContext: string): string {
  return `${originalPrompt}\n\nSheet Context:\n${sheetContext}`;
}

export async function loadSheetData(sheetId: string): Promise<string> {
  try {
    // Use the existing sheet data service
    const sheetInfo = await getSheetInfo({ sheetId });
    
    // Format sheet data as context
    const columnsInfo = sheetInfo.data.columns.map((column: { title: string, type: string }) => 
      `- ${column.title} (${column.type})`
    ).join('\n');
    
    const sampleData = sheetInfo.data.rows.slice(0, 5).map((row: any) => 
      JSON.stringify(row)
    ).join('\n');
    
    return `Sheet Name: ${sheetInfo.data.sheetName}
Sheet ID: ${sheetId}
Total Rows: ${sheetInfo.data.totalRows}
Last Updated: ${new Date().toISOString()}

Columns:
${columnsInfo}

Sample Data:
${sampleData}`;
  } catch (error) {
    console.error('Error loading sheet data:', error);
    return `Unable to load data for sheet ${sheetId}`;
  }
}

export function pruneConversationMessages(
  messages: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const systemMessages = messages.filter(msg => msg.role === 'system');
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
  const systemTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  const availableTokens = maxTokens - systemTokens;
  const prunedMessages: ChatMessage[] = [];
  let totalTokens = 0;
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(nonSystemMessages[i].content);
    if (totalTokens + msgTokens <= availableTokens) {
      prunedMessages.unshift(nonSystemMessages[i]);
      totalTokens += msgTokens;
    } else {
      break;
    }
  }
  return [...systemMessages, ...prunedMessages];
}

export default {
  getChatCompletion,
  enhanceSystemPrompt,
  loadSheetData,
  pruneConversationMessages
};
