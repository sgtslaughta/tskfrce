import type { NextPageContext } from 'next'
import { CrashPage } from '@/v2/components/ErrorBoundary'

/** Server-side failures and anything the boundary in _app cannot catch. */
export default function ErrorPage({ statusCode, message }: { statusCode?: number; message?: string }) {
  return <CrashPage detail={`${statusCode ?? 'error'}${message ? `: ${message}` : ''}`} />
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => ({
  statusCode: res?.statusCode ?? err?.statusCode,
  message: err?.message,
})
