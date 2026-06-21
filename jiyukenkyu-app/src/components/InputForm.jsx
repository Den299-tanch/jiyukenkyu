export default function InputForm({ input, setInput, onSend, disabled }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !disabled) {
      onSend();
    }
  }

  return (
    <div id="input-row">
      <input
        type="text"
        id="user-input"
        placeholder="例: アリってなんで迷子にならないの？"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        id="send-btn"
        onClick={onSend}
        disabled={disabled}
      >
        送信
      </button>
    </div>
  );
}
