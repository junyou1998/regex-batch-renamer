import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Links open through the app's external-link handler, never inside the webview.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Render untrusted Markdown (AI replies, plugin READMEs, release notes) to
 * sanitized HTML that is safe to bind with v-html.
 */
export function renderSafeMarkdown(markdown: string | null | undefined, options: { breaks?: boolean } = {}): string {
  const html = marked.parse(markdown || '', { breaks: options.breaks ?? true, gfm: true, async: false }) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  })
}
