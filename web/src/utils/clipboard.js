/**
 * Copy text to clipboard with fallback for non-HTTPS contexts.
 * navigator.clipboard.writeText() requires Secure Context (HTTPS/localhost).
 * This falls back to the legacy execCommand('copy') for plain HTTP.
 */
export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback: create a temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Copy failed:', err);
    }
    document.body.removeChild(textarea);
    return Promise.resolve();
}
