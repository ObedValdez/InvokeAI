import { Flex, Heading } from '@invoke-ai/ui-library';
import type { PropsWithChildren } from 'react';
import { memo } from 'react';

export const LaunchpadContainer = memo((props: PropsWithChildren<{ heading: string }>) => {
  return (
    <Flex
      flexDir="column"
      h="full"
      minH={0}
      w="full"
      alignItems="center"
      justifyContent={{ base: 'flex-start', lg: 'center' }}
      gap={2}
      overflowY="auto"
      overflowX="hidden"
      py={{ base: 2, lg: 0 }}
    >
      <Flex flexDir="column" w="full" gap={4} px={{ base: 3, md: 8, xl: 14 }} maxW={768}>
        <Heading>{props.heading}</Heading>
        <Flex flexDir="column" gap={4}>
          {props.children}
        </Flex>
      </Flex>
    </Flex>
  );
});
LaunchpadContainer.displayName = 'LaunchpadContainer';
