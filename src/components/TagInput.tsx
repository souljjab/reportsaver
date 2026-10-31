import { useState } from 'react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ tags, onChange, suggestions = [], placeholder = '태그 입력 후 Enter' }: Props) {
  const [text, setText] = useState('');
  const listId = 'tag-suggest';

  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...tags, ...parts])]);
    setText('');
  };

  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="chip">
          #{t}
          <button type="button" aria-label={`${t} 태그 삭제`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        list={listId}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => add(text)}
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !tags.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
