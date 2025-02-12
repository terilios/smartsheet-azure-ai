import fetch from 'node-fetch';

const config = {
  apiBase: 'http://localhost:8000',
  model: 'gpt-4'  // This maps to our Azure deployment via litellm config
};

async function testLiteLLM() {
  const url = `${config.apiBase}/chat/completions`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
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

testLiteLLM();
