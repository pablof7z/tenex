import { useCallback, useRef, useState } from "react";
import type { ProjectAgent } from "./useProjectAgents";

export function useMentionAutocomplete(
  projectAgents: ProjectAgent[],
  messageInput: string,
  setMessageInput: (value: string) => void
) {
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter agents based on mention search
  const filteredAgents = mentionSearch
    ? projectAgents.filter((agent) =>
        agent.name.toLowerCase().includes(mentionSearch.toLowerCase())
      )
    : projectAgents;

  // Handle @mention autocomplete
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageInput(value);

      // Check for @ symbol
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
        // Just typed @
        setShowAgentMenu(true);
        setMentionSearch("");
        setSelectedAgentIndex(0);
      } else if (
        lastAtIndex !== -1 &&
        textBeforeCursor.substring(lastAtIndex + 1).match(/^\w+$/)
      ) {
        // Typing after @
        const search = textBeforeCursor.substring(lastAtIndex + 1);
        setMentionSearch(search);
        setShowAgentMenu(true);
        setSelectedAgentIndex(0);
      } else {
        setShowAgentMenu(false);
      }
    },
    [setMessageInput]
  );

  // Insert agent mention
  const insertMention = useCallback(
    (agent: ProjectAgent) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = messageInput.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const beforeMention = messageInput.slice(0, lastAtIndex);
        const afterCursor = messageInput.slice(cursorPosition);
        const newValue = `${beforeMention}@${agent.name} ${afterCursor}`;
        setMessageInput(newValue);

        // Set cursor position after the mention
        setTimeout(() => {
          const newCursorPos = lastAtIndex + agent.name.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }

      setShowAgentMenu(false);
      setMentionSearch("");
    },
    [messageInput, setMessageInput]
  );

  // Handle keyboard navigation in mention menu
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAgentMenu && filteredAgents.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedAgentIndex((prev) =>
            prev < filteredAgents.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedAgentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (filteredAgents[selectedAgentIndex]) {
            insertMention(filteredAgents[selectedAgentIndex]);
          }
          return true; // Consumed the enter key
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowAgentMenu(false);
        }
      }
      return false; // Did not consume the key
    },
    [showAgentMenu, filteredAgents, selectedAgentIndex, insertMention]
  );

  // Extract mentions from message and return cleaned content with mentioned agents
  const extractMentions = useCallback(
    (content: string): { cleanContent: string; mentionedAgents: ProjectAgent[] } => {
      const mentionRegex = /@(\w+)/g;
      const mentionedAgents: ProjectAgent[] = [];
      const cleanContent = content;

      // Find all @mentions in the content
      const matches = content.matchAll(mentionRegex);
      for (const match of matches) {
        const mentionName = match[1];
        const agent = projectAgents.find(
          (a) => a.name.toLowerCase() === mentionName.toLowerCase()
        );
        if (agent && !mentionedAgents.some((a) => a.pubkey === agent.pubkey)) {
          mentionedAgents.push(agent);
        }
      }

      return { cleanContent, mentionedAgents };
    },
    [projectAgents]
  );

  return {
    textareaRef,
    showAgentMenu,
    filteredAgents,
    selectedAgentIndex,
    handleInputChange,
    handleKeyDown,
    insertMention,
    extractMentions,
  };
}