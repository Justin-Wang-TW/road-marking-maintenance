import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, User as UserIcon, Bell, CheckCircle, MessageSquare, Filter, ChevronLeft, Reply, Loader2 } from 'lucide-react';
import { Message, MessageType, User, UserRole } from '../types';

interface MessageCenterProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  users: User[];
  currentUser: User;
  onMarkAsRead: (messageId: string) => void;
  onSendMessage: (receiverEmail: string, content: string, type?: string) => Promise<boolean>;
}

const MessageCenter: React.FC<MessageCenterProps> = ({
  isOpen, onClose, messages, users, currentUser, onMarkAsRead, onSendMessage
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'private' | 'system'>('all');
  const [isComposing, setIsComposing] = useState(false);
  const [newMsgReceiver, setNewMsgReceiver] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null); // Email of the other person

  // Group private messages into conversations
  const conversations = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    messages.filter(m => m.type === MessageType.PRIVATE).forEach(msg => {
      const otherParty = msg.senderEmail === currentUser.email ? msg.receiverEmail : msg.senderEmail;
      if (!groups[otherParty]) groups[otherParty] = [];
      groups[otherParty].push(msg);
    });
    // Sort each conversation by timestamp
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
    return groups;
  }, [messages, currentUser.email]);

  // Get list of conversations for the list view
  const conversationList = useMemo(() => {
    return Object.entries(conversations).map(([email, msgs]) => {
      const lastMsg = msgs[msgs.length - 1];
      const otherUser = users.find(u => u.email === email);
      const unreadCount = msgs.filter(m => !m.isRead && m.receiverEmail === currentUser.email).length;
      return {
        email,
        name: otherUser?.name || email,
        lastMsg,
        unreadCount
      };
    }).sort((a, b) => new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime());
  }, [conversations, users, currentUser.email]);

  // Filter non-private messages
  const otherMessages = useMemo(() => {
    return messages.filter(msg => {
      if (activeTab === 'unread') return !msg.isRead && msg.receiverEmail === currentUser.email;
      if (activeTab === 'system') return msg.type === MessageType.SYSTEM || msg.type === MessageType.BROADCAST || msg.type === MessageType.MENTION;
      if (activeTab === 'all') return msg.type !== MessageType.PRIVATE;
      return false;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages, activeTab, currentUser.email]);

  const handleSend = async () => {
    const receiver = selectedConversation || newMsgReceiver;
    if (!receiver || !newMsgContent.trim()) return;
    setSending(true);
    const type = receiver === 'ALL' ? 'broadcast' : 'private';
    const success = await onSendMessage(receiver, newMsgContent, type);
    setSending(false);
    if (success) {
      setNewMsgContent('');
      if (!selectedConversation) {
        setIsComposing(false);
        setNewMsgReceiver('');
        setSelectedConversation(receiver);
      }
    }
  };

  const handleOpenConversation = (email: string) => {
    setSelectedConversation(email);
    // Mark all messages in this conversation as read
    const unreadMsgs = conversations[email]?.filter(m => !m.isRead && m.receiverEmail === currentUser.email) || [];
    unreadMsgs.forEach(m => onMarkAsRead(m.id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-25 transition-opacity" onClick={onClose}></div>
      <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        <div className="w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 bg-white shadow-xl flex flex-col">
          
          {/* Header */}
          <div className="px-4 py-6 bg-blue-600 sm:px-6 flex justify-between items-center">
            <div className="flex items-center space-x-2 text-white">
              {selectedConversation ? (
                <button onClick={() => setSelectedConversation(null)} className="mr-2 hover:bg-blue-700 p-1 rounded-full transition-colors">
                  <ChevronLeft className="h-6 w-6" />
                </button>
              ) : (
                <Bell className="h-6 w-6" />
              )}
              <h2 className="text-lg font-medium">
                {selectedConversation 
                  ? (users.find(u => u.email === selectedConversation)?.name || selectedConversation)
                  : '訊息中心'}
              </h2>
            </div>
            <button onClick={onClose} className="text-blue-200 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          {!selectedConversation && (
            <>
              {/* Tabs & Actions */}
              <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex justify-between items-center">
                <div className="flex space-x-2 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: '全部' },
                    { id: 'unread', label: '未讀' },
                    { id: 'private', label: '私訊' },
                    { id: 'system', label: '系統' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                        activeTab === tab.id 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setIsComposing(!isComposing)}
                  className="ml-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-sm"
                  title="撰寫新訊息"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>

              {/* Compose Area */}
              {isComposing && (
                <div className="p-4 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top-2">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">收件者</label>
                    <select 
                      className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={newMsgReceiver}
                      onChange={(e) => setNewMsgReceiver(e.target.value)}
                    >
                      <option value="">選擇使用者...</option>
                      {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER_3D || currentUser.role === UserRole.MANAGER_DEPT) && (
                        <option value="ALL" className="font-bold text-blue-600">【全體人員】發送通告</option>
                      )}
                      {users.filter(u => u.email !== currentUser.email).map(u => (
                        <option key={u.email} value={u.email}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">內容</label>
                    <textarea
                      rows={3}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="輸入訊息內容..."
                      value={newMsgContent}
                      onChange={(e) => setNewMsgContent(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => setIsComposing(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded-md"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleSend}
                      disabled={sending || !newMsgReceiver || !newMsgContent.trim()}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
                    >
                      {sending ? '發送中...' : <><Send className="h-3 w-3 mr-1" /> 發送</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'private' ? (
                  conversationList.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>尚無對話</p>
                    </div>
                  ) : (
                    conversationList.map(conv => (
                      <div 
                        key={conv.email}
                        onClick={() => handleOpenConversation(conv.email)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md flex items-center space-x-3 ${
                          conv.unreadCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm text-gray-900 truncate">{conv.name}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(conv.lastMsg.timestamp).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.lastMsg.senderEmail === currentUser.email ? '您: ' : ''}
                            {conv.lastMsg.content}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <div className="h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                    ))
                  )
                ) : (
                  otherMessages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>沒有訊息</p>
                    </div>
                  ) : (
                    otherMessages.map(msg => (
                      <div 
                        key={msg.id} 
                        onClick={() => !msg.isRead && onMarkAsRead(msg.id)}
                        className={`relative p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                          msg.isRead ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center space-x-2">
                            <Bell className="h-4 w-4 text-orange-500" />
                            <span className="font-semibold text-sm text-gray-900">
                              {msg.type === MessageType.SYSTEM ? '系統通知' : msg.senderName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(msg.timestamp).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-sm ${msg.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                          {msg.content}
                        </p>
                        {!msg.isRead && (
                          <div className="absolute top-4 right-4 h-2 w-2 bg-red-500 rounded-full"></div>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>
            </>
          )}

          {selectedConversation && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Conversation Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {conversations[selectedConversation]?.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.senderEmail === currentUser.email ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                      msg.senderEmail === currentUser.email 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <div className={`text-[10px] mt-1 ${
                        msg.senderEmail === currentUser.email ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {new Date(msg.timestamp).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                        {msg.senderEmail === currentUser.email && (
                          <span className="ml-1">
                            {msg.isRead ? '已讀' : '未讀'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Area */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-end space-x-2">
                  <textarea
                    rows={1}
                    className="flex-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md resize-none py-2"
                    placeholder="輸入回覆..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button 
                    onClick={handleSend}
                    disabled={sending || !newMsgContent.trim()}
                    className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MessageCenter;
