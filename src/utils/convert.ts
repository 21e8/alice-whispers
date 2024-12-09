import { Message } from '../types';

export const msgToMsgObject = (msg: Message) => {
  const [chatId, text, level, error] = msg;
  return { chatId, text, level, error };
};
export const msgToMsgsObjects = (msgs: Message[]) => {
  return msgs.map(msgToMsgObject);
};
