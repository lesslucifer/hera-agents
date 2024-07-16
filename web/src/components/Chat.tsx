// Chat.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Input, Button, Spin } from 'antd';
import ChatMessage from './ChatMessage';
import styles from './Chat.module.css';

const { TextArea } = Input;
const HOST = 'http://localhost:5382';

interface Message {
  id: string;
  content: {
    role: string;
    parts: Array<{ text?: string }>;
  };
  time: number;
}

const Chat: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const topMessageRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (before?: string) => {
    if (!chatId) return;
    setIsLoadingMore(true);
    try {
      const response = await axios.get(`${HOST}/chats/${chatId}/messages`, {
        params: { limit: 20, before },
      });
      const newMessages = response.data;
      setMessages(prevMessages => [...newMessages.reverse(), ...prevMessages]);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !chatId) return;

    setIsLoading(true);
    try {
      const response = await axios.post(`${HOST}/chats/${chatId}/messages`, { message: inputMessage });
      const newMessage = response.data;
      setMessages(prevMessages => [...prevMessages, newMessage]);
      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoadingMore) {
        loadMessages(messages[0]?.id);
      }
    }, options);

    if (topMessageRef.current) {
      observerRef.current.observe(topMessageRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMessages, messages, isLoadingMore]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatMessages} ref={chatContainerRef}>
        {isLoadingMore && <Spin className={styles.loadingIndicator} />}
        <div ref={topMessageRef} />
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message.content}
            isUser={message.content.role === 'user'}
            timestamp={new Date(message.time)}
          />
        ))}
      </div>
      <div className={styles.chatInput}>
        <TextArea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here... (Shift + Enter for new line)"
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} loading={isLoading}>
          Send
        </Button>
      </div>
    </div>
  );
};

export default Chat;