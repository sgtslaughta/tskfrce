import Head from 'next/head'
import { useRouter } from 'next/router'
import { RegisterForm } from '@/v2/login/RegisterForm'

export default function Register() {
  const { query } = useRouter()
  const token = typeof query.token === 'string' ? query.token : undefined
  return (
    <>
      <Head>
        <title>t@sk4ce</title>
      </Head>
      <RegisterForm token={token} />
    </>
  )
}
