import Head from 'next/head'
import { DevicesPage } from '@/v2/manage/DevicesPage'

export default function Devices() {
  return (
    <>
      <Head>
        <title>Devices - t@sk4ce</title>
      </Head>
      <DevicesPage />
    </>
  )
}
