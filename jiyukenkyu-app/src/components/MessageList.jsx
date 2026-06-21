import { useEffect, useRef } from 'react';
import Message from './Message';

export default function MessageList({ messages }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div id="messages">
      {messages.map((msg, idx) => (
        <Message
          key={idx}
          role={msg.role}
          text={msg.text}
          isLoading={msg.isLoading}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
