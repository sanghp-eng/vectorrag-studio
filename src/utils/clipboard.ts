/**
 * Robust Cross-Browser Clipboard Helper
 * Supports iframe sandboxes, permissions-policy blocks, and fallback mechanisms
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text && text !== '') {
    return false;
  }

  // Strategy 1: Modern navigator.clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting fallback...', err);
    }
  }

  // Strategy 2: Hidden textarea with document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Ensure textarea is not visible but part of DOM and focusable
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0.01';
    textArea.style.zIndex = '-9999';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    
    // Selection handling
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    }
  } catch (err) {
    console.warn('document.execCommand fallback failed:', err);
  }

  // Strategy 3: Prompt dialog fallback as absolute last resort
  try {
    if (typeof window !== 'undefined') {
      window.prompt('Sao chép vào bộ nhớ tạm: Nhấn Ctrl+C / Cmd+C rồi nhấn Enter', text);
      return true;
    }
  } catch (e) {
    console.error('All copy strategies failed:', e);
  }

  return false;
}
