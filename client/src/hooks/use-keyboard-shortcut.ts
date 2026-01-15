import { useEffect, useCallback } from "react"

type KeyModifier = "ctrl" | "meta" | "alt" | "shift"

interface KeyboardShortcutOptions {
  key: string
  modifiers?: KeyModifier[]
  callback: () => void
  enabled?: boolean
  preventDefault?: boolean
  ignoreInputs?: boolean
}

export function useKeyboardShortcut({
  key,
  modifiers = [],
  callback,
  enabled = true,
  preventDefault = true,
  ignoreInputs = true,
}: KeyboardShortcutOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (ignoreInputs && isInputField) return

      const modifiersMatch =
        (modifiers.includes("ctrl") ? e.ctrlKey : !e.ctrlKey || modifiers.length === 0) &&
        (modifiers.includes("meta") ? e.metaKey : !e.metaKey || modifiers.length === 0) &&
        (modifiers.includes("alt") ? e.altKey : !e.altKey) &&
        (modifiers.includes("shift") ? e.shiftKey : !e.shiftKey)

      const cmdOrCtrl = modifiers.includes("meta") || modifiers.includes("ctrl")
      const cmdOrCtrlMatch = cmdOrCtrl ? e.metaKey || e.ctrlKey : true

      if (e.key.toLowerCase() === key.toLowerCase() && (modifiersMatch || cmdOrCtrlMatch)) {
        if (preventDefault) {
          e.preventDefault()
        }
        callback()
      }
    },
    [key, modifiers, callback, enabled, preventDefault, ignoreInputs]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

export function useEscapeKey(callback: () => void, enabled = true) {
  useKeyboardShortcut({
    key: "Escape",
    callback,
    enabled,
    ignoreInputs: false,
  })
}

export function useSlashSearch(callback: () => void, enabled = true) {
  useKeyboardShortcut({
    key: "/",
    callback,
    enabled,
    ignoreInputs: true,
  })
}

export function useCommandK(callback: () => void, enabled = true) {
  useKeyboardShortcut({
    key: "k",
    modifiers: ["meta"],
    callback,
    enabled,
    ignoreInputs: false,
  })
}
