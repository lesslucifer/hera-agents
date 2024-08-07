import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { List, Input, Button, Typography, Space, Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styles from './ChatList.module.css';
import { notification } from 'antd';

const { Title, Text } = Typography;
const { Search } = Input;

const HOST = 'http://localhost:5382';

interface Chat {
    id: string;
    lastMessage?: {
        content: string;
        timestamp: Date;
    };
}

const ChatList: React.FC = () => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastId, setLastId] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchChats = async (initial = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const response = await axios.get(`${HOST}/chats`, {
                params: {
                    limit: 20,
                    before: initial ? undefined : lastId
                }
            });
            const { chats: newChats, hasMore } = response.data?.data ?? {};
            console.log(response.data)
            setChats(prevChats => initial ? newChats : [...prevChats, ...newChats]);
            setHasMore(hasMore);
            if (newChats.length > 0) {
                setLastId(newChats[newChats.length - 1].id);
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
            setHasMore(false)
            notification.error({
                message: 'Error',
                description: 'Failed to fetch chats. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    const createNewChat = async (prompt: string) => {
        if (!prompt.trim()) return;
        setLoading(true);
        try {
            const response = await axios.post(`${HOST}/chats`, { q: prompt });
            const newChat = response.data;
            setChats(prevChats => [newChat, ...prevChats]);
            navigate(`/chats/${newChat.id}`);
        } catch (error) {
            console.error('Error creating new chat:', error);
            notification.error({
                message: 'Error',
                description: 'Failed to create a new chat. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChats(true);
    }, []);

    return (
        <div className={styles.chatListContainer}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Title level={2}>Your Chats</Title>
                <Search
                    placeholder="Enter your question to start a new chat"
                    enterButton={<Button type="primary" icon={<PlusOutlined />}>New Chat</Button>}
                    size="large"
                    onSearch={createNewChat}
                    loading={loading}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            createNewChat((e.target as HTMLInputElement).value);
                        }
                    }}
                />
                <List
                    dataSource={chats}
                    renderItem={(chat) => (
                        <List.Item onClick={() => navigate(`/chats/${chat.id}`)} style={{ cursor: 'pointer' }}>
                            <Card hoverable style={{ width: '100%' }}>
                                <Card.Meta
                                    title={chat.lastMessage?.content || 'New Chat'}
                                    description={
                                        <Text type="secondary">
                                            {chat.lastMessage?.timestamp
                                                ? new Date(chat.lastMessage.timestamp).toLocaleString()
                                                : 'No messages yet'}
                                        </Text>
                                    }
                                />
                            </Card>
                        </List.Item>
                    )}
                    loadMore={
                        hasMore && (
                            <div style={{ textAlign: 'center', marginTop: 12, height: 32, lineHeight: '32px' }}>
                                <Button onClick={() => fetchChats()} loading={loading}>Load More</Button>
                            </div>
                        )
                    }
                />
            </Space>
        </div>
    );
};

export default ChatList;