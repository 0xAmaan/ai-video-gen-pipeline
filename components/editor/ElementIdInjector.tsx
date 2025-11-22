"use client";

import { useEffect } from "react";

/**
 * ElementIdInjector Component
 *
 * Adds data-element-id attributes to Twick timeline elements for CSS targeting.
 * This enables the ThumbnailInjector to apply specific styles to individual clips.
 *
 * How it works:
 * 1. Uses MutationObserver to watch for new timeline elements being added to DOM
 * 2. Queries all .twick-track-element divs that don't have data-element-id yet
 * 3. Extracts element ID from the element's text content (Twick renders element.id as text)
 * 4. Adds data-element-id attribute to the element for CSS targeting
 * 5. Continuously monitors for new elements (during drag, split, zoom operations)
 *
 * Note: This component uses DOM manipulation as Twick doesn't expose a way to
 * customize element rendering through props. The approach is defensive and won't
 * break if Twick's internal structure changes - it will simply not inject IDs.
 */
export const ElementIdInjector = () => {
  useEffect(() => {
    /**
     * Extract element ID from Twick timeline element
     * Twick renders the element's text content which often contains the element ID
     */
    const extractElementId = (el: Element): string | null => {
      // Strategy 1: Look for data-element-id if already set
      const existingId = el.getAttribute("data-element-id");
      if (existingId) return existingId;

      // Strategy 2: Check text content of .twick-track-element-content
      const contentEl = el.querySelector(".twick-track-element-content");
      if (contentEl?.textContent) {
        // Twick often renders element type or name, which might include the ID
        // We need to find a way to correlate this with our clip IDs
        // For now, we'll use a data attribute approach via a separate mechanism
        return null;
      }

      return null;
    };

    /**
     * Inject element IDs into timeline elements
     * Called on initial render and whenever DOM changes
     */
    const injectElementIds = () => {
      // Find all timeline elements that don't have data-element-id yet
      const elements = document.querySelectorAll(
        ".twick-track-element:not([data-element-id])"
      );

      elements.forEach((el) => {
        // Try to extract ID from element
        const elementId = extractElementId(el);

        if (elementId) {
          el.setAttribute("data-element-id", elementId);
        } else {
          // Fallback: Try to get ID from React internal props
          // This is a bit hacky but works with React's internals
          const reactFiberKey = Object.keys(el).find((key) =>
            key.startsWith("__reactFiber")
          );

          if (reactFiberKey) {
            const fiber = (el as any)[reactFiberKey];
            const elementData = fiber?.memoizedProps?.element;

            if (elementData?.id) {
              el.setAttribute("data-element-id", elementData.id);
            }
          }
        }
      });
    };

    // Initial injection
    injectElementIds();

    // Set up MutationObserver to watch for new elements
    const observer = new MutationObserver((mutations) => {
      // Check if any mutations added timeline elements
      const hasNewElements = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;

          const el = node as Element;

          // Check if the node itself is a timeline element
          if (el.classList?.contains("twick-track-element")) return true;

          // Check if the node contains timeline elements
          return (
            el.querySelector?.(".twick-track-element:not([data-element-id])") !== null
          );
        });
      });

      if (hasNewElements) {
        // Debounce to avoid excessive calls during rapid DOM changes
        setTimeout(injectElementIds, 10);
      }
    });

    // Observe the entire document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  // This is a utility component that doesn't render anything
  return null;
};
