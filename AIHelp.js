// AIHelp.js - Client-side AI using Groq
// Get free API key: https://console.groq.com/keys
// Paste BELOW, save, reload AIHelp.html
// For git: Add to .gitignore - keys shouldn't be committed!

const GROQ_API_KEY = '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'
async function askAI(question) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'gsk_your') {
    const errorDiv = document.getElementById('error');
    const errorMsg = document.getElementById('error-message');
    errorMsg.textContent = 'Paste your Groq API key into line 6 first!';
    errorDiv.style.display = 'block';
    return;
  }

  const thinkingDiv = document.getElementById('thinking');
  const responseDiv = document.getElementById('response');
  const answerDiv = document.getElementById('answer');
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('error-message');

  thinkingDiv.style.display = 'block';
  responseDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful electronics/circuits tutor. Explain clearly, use simple language, focus on Ohm\'s Law, Kirchhoff, capacitance. Keep answers concise.'
          },
          { role: 'user', content: question }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `Error ${response.status}`);
    }

    const data = await response.json();
    answerDiv.innerHTML = data.choices[0].message.content.replace(/\n/g, '<br>');
    responseDiv.style.display = 'block';

  } catch (error) {
    errorMsg.textContent = `Error: ${error.message}`;
    errorDiv.style.display = 'block';
  } finally {
    thinkingDiv.style.display = 'none';
  }
}

