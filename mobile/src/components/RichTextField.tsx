import { useEffect, useRef } from "react";
import Icon from "./Icon";

// Lightweight rich-text editor for the WebView: a contentEditable surface +
// a formatting toolbar (document.execCommand). It's UNCONTROLLED — the HTML is
// seeded once and read back on input, so the caret never jumps. Output is the
// same HTML the web TipTap editor produces, rendered with `.mobile-rich`.
const TOOLS: { cmd: string; arg?: string; icon: string; label: string }[] = [
  { cmd: "bold", icon: "format_bold", label: "Bold" },
  { cmd: "italic", icon: "format_italic", label: "Italic" },
  { cmd: "underline", icon: "format_underlined", label: "Underline" },
  { cmd: "insertUnorderedList", icon: "format_list_bulleted", label: "Bulleted list" },
  { cmd: "insertOrderedList", icon: "format_list_numbered", label: "Numbered list" },
];

export default function RichTextField({
  valueHtml,
  onChange,
  placeholder,
  minHeight = 128,
}: {
  valueHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  // Seed the editor exactly once (and re-seed if an async edit-load arrives
  // before the user has typed anything).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!seeded.current || (el.innerHTML === "" && valueHtml)) {
      el.innerHTML = valueHtml || "";
      seeded.current = true;
    }
  }, [valueHtml]);

  function exec(cmd: string) {
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd, false);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="overflow-hidden rounded-[12px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
      <div className="flex items-center gap-0.5 px-1.5 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            aria-label={t.label}
            // preventDefault keeps the text selection while tapping the toolbar
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] active:opacity-60"
          >
            <Icon name={t.icon} size={19} style={{ color: "var(--text-2)" }} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        className="rt-editable mobile-rich px-3.5 py-3 text-[14.5px] leading-relaxed outline-none"
        style={{ color: "var(--text)", minHeight }}
      />
    </div>
  );
}
