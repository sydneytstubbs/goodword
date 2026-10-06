// Copy text to the clipboard (DS 4.2.7). The Clipboard API first; where it's
// missing or refused (in-app browsers such as Messages, Gmail, or Instagram
// previews, and some iOS cases), fall back to selecting a hidden field and
// copying it, which iOS Safari still allows during a tap. Must be called
// from the tap itself. Resolves to whether the text was copied.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older way.
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  // Off screen, not focusable by people, and big enough text that iOS doesn't zoom.
  field.setAttribute("readonly", "");
  field.setAttribute("aria-hidden", "true");
  field.tabIndex = -1;
  field.className = "fixed -left-full top-0 text-body";
  // Inside the open sheet or dialog, if any: everything outside a modal
  // dialog is inert, and an inert field can't be selected or copied.
  const host = document.activeElement?.closest("dialog") ?? document.querySelector("dialog[open]") ?? document.body;
  host.appendChild(field);
  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (previous && selection) {
      selection.removeAllRanges();
      selection.addRange(previous);
    }
  }
}
