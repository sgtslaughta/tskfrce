import Head from 'next/head'
import { useRouter } from 'next/router'
import { ResetForm } from '@/v2/login/ResetForm'

export default function Reset() {
  const { query } = useRouter()
  const token = typeof query.token === 'string' ? query.token : undefined
  return (
    <>
      <Head>
        <title>t@sk4ce</title>
      </Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <ResetForm token={token} />
      </div>
    </>
  )
}
