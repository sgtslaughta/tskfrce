/**
 * @fileoverview Dynamic route handler for catch-all routes
 * @description Handles dynamic routes that don't match specific pages
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Container, Title, Text, Button, Stack, Center } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';

/**
 * @description Dynamic route component
 * @returns Component for handling dynamic routes
 */
export default function DynamicRoute() {
  const router = useRouter();
  const { slug } = router.query;

  useEffect(() => {
    // Handle specific routes if needed
    if (Array.isArray(slug)) {
      const route = slug.join('/');
      // Add specific route handling here if needed
      console.log('Dynamic route:', route);
    }
  }, [slug]);

  return (
    <Container size="md" py="xl">
      <Stack align="center" gap="lg">
        <Title order={1} ta="center">
          Page Not Found
        </Title>
        <Text size="lg" ta="center" c="dimmed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </Text>
        <Button
          leftSection={<IconHome size={16} />}
          onClick={() => router.push('/')}
          size="md"
        >
          Go Home
        </Button>
      </Stack>
    </Container>
  );
}
