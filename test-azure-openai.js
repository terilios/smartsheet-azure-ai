import fetch from 'node-fetch';

const config = {
  apiBase: 'https://ai-idha-sbx-scus-001.openai.azure.com',
  apiKey: 'dacd968872464f9d833d2b15dc57d049',
  apiVersion: '2024-08-01-preview',
  deployment: 'gpt-4o-2024-08-06'
};

async function testAzureOpenAI() {
  const url = `${config.apiBase}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello! This is a test message.' }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error status:', response.status);
      console.error('Error details:', error);
      return;
    }

    const data = await response.json();
    console.log('Success! Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testAzureOpenAI();
