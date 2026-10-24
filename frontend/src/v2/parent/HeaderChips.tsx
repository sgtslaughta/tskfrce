import { Icon } from './Icon';
import { MakerLogo, type MakerKey } from './MakerLogo';

type HeaderChipTone = 'acc' | 'mono' | 'plain';

interface HeaderChip {
  icon?: string;
  logo?: MakerKey;
  text: string;
  tone?: HeaderChipTone;
}

interface HeaderChipsProps {
  items: HeaderChip[];
}

/**
 * Row of small chips typically placed under a detail header.
 * Can display icon, maker logo, text, and tone.
 */
export function HeaderChips({ items }: HeaderChipsProps) {
  return (
    <div className="p-header-chips">
      {items.map((item, i) => (
        <span key={i} className="p-header-chip" data-tone={item.tone || 'plain'}>
          {item.logo && <MakerLogo vendor={item.logo} />}
          {item.icon && <Icon name={item.icon} size={16} />}
          {item.text}
        </span>
      ))}
    </div>
  );
}
