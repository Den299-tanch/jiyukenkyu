const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function callClaude(userText, history, mode, devMode = false) {
  const newHistory = [...history, { role: 'user', content: userText }];

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: newHistory, mode, devMode }),
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