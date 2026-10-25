// ponytail: chores have no icon field; guess one from the title. Add Chore.icon when parents want to pick.
const RULES: [RegExp, string][] = [
  [/dish|kitchen|table|cook|lunch|dinner/i, 'restaurant'],
  [/homework|read|study|math|school|book/i, 'school'],
  [/pet|cat|dog|fish|feed/i, 'pets'],
  [/piano|music|guitar|violin|practice/i, 'music_note'],
  [/bed\b|make bed/i, 'bed'],
  [/tidy|clean|room|vacuum|sweep|dust/i, 'mop'],
  [/laundry|clothes|wash/i, 'local_laundry_service'],
  [/trash|garbage|recycl|bin/i, 'delete'],
  [/teeth|brush|shower|bath/i, 'shower'],
  [/yard|garden|plant|water|lawn/i, 'yard'],
]

export const choreIcon = (title: string) => RULES.find(([re]) => re.test(title))?.[1] ?? 'task_alt'

// ponytail: chore type guessed from the icon until chores.type_id lands (Plan B); then group by that
const TYPE: Record<string, string> = {
  restaurant: 'Kitchen', school: 'Schoolwork', pets: 'Pets', music_note: 'Practice', yard: 'Outdoor',
  bed: 'Cleaning', mop: 'Cleaning', local_laundry_service: 'Cleaning', delete: 'Cleaning', shower: 'Personal',
}
export const choreType = (title: string) => TYPE[choreIcon(title)] ?? 'Other'
