import Head from 'next/head'
import Link from 'next/link'
import { ErrorPanel } from '@/v2/parent/states'

export default function NotFound() {
  return (
    <>
      <Head>
        <title>t@sk4ce</title>
      </Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <main className="f-main" style={{ maxWidth: 440 }}>
          <ErrorPanel kind="notfound" />
        </main>
      </div>
    </>
  )
}
