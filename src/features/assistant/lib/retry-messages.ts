/** Drop the last user turn and anything after it so retry can re-append the prompt. */
export function dropLastUserTurn<T extends { role: string }>(messages: T[]): T[] {
  const lastUserIndex = messages.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) return messages;
  return messages.slice(0, lastUserIndex);
}
