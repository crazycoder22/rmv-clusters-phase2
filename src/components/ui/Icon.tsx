// OneRMV design system — Material Symbols Outlined glyph.
// Usage: <Icon name="newspaper" size={24} fill />
// The font renders the name as a ligature; FILL/weight/opsz are variation axes.

interface IconProps {
  name: string;
  size?: number;
  fill?: boolean;
  weight?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export default function Icon({ name, size = 24, fill = false, weight = 400, className = "", style, title }: IconProps) {
  return (
    <span
      className={`ms ${className}`}
      aria-hidden={title ? undefined : true}
      title={title}
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
