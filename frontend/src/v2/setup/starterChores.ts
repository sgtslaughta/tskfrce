/** Starter chores offered in the setup wizard (mockup 07): daily, with their chore type. */
export interface Starter {
  title: string
  type: string // built-in chore type name
  glyph: string
  points: number
}

export const STARTER_CHORES: Starter[] = [
  { title: 'Make bed', type: 'Personal', glyph: 'bed', points: 10 },
  { title: 'Unload dishwasher', type: 'Kitchen', glyph: 'restaurant', points: 20 },
  { title: 'Homework', type: 'Schoolwork', glyph: 'school', points: 30 },
  { title: 'Feed the pet', type: 'Pets', glyph: 'pets', points: 10 },
  { title: 'Tidy room', type: 'Cleaning', glyph: 'cleaning_services', points: 25 },
  { title: 'Take out trash', type: 'Kitchen', glyph: 'delete', points: 15 },
  { title: 'Water plants', type: 'Outdoor', glyph: 'yard', points: 10 },
  { title: 'Practice instrument', type: 'Practice', glyph: 'music_note', points: 15 },
]

export const starter = (title: string): Starter | undefined => STARTER_CHORES.find((c) => c.title === title)

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐵', '🐧', '🦖', '🚀', '⭐']
