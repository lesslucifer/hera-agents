import React, { useState } from 'react';
import { marked } from 'marked';
import moment from 'moment';
import { Tooltip, Popover } from 'antd';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: {
    id: string;
    content: {
      role: string;
      parts: Array<{ text?: string }>;
    };
    time: number;
    reactions: Record<string, number>;
  };
  isUser: boolean;
  onReact: (messageId: string, emoji: string) => Promise<void>;
}

const EMOJI_LIST = ['👍', '😂', '😮', '❤️', '👏', '🎉'];

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, onReact }) => {
  const [showReactions, setShowReactions] = useState(false);

  const handleReact = async (emoji: string) => {
    await onReact(message.id, emoji);
    setShowReactions(false);
  };

  const reactionContent = (
    <div className={styles.reactionPicker}>
      {EMOJI_LIST.map((emoji) => (
        <button key={emoji} onClick={() => handleReact(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );

  console.log(`Message `, message.id, `Reaction`, message.reactions)

  return (
    <div className={`${styles.chatMessage} ${isUser ? styles.user : styles.agent}`}>
      <div className={styles.messageContent}>
        {message.content.parts.map((part, index) => (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: marked(part.text || '') as string }}
          />
        ))}
        <div className={styles.reactionContainer}>
          {Object.entries(message.reactions).map(([emoji, count]) => (
            count > 0 && (
              <Tooltip key={emoji} title={`${count} ${emoji}`}>
                <span className={styles.reactionBubble} onClick={() => handleReact(emoji)}>
                  {emoji} {count}
                </span>
              </Tooltip>
            )
          ))}
          <Popover
            content={reactionContent}
            trigger="click"
            open={showReactions}
            onOpenChange={setShowReactions}
            placement="top"
          >
            <button className={styles.addReactionButton}>+</button>
          </Popover>
        </div>
      </div>
      <div className={styles.messageTimestamp}>
        {moment(message.time).format('HH:mm')}
      </div>
    </div>
  );
};

export default ChatMessage;