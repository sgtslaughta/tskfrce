import { useState, useMemo } from 'react';
import { Icon } from './Icon';

interface GlyphPickerProps {
  value: string;
  onChange: (glyph: string) => void;
  choices: string[];
}

/**
 * Search + grid picker for Material Symbols glyphs.
 * Used by Task 7 (Groups icon) and Task 12 (chore type icons).
 */
export function GlyphPicker({ value, onChange, choices }: GlyphPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return choices;
    const lower = search.toLowerCase();
    return choices.filter((glyph) => glyph.toLowerCase().includes(lower));
  }, [search, choices]);

  return (
    <div className="p-glyph-picker">
      <input
        type="text"
        placeholder="Search glyphs"
        className="p-glyph-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="p-glyph-grid">
        {filtered.map((glyph) => (
          <button
            key={glyph}
            type="button"
            className={`p-glyph-item ${glyph === value ? 'selected' : ''}`}
            onClick={() => onChange(glyph)}
            title={glyph}
          >
            <Icon name={glyph} size={24} />
            <span className="p-glyph-label">{glyph}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
