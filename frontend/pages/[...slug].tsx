import Head from 'next/head'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import Link from 'next/link'

/** Unknown route: mockup 05 "404" with the 0 on an accent tile. */
export default function NotFound() {
  useLook('parent')
  return (
    <>
      <Head>
        <title>Not found - t@sk4ce</title>
      </Head>
      <main className="p-404">
        <div className="p-404-num" aria-hidden="true">
          4<span>0</span>4
        </div>
        <h1 className="p-state-title">That page isn&apos;t here</h1>
        <p className="p-state-body">The link may be old, or the chore was deleted.</p>
        <Link href="/" className="p-btn">
          <Icon name="home" size={17} />
          Go to Today
        </Link>
      </main>
    </>
  )
}
