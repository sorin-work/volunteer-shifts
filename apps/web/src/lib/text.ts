const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g;

/**
 * Formats a plain-text description for display: web addresses become links
 * and line breaks are kept.
 */
export function formatDescription(text: string): string {
  return text
    .replace(
      URL_RE,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    )
    .replace(/\r?\n/g, '<br />');
}
