import type { NDKKind } from "@nostr-dev-kit/ndk";

/**
 * Nostr event kinds used in TENEX
 */
export const EVENT_KINDS = {
  // Standard Nostr kinds
  METADATA: 0 as NDKKind,
  CONTACT_LIST: 3 as NDKKind,

  // Chat-related
  CHAT: 11 as NDKKind,
  THREAD_REPLY: 1111 as NDKKind,
  GENERIC_REPLY: 1111 as NDKKind,

  // TENEX-specific kinds
  TASK: 1934 as NDKKind,
  AGENT_REQUEST: 3199 as NDKKind,
  AGENT_REQUEST_LIST: 13199 as NDKKind, // List of agent requests (10000 + 3199)
  AGENT_LESSON: 4129 as NDKKind,
  AGENT_CONFIG: 4199 as NDKKind,

  // Status and typing
  PROJECT_STATUS: 24010 as NDKKind,
  LLM_CONFIG_CHANGE: 24101 as NDKKind,
  TYPING_INDICATOR: 24111 as NDKKind,
  TYPING_INDICATOR_STOP: 24112 as NDKKind,

  // Addressable events
  ARTICLE: 30023 as NDKKind,
  TEMPLATE: 30717 as NDKKind,
  PROJECT: 31933 as NDKKind,
} as const;

export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];

/**
 * LLM Configuration types
 */
export interface LLMConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export interface LLMFileConfiguration {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

/**
 * Backend and Profile types
 */
export interface BackendInfo {
  pubkey: string;
  name?: string;
  description?: string;
  avatar?: string;
  hostname?: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen?: number;
  capabilities?: string[];
  projects: Array<{ name: string; [key: string]: any }>;
  metadata?: Record<string, any>;
}

export interface ProfileData {
  pubkey: string;
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  [key: string]: any;
}

/**
 * Utility functions
 */
export const StringUtils = {
  truncate: (str: string, length: number) => {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
  },
  
  capitalize: (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  slugify: (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
};

export const TaskUtils = {
  getStatusColor: (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in-progress': return 'blue';
      case 'failed': return 'red';
      default: return 'gray';
    }
  }
};

/**
 * Backend status parsing utilities
 */
export function parseBackendStatusEvent(event: any): BackendInfo | null {
  try {
    const content = JSON.parse(event.content);
    return {
      pubkey: event.pubkey,
      name: content.name,
      description: content.description,
      avatar: content.avatar,
      status: content.status || 'online',
      lastSeen: event.created_at * 1000,
      capabilities: content.capabilities || [],
      projects: content.projects || [],
      metadata: content.metadata || {}
    };
  } catch {
    return null;
  }
}

export function migrateBackendStatus(status: any): BackendInfo {
  return {
    pubkey: status.pubkey,
    name: status.name,
    description: status.description,
    avatar: status.avatar,
    status: status.status || 'online',
    lastSeen: status.lastSeen,
    capabilities: status.capabilities || [],
    projects: status.projects || [],
    metadata: status.metadata || {}
  };
}

export function createBackendInfo(pubkey: string, data: Partial<BackendInfo> = {}): BackendInfo {
  return {
    pubkey,
    status: 'offline',
    projects: [],
    ...data
  };
}

interface OllamaModel {
  name: string;
  [key: string]: any;
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

export function isOllamaModelsResponse(response: any): response is OllamaModelsResponse {
  return response && Array.isArray(response.models);
}