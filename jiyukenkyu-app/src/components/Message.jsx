export default function Message({ role, text, isLoading }) {
  return (
    <div className={`msg ${role}`}>
      <div className="label">{role === 'user' ? 'あなた' : 'AI'}</div>
      <div className={`bubble${isLoading ? ' loading' : ''}`}>
        {text}
      </div>
    </div>
  );
}
