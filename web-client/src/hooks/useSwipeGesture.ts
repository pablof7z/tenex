import { useCallback, useRef, useState } from "react";

interface SwipeGestureOptions {
  thresholds: {
    delete: number;
    archive: number;
    more: number;
  };
  maxSwipeDistance: number;
  onDelete?: () => void;
  onArchive?: () => void;
  onMore?: () => void;
}

export function useSwipeGesture({
  thresholds = { delete: 60, archive: 100, more: 140 },
  maxSwipeDistance = 180,
  onDelete,
  onArchive,
  onMore,
}: SwipeGestureOptions) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isActionTriggered, setIsActionTriggered] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const handleSwipeAction = useCallback(
    (action: "delete" | "archive" | "more") => {
      switch (action) {
        case "delete":
          onDelete?.();
          break;
        case "archive":
          onArchive?.();
          break;
        case "more":
          onMore?.();
          break;
      }
    },
    [onDelete, onArchive, onMore]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    isDragging.current = true;
    setIsActionTriggered(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;

      currentX.current = e.touches[0].clientX;
      const deltaX = currentX.current - startX.current;

      // Only allow left swipe (positive deltaX)
      if (deltaX > 0) {
        const clampedOffset = Math.min(deltaX, maxSwipeDistance);
        setSwipeOffset(clampedOffset);

        // Trigger haptic feedback at different thresholds
        if (clampedOffset >= thresholds.delete && !isActionTriggered) {
          setIsActionTriggered(true);
          // Add haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else if (clampedOffset < thresholds.delete && isActionTriggered) {
          setIsActionTriggered(false);
        }

        // Additional feedback at higher thresholds
        if (clampedOffset >= thresholds.archive && navigator.vibrate) {
          navigator.vibrate(5);
        }
      }
    },
    [isActionTriggered, maxSwipeDistance, thresholds]
  );

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;

    if (swipeOffset >= thresholds.more) {
      handleSwipeAction("more");
    } else if (swipeOffset >= thresholds.archive) {
      handleSwipeAction("archive");
    } else if (swipeOffset >= thresholds.delete) {
      handleSwipeAction("delete");
    }

    // Reset swipe
    setSwipeOffset(0);
    setIsActionTriggered(false);
  }, [swipeOffset, thresholds, handleSwipeAction]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      startX.current = e.clientX;
      currentX.current = e.clientX;
      isDragging.current = true;
      setIsActionTriggered(false);

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;

        currentX.current = e.clientX;
        const deltaX = currentX.current - startX.current;

        if (deltaX > 0) {
          const clampedOffset = Math.min(deltaX, maxSwipeDistance);
          setSwipeOffset(clampedOffset);

          if (clampedOffset >= thresholds.delete && !isActionTriggered) {
            setIsActionTriggered(true);
          } else if (clampedOffset < thresholds.delete && isActionTriggered) {
            setIsActionTriggered(false);
          }
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;

        if (swipeOffset >= thresholds.more) {
          handleSwipeAction("more");
        } else if (swipeOffset >= thresholds.archive) {
          handleSwipeAction("archive");
        } else if (swipeOffset >= thresholds.delete) {
          handleSwipeAction("delete");
        }

        setSwipeOffset(0);
        setIsActionTriggered(false);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isActionTriggered, maxSwipeDistance, thresholds, swipeOffset, handleSwipeAction]
  );

  return {
    swipeOffset,
    isActionTriggered,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
    },
  };
}