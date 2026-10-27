import { io } from 'socket.io-client';
import { BACKEND_URL, tokenStorage } from './api';

let socket = null;
let socketToken = null;

/**
 * Joriy token bilan yagona Socket.io ulanishini qaytaradi
 */
export function getSocket() {
  const token = tokenStorage.get();
  if (!token) return null;

  if (socket && socketToken === token) return socket;

  if (socket) socket.disconnect();
  socketToken = token;
  socket = io(BACKEND_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketToken = null;
}
