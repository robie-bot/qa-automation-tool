import { useEffect, useCallback } from 'react';

interface ShortcutActions {
  onNextIssue?: () => void;
  onPrevIssue?: () => void;
  onToggleScreenshot?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onFilterErrors?: () => void;
  onFilterWarnings?: () => void;
  onFilterAll?: () => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  onToggleDarkMode?: () => void;
}

export default function useKeyboardShortcuts(actions: ShortcutActions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // j/k — next/prev issue
      if (key === 'j' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onNextIssue?.();
        return;
      }
      if (key === 'k' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onPrevIssue?.();
        return;
      }

      // s — toggle screenshot
      if (key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onToggleScreenshot?.();
        return;
      }

      // e — expand all screenshots
      if (key === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onExpandAll?.();
        return;
      }

      // c — collapse all screenshots
      if (key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onCollapseAll?.();
        return;
      }

      // 1/2/3 — filter severity
      if (key === '1' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onFilterErrors?.();
        return;
      }
      if (key === '2' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onFilterWarnings?.();
        return;
      }
      if (key === '0' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onFilterAll?.();
        return;
      }

      // d — toggle dark mode
      if (key === 'd' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actions.onToggleDarkMode?.();
        return;
      }
    },
    [actions]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/** Keyboard shortcut info for help display */
export const SHORTCUTS = [
  { key: 'j', description: 'Next issue' },
  { key: 'k', description: 'Previous issue' },
  { key: 's', description: 'Toggle screenshot' },
  { key: 'e', description: 'Expand all screenshots' },
  { key: 'c', description: 'Collapse all screenshots' },
  { key: '1', description: 'Show errors only' },
  { key: '2', description: 'Show warnings only' },
  { key: '0', description: 'Show all issues' },
  { key: 'd', description: 'Toggle dark mode' },
];
