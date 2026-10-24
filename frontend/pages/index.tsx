import Head from 'next/head'
import { RequireParent } from '@/v2/components/RequireParent'
import { TodayPage } from '@/v2/today/TodayPage'

export default function Home() {
  return (
    <>
      <Head>
        <title>Today - t@sk4ce</title>
      </Head>
      <RequireParent>
        <TodayPage />
      </RequireParent>
    </>
  )
}
