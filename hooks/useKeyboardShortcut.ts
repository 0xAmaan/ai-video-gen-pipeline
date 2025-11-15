import { useEffect } from "react";

export const useKeyboardShortcut = (
  key: string,
  callback: () => void,
  metaKey: boolean = true,
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (metaKey && modifier && event.key === key) {
        event.preventDefault();
        callback();
      } else if (!metaKey && event.key === key) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, callback, metaKey]);
};
