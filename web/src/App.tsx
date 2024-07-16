import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chat from './components/Chat';
import ChatList from './components/ChatList';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatList />} />
        <Route path="/chats/:chatId" element={<Chat />} />
      </Routes>
    </Router>
  );
}