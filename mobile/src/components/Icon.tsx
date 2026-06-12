// OneRMV design system — Material Symbols Outlined glyph.
// Usage: <Icon name="newspaper" size={24} fill />
import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  size?: number;
  fill?: boolean;
  weight?: number;
  className?: string;
  style?: CSSProperties;
}

export default function Icon({ name, size = 24, fill = false, weight = 400, className = "", style }: IconProps) {
  return (
    <span
      className={`ms ${className}`}
      aria-hidden
      style={{
        fontSize: size,
        fontVariationSettings: `'opsz' ${Math.min(48, Math.max(20, size))}, 'wght' ${weight}, 'FILL' ${fill ? 1 : 0}, 'GRAD' 0`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
