import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorPanel } from '../parent/states'
import { useLook } from '../parent/useLook'

/** Whole-page "Something went wrong" (mockup 05): Reload and Copy details. */
export function CrashPage({ detail }: { detail: string }) {
  useLook('parent')
  return (
    <main className="p-guard-state">
      <ErrorPanel kind="crash" heading="h1" detail={detail} />
    </main>
  )
}

interface Props {
  children: ReactNode
  /** a new value (the route) clears a caught error so navigating away recovers */
  resetKey?: string
}

/** Catches a render error anywhere below so a bad payload shows a calm page, not a blank screen. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    return error ? <CrashPage detail={error.stack ?? String(error)} /> : this.props.children
  }
}
