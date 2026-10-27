import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, WifiOff } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { formatDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';

/**
 * Buyurtma bo'yicha real-time chat (Socket.io)
 */
export default function OrderChat({ orderId, initialMessages = [], disabled, onOrderUpdated }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const onUpdatedRef = useRef(onOrderUpdated);
  onUpdatedRef.current = onOrderUpdated;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const join = () => {
      setConnected(true);
      socket.emit('join_order_chat', { order_id: orderId });
    };
    const onHistory = (payload) => {
      if (payload.order_id === orderId) setMessages(payload.messages);
    };
    const onMessage = (message) => {
      if (message.order_id !== orderId) return;
      setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
    };
    const onUpdated = (payload) => {
      if (payload.order_id === orderId) onUpdatedRef.current?.(payload);
    };
    const onChatError = (payload) => setError(payload.message);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    socket.on('chat_history', onHistory);
    socket.on('new_message', onMessage);
    socket.on('order_updated', onUpdated);
    socket.on('chat_error', onChatError);
    if (socket.connected) join();

    return () => {
      socket.emit('leave_order_chat', { order_id: orderId });
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.off('chat_history', onHistory);
      socket.off('new_message', onMessage);
      socket.off('order_updated', onUpdated);
      socket.off('chat_error', onChatError);
    };
  }, [orderId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    const socket = getSocket();
    if (!trimmed || !socket) return;
    setError('');
    socket.emit('send_message', { order_id: orderId, text: trimmed });
    setText('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[480px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-blue-600" /> Chat
        </h3>
        <span className={`text-[11px] font-semibold inline-flex items-center gap-1 ${connected ? 'text-emerald-600' : 'text-slate-400'}`}>
          {connected ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Onlayn' : 'Ulanmoqda...'}
        </span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-10">Hali xabarlar yo'q. Birinchi bo'lib yozing!</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
              }`}>
                {!mine && <p className="text-[10px] font-bold text-blue-600 mb-0.5">{m.sender_name || 'Foydalanuvchi'}</p>}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`text-[10px] mt-1 text-right ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                  {formatDate(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 py-1.5 text-[11px] text-red-600 bg-red-50">{error}</p>}

      <form onSubmit={send} className="p-3 border-t border-slate-100 flex gap-2">
        <input
          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm disabled:opacity-60"
          placeholder={disabled ? 'Chat yopilgan' : 'Xabar yozing...'}
          maxLength={2000}
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim() || !connected}
          className="px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          aria-label="Yuborish"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
