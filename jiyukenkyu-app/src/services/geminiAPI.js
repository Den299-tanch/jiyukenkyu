
export async function callGemini(userText, history) {
  const newHistory = [...history, { role: 'user', parts: [{ text: userText }] }];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: newHistory })
  });

  const data = await res.json();
  console.log('APIレスポンス:', JSON.stringify(data, null, 2));

  if (!data.candidates) {
    throw new Error(data.error?.message ?? JSON.stringify(data));
  }

  const reply = data.candidates[0].content.parts[0].text;
  const updatedHistory = [...newHistory, { role: 'model', parts: [{ text: reply }] }];

  return { reply, updatedHistory };
}
