import React from 'react';
import Chat from './components/Chat';
import styles from './App.module.css';

const App: React.FC = () => {
    return (
        <div>
            <div className={styles.header}>
                <h2>Hera Agents Chat</h2>
            </div>
            <Chat />
        </div>
    );
};

export default App;