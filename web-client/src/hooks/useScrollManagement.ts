import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollManagement(messageCount: number) {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Check if user is at the very bottom of scroll
  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    // Consider "at bottom" if within 5px of the bottom (to account for rounding)
    const threshold = 5;
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    return isNear;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);

    // Hide new message indicator if user scrolls to bottom
    if (nearBottom && showNewMessageIndicator) {
      setShowNewMessageIndicator(false);
    }
  }, [checkIfNearBottom, showNewMessageIndicator]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((force = false) => {
    // Only scroll if user is near bottom or if forced
    if (!force && !isNearBottom) return;

    // Try multiple methods to ensure scrolling works in all contexts
    if (messagesEndRef.current) {
      // Method 1: scrollIntoView on the anchor element
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }

    // Method 2: Also try to scroll the container itself
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isNearBottom]);

  // Track new messages and manage auto-scroll
  useEffect(() => {
    // Only handle if we have new messages
    if (messageCount > prevMessageCountRef.current) {
      // Check if user is near bottom before new messages
      const nearBottom = checkIfNearBottom();

      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        if (nearBottom) {
          // User was near bottom, auto-scroll
          scrollToBottom(true);
        } else {
          // User was scrolled up, show indicator
          setShowNewMessageIndicator(true);
        }
      }, 100);
      prevMessageCountRef.current = messageCount;
      return () => clearTimeout(timer);
    }
  }, [messageCount, scrollToBottom, checkIfNearBottom]);

  // Scroll on initial load when messages first appear
  useEffect(() => {
    if (messageCount > 0) {
      // Delay to ensure any animations have completed
      const timer = setTimeout(() => {
        scrollToBottom(true); // Force scroll on initial load
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [messageCount > 0, scrollToBottom]);

  return {
    messagesEndRef,
    messagesContainerRef,
    isNearBottom,
    showNewMessageIndicator,
    handleScroll,
    scrollToBottom,
    setShowNewMessageIndicator,
  };
}