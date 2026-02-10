import { useEffect } from 'react'

interface KeyboardShortcutsProps {
  onSearchFocus?: () => void
  onAddBlop: () => void
  onAutoArrange: () => void
  onToggleGrid: () => void
  onResetView: () => void
  onRefresh: () => void
  selectedBlop: string | null
  onDeleteSelected: () => void
  onClearSelection: () => void
  onClearSearch: () => void
}

export const useKeyboardShortcuts = ({
  onSearchFocus,
  onAddBlop,
  onAutoArrange,
  onToggleGrid,
  onResetView,
  onRefresh,
  selectedBlop,
  onDeleteSelected,
  onClearSelection,
  onClearSearch,
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'f':
            e.preventDefault()
            onSearchFocus?.()
            break
          case 'n':
            e.preventDefault()
            onAddBlop()
            break
          case 'a':
            e.preventDefault()
            onAutoArrange()
            break
          case 'g':
            e.preventDefault()
            onToggleGrid()
            break
          case '0':
            e.preventDefault()
            onResetView()
            break
          case 'r':
            e.preventDefault()
            onRefresh()
            break
          default:
            break
        }
      } else {
        switch (e.key) {
          case 'Escape':
            onClearSelection()
            onClearSearch()
            break
          case 'Delete':
          case 'Backspace':
            if (selectedBlop) {
              e.preventDefault()
              onDeleteSelected()
            }
            break
          default:
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onSearchFocus,
    onAddBlop,
    onAutoArrange,
    onToggleGrid,
    onResetView,
    onRefresh,
    selectedBlop,
    onDeleteSelected,
    onClearSelection,
    onClearSearch,
  ])
}