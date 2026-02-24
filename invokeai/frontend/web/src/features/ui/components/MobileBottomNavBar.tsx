import type { SystemStyleObject } from '@invoke-ai/ui-library';
import { Box, Flex, IconButton, Text } from '@invoke-ai/ui-library';
import { useAppSelector } from 'app/store/storeHooks';
import { navigationApi } from 'features/ui/layouts/navigation-api';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import type { TabName } from 'features/ui/store/uiTypes';
import type { ReactElement } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiBoundingBoxBold,
  PiCubeBold,
  PiFlowArrowBold,
  PiFrameCornersBold,
  PiQueueBold,
  PiTextAaBold,
} from 'react-icons/pi';

const selectedButtonSx: SystemStyleObject = {
  '&[data-selected=true]': {
    svg: { fill: 'invokeYellow.300' },
  },
};

const tabs: Array<{ tab: TabName; i18nKey: string; icon: ReactElement }> = [
  { tab: 'generate', i18nKey: 'ui.tabs.generate', icon: <PiTextAaBold /> },
  { tab: 'canvas', i18nKey: 'ui.tabs.canvas', icon: <PiBoundingBoxBold /> },
  { tab: 'upscaling', i18nKey: 'ui.tabs.upscaling', icon: <PiFrameCornersBold /> },
  { tab: 'workflows', i18nKey: 'ui.tabs.workflows', icon: <PiFlowArrowBold /> },
  { tab: 'video', i18nKey: 'ui.tabs.video', icon: <PiFrameCornersBold /> },
  { tab: 'models', i18nKey: 'ui.tabs.models', icon: <PiCubeBold /> },
  { tab: 'queue', i18nKey: 'ui.tabs.queue', icon: <PiQueueBold /> },
];

export const MobileBottomNavBar = memo(() => {
  const { t } = useTranslation();
  const activeTabName = useAppSelector(selectActiveTab);

  const onClickTab = useCallback((tab: TabName) => {
    navigationApi.switchToTab(tab);
  }, []);

  return (
    <Box
      display={{ base: 'block', lg: 'none' }}
      position="fixed"
      insetInlineStart={0}
      insetInlineEnd={0}
      bottom={0}
      zIndex={30}
      bg="base.900"
      borderTopWidth={1}
      borderTopColor="base.700"
      px={1}
      py={1}
      overflowX="auto"
    >
      <Flex alignItems="center" justifyContent="flex-start" gap={2} minW="max-content" px={1}>
        {tabs.map(({ tab, i18nKey, icon }) => (
          <MobileTabButton
            key={tab}
            tab={tab}
            icon={icon}
            label={t(i18nKey)}
            isSelected={activeTabName === tab}
            onSelectTab={onClickTab}
          />
        ))}
      </Flex>
    </Box>
  );
});

MobileBottomNavBar.displayName = 'MobileBottomNavBar';

const MobileTabButton = memo(
  ({
    tab,
    icon,
    label,
    isSelected,
    onSelectTab,
  }: {
    tab: TabName;
    icon: ReactElement;
    label: string;
    isSelected: boolean;
    onSelectTab: (tab: TabName) => void;
  }) => {
    const onClick = useCallback(() => onSelectTab(tab), [onSelectTab, tab]);

    return (
      <Flex alignItems="center" justifyContent="center" flexDir="column" minW={14} gap={0.5}>
        <IconButton
          onClick={onClick}
          icon={icon}
          variant="link"
          fontSize="22px"
          boxSize={8}
          aria-label={label}
          data-selected={isSelected}
          sx={selectedButtonSx}
        />
        <Text
          fontSize="2xs"
          lineHeight="1"
          color={isSelected ? 'invokeYellow.300' : 'base.200'}
          noOfLines={1}
          maxW="5rem"
          textAlign="center"
        >
          {label}
        </Text>
      </Flex>
    );
  }
);

MobileTabButton.displayName = 'MobileTabButton';
