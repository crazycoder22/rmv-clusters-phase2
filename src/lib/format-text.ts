/**
 * Convert plain text with common formatting patterns to safe HTML.
 * Handles: newlines, URLs, bullet lists (- or •), **bold**, and _italic_.
 */
export function formatRichText(text: string): string {
  if (!text) return "";

  // Escape HTML entities first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert **bold** → <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert _italic_ → <em> (but not in URLs)
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Convert URLs → clickable links
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">$1</a>'
  );

  // Split into lines for block-level processing
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list items: lines starting with - or • or *
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        result.push('<ul class="list-disc list-inside space-y-1 my-2">');
        inList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }

    // Numbered list items: lines starting with 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      if (!inList) {
        result.push('<ol class="list-decimal list-inside space-y-1 my-2">');
        inList = true;
      }
      result.push(`<li>${numMatch[2]}</li>`);
      continue;
    }

    // Close list if we were in one
    if (inList) {
      // Check if the previous list was <ul> or <ol>
      const lastOpen = result.findLast((r) => r.startsWith("<ul") || r.startsWith("<ol"));
      result.push(lastOpen?.startsWith("<ol") ? "</ol>" : "</ul>");
      inList = false;
    }

    // Empty line → paragraph break
    if (trimmed === "") {
      result.push("<br />");
    } else {
      result.push(trimmed);
    }
  }

  // Close any open list
  if (inList) {
    const lastOpen = result.findLast((r) => r.startsWith("<ul") || r.startsWith("<ol"));
    result.push(lastOpen?.startsWith("<ol") ? "</ol>" : "</ul>");
  }

  // Join lines that aren't block-level elements with <br />
  const output: string[] = [];
  for (const line of result) {
    if (
      line.startsWith("<ul") || line.startsWith("</ul") ||
      line.startsWith("<ol") || line.startsWith("</ol") ||
      line.startsWith("<li") ||
      line === "<br />"
    ) {
      output.push(line);
    } else {
      // Regular text line — append with line break
      if (output.length > 0 && !output[output.length - 1].match(/<\/[uo]l>$|<br \/>$|<li>.*<\/li>$/)) {
        output.push("<br />");
      }
      output.push(line);
    }
  }

  return output.join("\n");
}
