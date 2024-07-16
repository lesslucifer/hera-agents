import React from 'react';
import { marked } from 'marked';
import styles from './Content.module.css';

interface ContentProps {
    content: {
        role: string;
        parts: Array<{ text?: string }>;
    };
}

const Content: React.FC<ContentProps> = ({ content }) => {
    return (
        <div className={styles.contentContainer}>
            <div className={styles.roleContainer}>
                <label>Role: {content.role}</label>
            </div>
            <div className={styles.partsContainer}>
                {content.parts.map((part, index) => {
                    if (part.text) return (
                        <div 
                            key={index} 
                            className={styles.part} 
                            dangerouslySetInnerHTML={{ __html: marked(part.text || '') as string }}
                        />
                    );
                    return <div key={index}>{JSON.stringify(part, null, 2)}</div>;
                })}
            </div>
        </div>
    );
};

export default Content;