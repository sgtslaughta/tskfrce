import { Icon } from '@/v2/parent/Icon'

/**
 * @description Parent auth brand panel - left side with wordmark and headline
 * Used on login, register, and reset pages
 */
export function AuthBrand() {
  return (
    <div className="p-auth-brand">
      <div className="p-auth-wordmark">
        <i>@</i>
        <span>t@sk4ce</span>
      </div>
      <h2 className="p-auth-headline">
        Chores done. <em>Wi‑Fi on.</em>
      </h2>
      <p className="p-auth-subtitle">Your family's chore chart, wired to the home network.</p>
    </div>
  )
}
