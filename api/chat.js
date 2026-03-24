export default async function handler(req, res) {
  // 1. Fixes the CORS error
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handles the "Preflight" request from the browser
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a helpful electronics tutor.' },
          { role: 'user', content: question }
        ],
      }),
    });

    const data = await response.json();

    // 3. Check if Groq sent an error (Fixes the 401)
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API Error' });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server crashed: ' + error.message });
  }
}