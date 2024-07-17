import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Input, Button, Spin } from 'antd';
import ChatMessage from './ChatMessage';
import styles from './Chat.module.css';
import { notification } from 'antd';

const { TextArea } = Input;
const HOST = 'http://localhost:5382';

interface Message {
  id: string;
  content: {
    role: string;
    parts: Array<{ text?: string }>;
  };
  time: number;
  reactions: Record<string, number>;
}

const Chat: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
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
      const newMessages: Message[] = response.data.data.messages.map((msg: any) => ({
        ...msg,
        reactions: msg.reactions ?? {},  // Initialize with an empty object for each message
      }));
      newMessages.reverse()
      setMessages(prevMessages => before ? [...newMessages, ...prevMessages] : [...newMessages]);
      setHasMore(response.data.hasMore);
      if (newMessages.length > 0) {
        setLastMessageId(newMessages[0].id);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to load messages. Please try again.',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    setLoading(true);
    const userMessage = {
      id: Date.now().toString(), // Temporary ID
      content: { role: 'user', parts: [{ text: inputMessage }] },
      time: Date.now(),
      reactions: {},
    };
    
    // Immediately add user message to the screen
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputMessage('');
  
    try {
      const response = await axios.post(`${HOST}/chats/${chatId}/messages`, { message: inputMessage });
      const { userMessage: serverUserMessage, agentResponse } = response.data.data;
      
      // Update messages with the server-generated user message and agent response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === userMessage.id ? { ...serverUserMessage, reactions: {} } : msg
        ).concat({ ...agentResponse, reactions: {} })
      );
    } catch (error) {
      console.error('Error sending message:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to send message. Please try again.',
      });
      // Remove the temporary user message if there's an error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
        const response = await axios.put(`${HOST}/chats/${chatId}/messages/${messageId}/react`, { emoji });
        const updatedMessage = response.data.data;
        setMessages(prevMessages =>
            prevMessages.map(msg =>
                msg.id === messageId ? { ...msg, reactions: updatedMessage.reactions } : msg
            )
        );
    } catch (error) {
        console.error('Error updating reaction:', error);
        notification.error({
            message: 'Error',
            description: 'Failed to update reaction. Please try again.',
        });
    }
};


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
      if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
        loadMessages(lastMessageId || undefined);
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
  }, [loadMessages, isLoadingMore, hasMore, lastMessageId]);

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
        {isLoadingMore && <Spin />}
        <div ref={topMessageRef} />
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isUser={message.content.role === 'user'}
            onReact={handleReaction}
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
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !inputMessage.trim()} loading={loading}>
          Send
        </Button>
      </div>
    </div>
  );
};

export default Chat;