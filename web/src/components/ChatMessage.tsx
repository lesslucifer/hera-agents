import React from 'react';
import { marked } from 'marked';
import moment from 'moment';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
    message: {
        content: string;
        timestamp: Date;
    };
    isUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser }) => {
    return (
        <div className={`${styles.chatMessage} ${isUser ? styles.user : styles.agent}`}>
            <div 
                className={styles.messageContent}
                dangerouslySetInnerHTML={{ __html: marked(message.content) as string }}
            />
            <div className={styles.messageTimestamp}>
                {moment(message.timestamp).format('HH:mm')}
            </div>
        </div>
    );
};

export default ChatMessage;