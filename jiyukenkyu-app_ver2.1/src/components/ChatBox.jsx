import MessageList from './MessageList';
import InputForm from './InputForm';

export default function ChatBox({ messages, input, setInput, onSend, loading }) {
  return (
    <div id="chat-box">
      <MessageList messages={messages} />
      <InputForm
        input={input}
        setInput={setInput}
        onSend={onSend}
        disabled={loading}
      />
    </div>
  );
}
