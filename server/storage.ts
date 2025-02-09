import { type Message, type ChatSession } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';

export interface StorageState {
  messages: Message[];
  sessions: ChatSession[];
  currentSession: string | null;
}

// In-memory storage
const state: StorageState = {
  messages: [],
  sessions: [],
  currentSession: null
};

// Session management
export function createSession(sheetId: string, sheetName: string): string {
  const sessionId = uuidv4();
  const session: ChatSession = {
    id: sessionId,
    sheetId,
    sheetName,
    created: new Date().toISOString(),
    lastMessage: new Date().toISOString()
  };
  state.sessions.push(session);
  state.currentSession = sessionId;
  return sessionId;
}

export function getSession(sessionId: string): ChatSession | undefined {
  return state.sessions.find(s => s.id === sessionId);
}

export function getSessions(): ChatSession[] {
  return state.sessions;
}

export function updateSessionLastMessage(sessionId: string) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    session.lastMessage = new Date().toISOString();
  }
}

// Message management
export function getMessages(sessionId?: string): Message[] {
  if (sessionId) {
    return state.messages.filter(m => m.metadata?.sessionId === sessionId);
  }
  return state.messages;
}

export function saveMessage(message: Message) {
  const timestamp = new Date().toISOString();
  const enhancedMessage: Message = {
    ...message,
    id: state.messages.length + 1,
    timestamp,
    metadata: message.metadata ? {
      ...message.metadata,
      timestamp
    } : null
  };
  
  state.messages.push(enhancedMessage);
  
  if (enhancedMessage.metadata?.sessionId) {
    updateSessionLastMessage(enhancedMessage.metadata.sessionId);
  }
}

export function clearMessages(sessionId?: string) {
  if (sessionId) {
    state.messages = state.messages.filter(m => m.metadata?.sessionId !== sessionId);
  } else {
    state.messages = [];
    state.sessions = [];
    state.currentSession = null;
  }
}

export function getCurrentSession(): string | null {
  return state.currentSession;
}

export function setCurrentSession(sessionId: string | null) {
  state.currentSession = sessionId;
}
