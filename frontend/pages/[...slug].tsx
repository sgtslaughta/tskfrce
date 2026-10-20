import Head from 'next/head'
import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <Head>
        <title>t@sk4ce</title>
      </Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <main className="f-main" style={{ maxWidth: 440 }}>
          <div className="f-card">
            <h1 className="f-display" style={{ marginTop: 0 }}>That page doesn&apos;t exist.</h1>
            <p>
              <Link href="/">Go to Today</Link>
            </p>
          </div>
        </main>
      </div>
    </>
  )
}
