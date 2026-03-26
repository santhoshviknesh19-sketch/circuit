
// Pure JS-only Groq AI integration - no Python needed!

const GROQ_API_KEY = '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SYSTEM_PROMPT = `You are a helpful electronics tutor for beginners. Focus on:
- Ohm's Law (V=IR)
- Kirchhoff's Laws (KCL, KVL) 
- Capacitance (series/parallel)
- Equivalent resistance (series/parallel/mixed)
Give clear, step-by-step explanations with examples. Suggest circuit simulator practice. Keep answers concise.`;

async function askAI(question) {
  const thinkingEl = document.getElementById('thinking');
  const responseEl = document.getElementById('response');
  const answerEl = document.getElementById('answer');
  const errorEl = document.getElementById('error');
  
  // Show thinking
  thinkingEl.style.display = 'block';
  responseEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',  // Fast Groq model
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question }
        ],
        max_tokens: 400,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const aiAnswer = data.choices[0].message.content;

    // Hide thinking, show answer
    thinkingEl.style.display = 'none';
    answerEl.textContent = aiAnswer;
    responseEl.style.display = 'block';
    responseEl.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    thinkingEl.style.display = 'none';
    errorEl.querySelector('#error-message').textContent = `AI unavailable: ${error.message}. Try "Ohm's Law" as test.`;
    errorEl.style.display = 'block';
    console.error('Groq API error:', error);
  }
}

// Hide error after 5s
setInterval(() => {
  const errorEl = document.getElementById('error');
  if (errorEl.style.display !== 'none') {
    errorEl.style.display = 'none';
  }
}, 5000);

