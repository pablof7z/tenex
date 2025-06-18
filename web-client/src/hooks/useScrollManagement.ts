import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollManagement(messageCount: number) {
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const prevMessageCountRef = useRef(0);
    const scrollTimeoutRef = useRef<number | undefined>(undefined);
    const lastScrollTopRef = useRef(0);
    const userScrollingRef = useRef(false);
    const lastUserScrollTimeRef = useRef(0);

    // Check if user is at the very bottom of scroll
    const checkIfNearBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;

        // Consider "at bottom" if within 100px of the bottom (more forgiving)
        const threshold = 100;
        const isNear =
            container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        return isNear;
    }, []);

    // Handle scroll events with debouncing and user intent detection
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const currentScrollTop = container.scrollTop;
        const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current);
        
        // Detect if user is actively scrolling (large delta or scrolling up)
        if (scrollDelta > 10 || currentScrollTop < lastScrollTopRef.current) {
            userScrollingRef.current = true;
            lastUserScrollTimeRef.current = Date.now();
        }
        
        lastScrollTopRef.current = currentScrollTop;

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
            cancelAnimationFrame(scrollTimeoutRef.current);
        }

        // Debounce the scroll state update
        scrollTimeoutRef.current = requestAnimationFrame(() => {
            const nearBottom = checkIfNearBottom();
            
            // If user hasn't scrolled for 1.5 seconds, consider them done scrolling
            if (Date.now() - lastUserScrollTimeRef.current > 1500) {
                userScrollingRef.current = false;
            }
            
            setIsNearBottom(nearBottom);

            // Hide new message indicator if user scrolls to bottom
            if (nearBottom && showNewMessageIndicator) {
                setShowNewMessageIndicator(false);
            }
        });
    }, [checkIfNearBottom, showNewMessageIndicator]);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(
        (force = false) => {
            // Don't auto-scroll if user is actively scrolling
            if (!force && userScrollingRef.current) return;
            
            // Only scroll if user is near bottom or if forced
            if (!force && !isNearBottom) return;

            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                const container = messagesContainerRef.current;
                if (container) {
                    // Use instant scrolling to avoid jumpy behavior
                    container.scrollTop = container.scrollHeight;
                    // Reset user scrolling flag after programmatic scroll
                    userScrollingRef.current = false;
                }
            });
        },
        [isNearBottom]
    );

    // Track new messages and manage auto-scroll
    useEffect(() => {
        // Only handle if we have new messages
        if (messageCount > prevMessageCountRef.current) {
            // Don't do anything if user is actively scrolling
            if (userScrollingRef.current) {
                setShowNewMessageIndicator(true);
                prevMessageCountRef.current = messageCount;
                return;
            }
            
            // Check if user is near bottom before new messages
            const nearBottom = checkIfNearBottom();

            // Use requestAnimationFrame instead of setTimeout for smoother updates
            requestAnimationFrame(() => {
                if (nearBottom && !userScrollingRef.current) {
                    // User was near bottom and not scrolling, auto-scroll
                    scrollToBottom(true);
                } else {
                    // User was scrolled up or actively scrolling, show indicator
                    setShowNewMessageIndicator(true);
                }
            });
            prevMessageCountRef.current = messageCount;
        }
    }, [messageCount, scrollToBottom, checkIfNearBottom]);

    // Scroll on initial load when messages first appear
    useEffect(() => {
        if (messageCount > 0 && prevMessageCountRef.current === 0) {
            // Use requestAnimationFrame for initial scroll
            requestAnimationFrame(() => {
                scrollToBottom(true); // Force scroll on initial load
                // Reset user scrolling flag on initial load
                userScrollingRef.current = false;
            });
        }
    }, [messageCount, scrollToBottom]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                cancelAnimationFrame(scrollTimeoutRef.current);
            }
        };
    }, []);

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
