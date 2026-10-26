/** "Mia is typing…", "Mia and Leo are typing…", "3 people are typing…" */
export const typingText = (names: string[]) =>
  names.length === 1
    ? `${names[0]} is typing…`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing…`
      : `${names.length} people are typing…`

/** Three dots and who is typing, at the bottom of the message list. */
export function TypingLine({ names }: { names: string[] }) {
  return (
    <div className="pc-typing" aria-live="polite">
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{typingText(names)}</span>
    </div>
  )
}
