import { render, screen } from '@testing-library/react';
import { HeaderChips } from '../../src/v2/parent/HeaderChips';

describe('HeaderChips', () => {
  it('renders text content', () => {
    const items = [{ text: 'Test Item' }];
    render(<HeaderChips items={items} />);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('renders with custom tone', () => {
    const items = [{ text: 'Accent Item', tone: 'acc' }];
    const { container } = render(<HeaderChips items={items} />);
    const chip = container.querySelector('[data-tone="acc"]');
    expect(chip).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const items = [{ text: 'With Icon', icon: 'check' }];
    render(<HeaderChips items={items} />);
    expect(screen.getByText('check')).toBeInTheDocument();
  });

  it('renders maker logo when vendor is provided', () => {
    const items = [{ text: 'Apple Device', vendor: 'Apple' }];
    const { container } = render(<HeaderChips items={items} />);
    // MakerLogo renders an SVG with aria-label
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not render logo when vendor is null', () => {
    const items = [{ text: 'No Logo', vendor: null }];
    const { container } = render(<HeaderChips items={items} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('renders multiple chips', () => {
    const items = [
      { text: 'First', tone: 'acc' },
      { text: 'Second', vendor: 'Google' },
      { text: 'Third', icon: 'lock' }
    ];
    render(<HeaderChips items={items} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });
});
