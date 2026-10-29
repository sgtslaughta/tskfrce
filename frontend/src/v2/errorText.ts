/** Shown whenever the box can't be reached. */
export const CANT_REACH = "Can't reach the home box. Check it's plugged in and on Wi-Fi."

/** Words for the person: our own message, or the home-box message when the request never arrived (fetch throws a TypeError). */
export const errorText = (e: unknown): string => (e instanceof Error && !(e instanceof TypeError) ? e.message : CANT_REACH)
