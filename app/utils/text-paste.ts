/** Normalize clipboard text without changing intentionally typed formatting. */
export function cleanPastedText(value: string) {
  return value.replace(/[\u0000-\u0008\u000E-\u001F\u007F\u00AD\u200B\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim()
}

export function cleanTextPaste(event: ClipboardEvent) {
  const field = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = event.clipboardData?.getData('text/plain')
  if (value === undefined || field.selectionStart === null || field.selectionEnd === null) return
  event.preventDefault()
  const start = field.selectionStart, end = field.selectionEnd
  let text = cleanPastedText(value)
  // Preserve a separator when pasting a paragraph boundary into existing text.
  if (text && start > 0 && /^\s/.test(value) && !/\s$/.test(field.value.slice(0, start))) text = ' ' + text
  if (text && end < field.value.length && /\s$/.test(value) && !/^\s/.test(field.value.slice(end))) text += ' '
  field.setRangeText(text, start, end, 'end')
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: text }))
}
