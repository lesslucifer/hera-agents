import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import _ from 'lodash';
import ChatMessage from './ChatMessage';
import styles from './Chat.module.css';

const HOST = 'http://localhost:5382';

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Array<{ content: string; timestamp: Date; isUser: boolean }>>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const sendMessage = useCallback(async () => {
        if (!inputMessage.trim()) return;

        const newMessage = { content: inputMessage, timestamp: new Date(), isUser: true };
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${HOST}/agent`, { q: inputMessage });
            const agentMessage = { 
                content: _.get(response, 'data.data.parts.0.text', 'Sorry, I couldn\'t process that.'),
                timestamp: new Date(),
                isUser: false
            };
            setMessages(prevMessages => [...prevMessages, agentMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = { 
                content: 'Sorry, there was an error processing your message. Please try again.',
                timestamp: new Date(),
                isUser: false
            };
            setMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputMessage]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className={styles.chatContainer}>
            <div className={styles.chatMessages} ref={chatContainerRef}>
                {messages.map((message, index) => (
                    <ChatMessage key={index} message={message} isUser={message.isUser} />
                ))}
                {isLoading && <div className={styles.loadingIndicator}>Agent is typing...</div>}
            </div>
            <div className={styles.chatInput}>
                <input 
                    type="text" 
                    value={inputMessage} 
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message here..."
                    disabled={isLoading}
                />
                <button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>Send</button>
            </div>
        </div>
    );
};

export default Chat;