const API_KEY = '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'; // Replace with your actual key
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function askAI(question) {
  // Hide previous responses
  hideAll();

  if (!API_KEY || API_KEY === 'gsk-your-groq-api-key-here') {
    showError('Please set your Groq API key in AIHelp.js (free at console.groq.com/keys)');
    return;
  }

  showThinking();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: "You are a friendly electronics and circuit assistant. Explain concepts simply with examples. Topics: Ohm's Law, Kirchhoff's laws (KCL/KVL), capacitance, series/parallel circuits, etc. Keep concise and helpful."
          },
          { role: 'user', content: question }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const answer = data.choices[0].message.content.trim();

    showAnswer(answer);
  } catch (error) {
    console.error('AI Error:', error);
    showError(`Failed: ${error.message}. Check key/network/CORS. Try incognito.`);
  }
}

function showThinking() {
  document.getElementById('thinking').style.display = 'block';
}

function showAnswer(text) {
  hideAll();
  document.getElementById('answer').textContent = text;
  document.getElementById('response').style.display = 'block';
}

function showError(message) {
  hideAll();
  document.getElementById('error-message').textContent = message;
  document.getElementById('error').style.display = 'block';
}

function hideAll() {
  document.getElementById('thinking').style.display = 'none';
  document.getElementById('response').style.display = 'none';
  document.getElementById('error').style.display = 'none';
}

// Auto-hide errors
setInterval(() => {
  if (document.getElementById('error').style.display === 'block') {
    hideAll();
  }
}, 10000);
