export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Note: This file is kept for reference but we'll be making API calls through the backend
// to keep the API key secure. Frontend doesn't need direct OpenAI access.

// The following code is removed because the API calls will be handled on the backend.
//export const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
//export const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
//
//export async function createChatCompletion(messages: { role: string; content: string }[]) {
//  const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4/chat/completions?api-version=2023-05-15`, {
//    method: 'POST',
//    headers: {
//      'Content-Type': 'application/json',
//      'api-key': AZURE_OPENAI_API_KEY,
//    },
//    body: JSON.stringify({
//      messages,
//      max_tokens: 800,
//      temperature: 0.7,
//    }),
//  });
//
//  if (!response.ok) {
//    throw new Error('Failed to get response from Azure OpenAI');
//  }
//
//  return response.json();
//}