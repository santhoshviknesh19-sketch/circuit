async function askAI(question) {
  // Change this to your ACTUAL Vercel deployment URL
  const PROXY_URL = 'https://your-project-name.vercel.app/api/chat';

  const thinkingDiv = document.getElementById('thinking');
  const responseDiv = document.getElementById('response');
  const answerDiv = document.getElementById('answer');

  thinkingDiv.style.display = 'block';
  responseDiv.style.display = 'none';

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question }),
    });

    const data = await response.json();
    // Groq returns an object with choices[0].message.content
    answerDiv.innerHTML = data.choices[0].message.content.replace(/\n/g, '<br>');
    responseDiv.style.display = 'block';
  } catch (error) {
    alert("Check your Vercel URL and Environment Variables!");
  } finally {
    thinkingDiv.style.display = 'none';
  }
}

// Your existing button listener
document.getElementById('ask-button').addEventListener('click', () => {
  const question = document.getElementById('question').value.trim();
  if (question) askAI(question);
});