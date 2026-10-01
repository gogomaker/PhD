import { useEffect, useState, type CSSProperties } from 'react';

// 고치는 동안은 화면에만, 칸을 벗어나거나 Enter를 누르면 저장.
// required면 비웠을 때 원래 값으로 되돌린다.
export function BlurInput({ value, onSave, label, maxLength, placeholder, required = true, multiline = false, rows, className, style, autoFocus }: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (!v && required) setDraft(value);
    else if (v !== value.trim()) onSave(v);
  };
  const common = {
    value: draft,
    maxLength,
    placeholder,
    'aria-label': label,
    className,
    style,
    autoFocus,
    onBlur: commit,
  };
  if (multiline) {
    return <textarea {...common} rows={rows} onChange={e => setDraft(e.target.value)} />;
  }
  return (
    <input
      {...common}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
    />
  );
}
