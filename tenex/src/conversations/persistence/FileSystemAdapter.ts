import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@tenex/shared';
import { ensureDirectory, fileExists, readJsonFile, writeJsonFile } from '@tenex/shared/fs';
import type { ConversationState } from '../types';
import type { 
  ConversationPersistenceAdapter, 
  ConversationMetadata, 
  ConversationSearchCriteria 
} from './types';

export class FileSystemAdapter implements ConversationPersistenceAdapter {
  private conversationsDir: string;
  private metadataPath: string;
  private archiveDir: string;

  constructor(projectPath: string) {
    this.conversationsDir = path.join(projectPath, '.tenex', 'conversations');
    this.metadataPath = path.join(this.conversationsDir, 'metadata.json');
    this.archiveDir = path.join(this.conversationsDir, 'archive');
  }

  async initialize(): Promise<void> {
    await ensureDirectory(this.conversationsDir);
    await ensureDirectory(this.archiveDir);
    
    // Initialize metadata file if it doesn't exist
    if (!(await fileExists(this.metadataPath))) {
      await writeJsonFile(this.metadataPath, { conversations: [] });
    }
  }

  async save(conversation: ConversationState): Promise<void> {
    try {
      const filePath = this.getConversationPath(conversation.id);
      
      // Serialize NDKEvents to a storable format
      const serialized = {
        ...conversation,
        history: conversation.history.map(event => ({
          id: event.id,
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          pubkey: event.pubkey,
          created_at: event.created_at,
          sig: event.sig
        }))
      };
      
      await writeJsonFile(filePath, serialized);
      
      // Update metadata
      await this.updateMetadata(conversation);
      
      logger.info('Conversation saved', { 
        id: conversation.id, 
        title: conversation.title 
      });
    } catch (error) {
      logger.error('Failed to save conversation', { error, id: conversation.id });
      throw error;
    }
  }

  async load(conversationId: string): Promise<ConversationState | null> {
    try {
      const filePath = this.getConversationPath(conversationId);
      
      if (!(await fileExists(filePath))) {
        // Check archive
        const archivePath = this.getArchivePath(conversationId);
        if (!(await fileExists(archivePath))) {
          return null;
        }
      }
      
      const data = await readJsonFile(filePath);
      
      // Reconstruct NDKEvents
      // Note: These won't be full NDKEvent instances, but contain the essential data
      const conversation: ConversationState = {
        ...data,
        history: data.history // Keep serialized format for now
      };
      
      logger.info('Conversation loaded', { id: conversationId });
      return conversation;
    } catch (error) {
      logger.error('Failed to load conversation', { error, id: conversationId });
      return null;
    }
  }

  async delete(conversationId: string): Promise<void> {
    try {
      const filePath = this.getConversationPath(conversationId);
      
      if (await fileExists(filePath)) {
        await fs.unlink(filePath);
      }
      
      // Remove from metadata
      await this.removeFromMetadata(conversationId);
      
      logger.info('Conversation deleted', { id: conversationId });
    } catch (error) {
      logger.error('Failed to delete conversation', { error, id: conversationId });
      throw error;
    }
  }

  async list(): Promise<ConversationMetadata[]> {
    try {
      const metadata = await this.loadMetadata();
      return metadata.conversations;
    } catch (error) {
      logger.error('Failed to list conversations', { error });
      return [];
    }
  }

  async search(criteria: ConversationSearchCriteria): Promise<ConversationMetadata[]> {
    const allMetadata = await this.list();
    
    return allMetadata.filter(meta => {
      if (criteria.title && !meta.title.toLowerCase().includes(criteria.title.toLowerCase())) {
        return false;
      }
      
      if (criteria.phase && meta.phase !== criteria.phase) {
        return false;
      }
      
      if (criteria.dateFrom && meta.createdAt < criteria.dateFrom) {
        return false;
      }
      
      if (criteria.dateTo && meta.createdAt > criteria.dateTo) {
        return false;
      }
      
      if (criteria.archived !== undefined && meta.archived !== criteria.archived) {
        return false;
      }
      
      return true;
    });
  }

  async archive(conversationId: string): Promise<void> {
    try {
      const sourcePath = this.getConversationPath(conversationId);
      const destPath = this.getArchivePath(conversationId);
      
      if (await fileExists(sourcePath)) {
        await fs.rename(sourcePath, destPath);
      }
      
      // Update metadata
      const metadata = await this.loadMetadata();
      const conv = metadata.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.archived = true;
        await this.saveMetadata(metadata);
      }
      
      logger.info('Conversation archived', { id: conversationId });
    } catch (error) {
      logger.error('Failed to archive conversation', { error, id: conversationId });
      throw error;
    }
  }

  async restore(conversationId: string): Promise<void> {
    try {
      const sourcePath = this.getArchivePath(conversationId);
      const destPath = this.getConversationPath(conversationId);
      
      if (await fileExists(sourcePath)) {
        await fs.rename(sourcePath, destPath);
      }
      
      // Update metadata
      const metadata = await this.loadMetadata();
      const conv = metadata.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.archived = false;
        await this.saveMetadata(metadata);
      }
      
      logger.info('Conversation restored', { id: conversationId });
    } catch (error) {
      logger.error('Failed to restore conversation', { error, id: conversationId });
      throw error;
    }
  }

  private getConversationPath(conversationId: string): string {
    return path.join(this.conversationsDir, `${conversationId}.json`);
  }

  private getArchivePath(conversationId: string): string {
    return path.join(this.archiveDir, `${conversationId}.json`);
  }

  private async loadMetadata(): Promise<{ conversations: ConversationMetadata[] }> {
    try {
      return await readJsonFile(this.metadataPath);
    } catch {
      return { conversations: [] };
    }
  }

  private async saveMetadata(metadata: { conversations: ConversationMetadata[] }): Promise<void> {
    await writeJsonFile(this.metadataPath, metadata);
  }

  private async updateMetadata(conversation: ConversationState): Promise<void> {
    const metadata = await this.loadMetadata();
    
    const existing = metadata.conversations.findIndex(c => c.id === conversation.id);
    const meta: ConversationMetadata = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.history[0]?.created_at || Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      phase: conversation.phase,
      eventCount: conversation.history.length,
      agentCount: new Set(conversation.history.map(e => e.pubkey)).size,
      archived: false
    };
    
    if (existing >= 0) {
      metadata.conversations[existing] = meta;
    } else {
      metadata.conversations.push(meta);
    }
    
    await this.saveMetadata(metadata);
  }

  private async removeFromMetadata(conversationId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata.conversations = metadata.conversations.filter(c => c.id !== conversationId);
    await this.saveMetadata(metadata);
  }
}