// Port of `../../../src/lib/format-text.ts`. Announcements store plain text
// with markdown-like formatting (**bold**, _italic_, bullets, URLs, newlines)
// — this converts that to safe HTML.

export function formatRichText(text: string): string {
  if (!text) return "";

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      if (!inList) {
        result.push("<ol>");
        inList = true;
      }
      result.push(`<li>${numMatch[2]}</li>`);
      continue;
    }

    if (inList) {
      const lastOpen = result.findLast(
        (r) => r.startsWith("<ul") || r.startsWith("<ol")
      );
      result.push(lastOpen?.startsWith("<ol") ? "</ol>" : "</ul>");
      inList = false;
    }

    if (trimmed === "") {
      result.push("<br />");
    } else {
      result.push(trimmed);
    }
  }

  if (inList) {
    const lastOpen = result.findLast(
      (r) => r.startsWith("<ul") || r.startsWith("<ol")
    );
    result.push(lastOpen?.startsWith("<ol") ? "</ol>" : "</ul>");
  }

  const output: string[] = [];
  for (const line of result) {
    if (
      line.startsWith("<ul") ||
      line.startsWith("</ul") ||
      line.startsWith("<ol") ||
      line.startsWith("</ol") ||
      line.startsWith("<li") ||
      line === "<br />"
    ) {
      output.push(line);
    } else {
      if (
        output.length > 0 &&
        !output[output.length - 1].match(/<\/[uo]l>$|<br \/>$|<li>.*<\/li>$/)
      ) {
        output.push("<br />");
      }
      output.push(line);
    }
  }

  return output.join("\n");
}
