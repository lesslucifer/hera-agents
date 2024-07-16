import React from 'react';
import { marked } from 'marked';
import moment from 'moment';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: {
    role: string;
    parts: Array<{ text?: string }>;
  };
  isUser: boolean;
  timestamp: Date;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, timestamp }) => {
  return (
    <div className={`${styles.chatMessage} ${isUser ? styles.user : styles.agent}`}>
      <div className={styles.messageContent}>
        {message.parts.map((part, index) => (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: marked(part.text || '') as string }}
          />
        ))}
      </div>
      <div className={styles.messageTimestamp}>
        {moment(timestamp).format('HH:mm')}
      </div>
    </div>
  );
};

export default ChatMessage;