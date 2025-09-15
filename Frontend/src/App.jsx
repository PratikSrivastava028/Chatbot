import { useState, useEffect, useCallback, useRef, memo } from 'react';
import './App.css';
import { io } from "socket.io-client";

// ChatHeader component
const ChatHeader = memo(() => (
  <div className="chat-header">
    <h1>PratChat</h1>
  </div>
));

// Message component with better time formatting
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

// Enhanced TypingIndicator with animation delay
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

// Chat Input Form Component
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
  const [isAITyping, setIsAITyping] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Format time utility function
  const formatTime = useCallback((date) => {
    if (!(date instanceof Date)) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Improved scroll handling with intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      },
      { threshold: 0.5 }
    );

    if (messagesEndRef.current) {
      observer.observe(messagesEndRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Enhanced socket connection with retry logic
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;

    const connectSocket = () => {
      const socketInstance = io("http://localhost:3000", {
        reconnection: true,
        reconnectionAttempts: maxRetries,
        reconnectionDelay: 1000 * Math.min(retryCount + 1, 5),
        timeout: 10000
      });
      useEffect(() => {
    fetch("https://chatbot-ieqa.onrender.com") // backend URL
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error(err));
  }, []);

      socketInstance.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        retryCount = 0;
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Connection error:', error);
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error('Max reconnection attempts reached');
        }
      });
      socketInstance.on('ai-msg-response', (response) => {
        // Clear both timeouts when response is received
        if (responseTimeoutRef.current) {
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }
        if (thinkingMessageTimeoutRef.current) {
          clearTimeout(thinkingMessageTimeoutRef.current);
          thinkingMessageTimeoutRef.current = null;
        }

        const timestamp = new Date();
        setConversations(prev => [...prev, {
          text: response,
          type: 'incoming',
          timestamp
        }]);
        setIsAITyping(false);
      });

      setSocket(socketInstance);

      return socketInstance;
    };

    const socketInstance = connectSocket();

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Welcome message with better state management
  useEffect(() => {
    if (!conversations.length) {
      const timer = setTimeout(() => {
        setIsAITyping(false);
        setConversations([{
          text: "Hi! I'm PratChat developed by Pratik, your AI assistant. How can I help you today?",
          type: 'incoming',
          timestamp: new Date()
        }]);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [conversations.length]);

  // Response timeout handling
  const RESPONSE_TIMEOUT = 120000; // 2 minutes timeout for long responses
  const responseTimeoutRef = useRef(null);
  const thinkingMessageTimeoutRef = useRef(null);

  // Optimized message handler
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || !socket) return;

    const timestamp = new Date();

    // Clear any existing timeouts
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
    }
    if (thinkingMessageTimeoutRef.current) {
      clearTimeout(thinkingMessageTimeoutRef.current);
    }

    try {
      // Add user message
      setConversations(prev => [...prev, {
        text: trimmedInput,
        type: 'outgoing',
        timestamp
      }]);
      
      setInput('');
      setIsAITyping(true);

      // Set timeout for "still thinking" message
      thinkingMessageTimeoutRef.current = setTimeout(() => {
        if (isAITyping) {  // Only show if still typing
          setConversations(prev => [...prev, {
            text: "I'm still thinking... This might take a moment for longer responses.",
            type: 'incoming',
            timestamp: new Date()
          }]);
        }
      }, 8000); // Show "still thinking" message after 8 seconds

      // Set response timeout
      responseTimeoutRef.current = setTimeout(() => {
        setIsAITyping(false);
        setConversations(prev => [...prev, {
          text: "I apologize, but I'm taking too long to respond. Please try again with a shorter query.",
          type: 'incoming',
          timestamp: new Date()
        }]);
      }, RESPONSE_TIMEOUT);

      // Emit message to socket
      socket.emit("ai-msg", trimmedInput);
      
    } catch (error) {
      console.error('Error in chat interaction:', error);
      setIsAITyping(false);
      setConversations(prev => [...prev, {
        text: "I apologize, but I encountered an error. Please try again.",
        type: 'incoming',
        timestamp: new Date()
      }]);

      // Clear timeouts on error
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      if (thinkingMessageTimeoutRef.current) {
        clearTimeout(thinkingMessageTimeoutRef.current);
      }
    }
  }, [input, socket, isAITyping]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  return (
    <div className="chat-container" ref={chatContainerRef}>
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

export default App
