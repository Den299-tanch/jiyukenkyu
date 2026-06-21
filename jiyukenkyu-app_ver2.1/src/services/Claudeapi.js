export async function callClaude(userText, history, mode) {
  // Claude の形式：{ role: 'user'|'assistant', content: 'テキスト' }
  const newHistory = [...history, { role: 'user', content: userText }];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: newHistory, mode }),
  });

  const data = await res.json();
  console.log('APIレスポンス:', JSON.stringify(data, null, 2));

  if (!data.content) {
    throw new Error(data.error?.message ?? JSON.stringify(data));
  }

  const reply = data.content[0].text;
  const updatedHistory = [...newHistory, { role: 'assistant', content: reply }];

  return { reply, updatedHistory };
}