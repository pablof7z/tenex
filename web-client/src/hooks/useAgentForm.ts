import { useState } from 'react';
import { useNDK } from '@nostr-dev-kit/ndk-hooks';
import { NDKAgent } from '../lib/ndk-setup';

interface AgentFormData {
  title: string;
  description: string;
  role: string;
  instructions: string;
  tags: string[];
  newTag: string;
}

const initialFormData: AgentFormData = {
  title: '',
  description: '',
  role: '',
  instructions: '',
  tags: [],
  newTag: '',
};

export function useAgentForm() {
  const { ndk } = useNDK();
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const loadAgent = (agent: NDKAgent) => {
    const agentTags = agent.tags
      .filter((tag) => tag[0] === 't')
      .map((tag) => tag[1]);

    setFormData({
      title: agent.tagValue('title') || 
             agent.tagValue('name') || 
             agent.tagValue('d') || '',
      description: agent.tagValue('description') || 
                  extractDescriptionFromContent(agent.content || ''),
      role: agent.tagValue('role') || 
            extractRoleFromContent(agent.content || ''),
      instructions: agent.content || '',
      tags: agentTags,
      newTag: '',
    });
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      alert('Agent name is required');
      return false;
    }
    return true;
  };

  const saveAgent = async (selectedAgent: NDKAgent | null, isCreatingNew: boolean): Promise<boolean> => {
    if (!ndk || !validateForm()) return false;

    const newAgent = new NDKAgent(ndk);
    newAgent.content = formData.instructions;

    if (isCreatingNew) {
      // Creating a new agent
      newAgent.tags = [
        ['d', formData.title.toLowerCase().replace(/\s+/g, '-')],
        ['title', formData.title],
        ['description', formData.description],
        ['role', formData.role],
        ['ver', '1'],
        ...formData.tags.map((tag) => ['t', tag] as [string, string]),
      ];
    } else if (selectedAgent) {
      // Editing existing agent
      const currentVersion = selectedAgent.tagValue('ver') || '1';
      const newVersion = String(Number.parseInt(currentVersion) + 1);

      newAgent.tags = [
        ['d', selectedAgent.tagValue('d') || 
              formData.title.toLowerCase().replace(/\s+/g, '-')],
        ['title', formData.title],
        ['description', formData.description],
        ['role', formData.role],
        ['ver', newVersion],
        ...formData.tags.map((tag) => ['t', tag] as [string, string]),
      ];
    }

    try {
      await newAgent.publish();
      return true;
    } catch (error) {
      console.error('Failed to publish agent:', error);
      return false;
    }
  };

  const updateField = (field: string, value: string) => {
    if (!(field in formData)) return;
    setFormData((prev) => ({ ...prev, [field as keyof AgentFormData]: value }));
  };

  const addTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, prev.newTag.trim()],
        newTag: '',
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  return {
    formData,
    resetForm,
    loadAgent,
    saveAgent,
    updateField,
    addTag,
    removeTag,
  };
}

function extractDescriptionFromContent(content: string): string {
  const lines = content.split('\n');
  const descIndex = lines.findIndex((line) =>
    line.toLowerCase().includes('description')
  );
  if (descIndex >= 0 && descIndex < lines.length - 1) {
    return lines[descIndex + 1].trim();
  }
  return '';
}

function extractRoleFromContent(content: string): string {
  const lines = content.split('\n');
  const roleIndex = lines.findIndex((line) =>
    line.toLowerCase().includes('role')
  );
  if (roleIndex >= 0 && roleIndex < lines.length - 1) {
    return lines[roleIndex + 1].trim();
  }
  return '';
}