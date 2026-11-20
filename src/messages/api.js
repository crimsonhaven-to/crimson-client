import { apiJson } from '../api/client';

const enc = encodeURIComponent;

function query(params) {
  const defined = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  return new URLSearchParams(defined).toString();
}

export const messagesApi = {
  rooms: () => apiJson('/messages/rooms').then((d) => d.rooms),
  openDirect: (handle) => apiJson('/messages/direct', { json: { handle } }),
  createGroup: (name, handles) => apiJson('/messages/groups', { json: { name, handles } }),
  rename: (roomId, name) => apiJson(`/messages/rooms/${roomId}`, { method: 'PATCH', json: { name } }),
  addMembers: (roomId, handles) => apiJson(`/messages/rooms/${roomId}/members`, { json: { handles } }),
  leave: (roomId) => apiJson(`/messages/rooms/${roomId}/membership`, { method: 'DELETE' }),
  messages: (roomId, params = {}) =>
    apiJson(`/messages/rooms/${roomId}/messages?${query(params)}`).then((d) => d.messages),
  send: (roomId, body, attachment = null) =>
    apiJson(`/messages/rooms/${roomId}/messages`, { json: { body, attachment } }),
  markRead: (roomId, lastId) => apiJson(`/messages/rooms/${roomId}/read`, { json: { last_id: lastId } }),
  unread: () => apiJson('/messages/unread').then((d) => d.count),
  findMember: (handle) => apiJson(`/messages/members/${enc(handle)}`),
  block: (handle) => apiJson(`/messages/blocks/${enc(handle)}`, { method: 'PUT' }),
  unblock: (handle) => apiJson(`/messages/blocks/${enc(handle)}`, { method: 'DELETE' }),
  setHandle: (handle) => apiJson('/account/handle', { method: 'PUT', json: { handle } }),
};
