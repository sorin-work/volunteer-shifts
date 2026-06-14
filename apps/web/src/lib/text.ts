const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g;

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

/**
 * Formats a plain-text description for display: web addresses become links
 * and line breaks are kept. Everything else is escaped, so the result is safe
 * to render with {@html}.
 */
export function formatDescription(text: string): string {
  return escapeHtml(text)
    .replace(
      URL_RE,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    )
    .replace(/\r?\n/g, '<br />');
}
