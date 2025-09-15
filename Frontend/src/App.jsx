import { useState, useEffect, useCallback, useRef, memo } from 'react';
import './App.css';
import { io } from "socket.io-client";

// ChatHeader component
const ChatHeader = memo(() => (
  <div className="chat-header">
    <h1>PratChat</h1>
  </div>
));

// Message component
const Message = memo(({ message, formatTime }) => {
  const timeString = useCallback(() => formatTime(message.timestamp), [message.timestamp, formatTime]);
  return (
    <div className={`message-wrapper ${message.type}`}>
      <div className="message">
        <div className="message-content">
          {message.text}
          <span className="message-time">{timeString()}</span>
        </div>
      </div>
    </div>
  );
});

// TypingIndicator
const TypingIndicator = memo(() => (
  <div className="message-wrapper incoming">
    <div className="message typing-indicator">
      <div className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  </div>
));

// Chat Input Form
const ChatInputForm = memo(({ input, onInputChange, onSubmit }) => (
  <form className="chat-input-form" onSubmit={onSubmit}>
    <input
      type="text"
      value={input}
      onChange={onInputChange}
      placeholder="Type your message here..."
      className="chat-input"
      aria-label="Chat input"
    />
    <button type="submit" className="send-button" aria-label="Send message">
      Send
    </button>
  </form>
));

function App() {
  const [socket, setSocket] = useState(null);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Format time
  const formatTime = useCallback((date) => {
    if (!(date instanceof Date)) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, isAITyping]);

  // Fetch initial message from backend
  useEffect(() => {
    fetch("https://chatbot-ieqa.onrender.com/api/hello") // backend URL
      .then(res => res.json())
      .then(data => {
        setConversations([{
          text: data.message,
          type: 'incoming',
          timestamp: new Date()
        }]);
      })
      .catch(err => console.error(err));
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socketInstance = io("https://chatbot-ieqa.onrender.com"); // backend Socket.io URL

    socketInstance.on('connect', () => {
      console.log('Connected to server');
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socketInstance.on('ai-msg-response', (response) => {
      setIsAITyping(false);
      setConversations(prev => [...prev, {
        text: response,
        type: 'incoming',
        timestamp: new Date()
      }]);
    });

    setSocket(socketInstance);

    return () => socketInstance.disconnect();
  }, []);

  // Handle submit
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || !socket) return;

    const timestamp = new Date();

    // Add user message
    setConversations(prev => [...prev, {
      text: trimmedInput,
      type: 'outgoing',
      timestamp
    }]);
    
    setInput('');
    setIsAITyping(true);

    // Emit to backend
    socket.emit("ai-msg", trimmedInput);
  }, [input, socket]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  return (
    <div className="chat-container">
      <ChatHeader />
      <div className="chat-messages">
        {conversations.map((message, index) => (
          <Message 
            key={`${message.timestamp.getTime()}-${index}`}
            message={message}
            formatTime={formatTime}
          />
        ))}
        {isAITyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInputForm 
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default App;
