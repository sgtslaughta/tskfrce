import Head from 'next/head'
import { useState } from 'react'
import { Container, Title, Text, Button, Stack, Center, Paper, Group, Badge } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MyHub } from '../src/components/pages/MyHub'
import { AuthGuard } from '../src/components/auth'
import { useUnifiedAuth } from '../src/contexts/UnifiedAuthContext'

export default function Home() {
  const [currentPage, setCurrentPage] = useState('hub')
  const { user, logout } = useUnifiedAuth()

  const handleNavigation = (pageId: string) => {
    setCurrentPage(pageId)
    // Handle navigation for different page types
    if (pageId === 'hub') {
      // Stay on current page, just update state
      notifications.show({
        title: 'Navigation',
        message: 'Navigated to My Hub',
        color: 'blue',
      })
    } else {
      notifications.show({
        title: 'Navigation',
        message: `Navigation to ${pageId} - implementation pending`,
        color: 'blue',
      })
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      notifications.show({
        title: 'Goodbye!',
        message: 'You have been successfully logged out.',
        color: 'blue',
      })
    } catch (error) {
      notifications.show({
        title: 'Logout Error',
        message: 'There was an issue logging you out. Please try again.',
        color: 'red',
      })
    }
  }


  const handleTestNotification = () => {
    notifications.show({
      title: 'Welcome to Mantine!',
      message: 'UI migration Phase 3 complete! 🚀',
      color: 'green',
    })
  }

  return (
    <>
      <Head>
        <title>My Hub - TaaskMaaster</title>
        <meta name="description" content="Your personal productivity hub - manage tasks, track progress, and achieve your goals" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <AuthGuard>
        <MyHub
          currentPage={currentPage}
          onNavigate={handleNavigation}
          user={user ? {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            points: user.points,
            level: user.level
          } : null}
          onLogout={handleLogout}
        />
      </AuthGuard>
    </>
  )
}