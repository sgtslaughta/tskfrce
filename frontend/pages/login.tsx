import Head from 'next/head'
import { LoginForm } from '@/v2/login/LoginForm'

export default function Login() {
  return (
    <>
      <Head>
        <title>t@sk4ce</title>
      </Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <LoginForm />
      </div>
    </>
  )
}
