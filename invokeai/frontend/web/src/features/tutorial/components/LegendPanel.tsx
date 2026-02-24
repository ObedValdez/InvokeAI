import { Badge, Box, Divider, Flex, Heading, IconButton, Text, Tooltip } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { selectSystemShowLegends, setShowLegends } from 'features/system/store/systemSlice';
import { TAB_LEGEND_ITEMS } from 'features/tutorial/tutorialConfig';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiInfoBold } from 'react-icons/pi';

export const LegendPanel = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveTab);
  const showLegends = useAppSelector(selectSystemShowLegends);
  const onHideLegends = useCallback(() => dispatch(setShowLegends(false)), [dispatch]);

  if (!showLegends) {
    return null;
  }

  const items = TAB_LEGEND_ITEMS[activeTab];

  return (
    <Box
      position="absolute"
      right={3}
      bottom={3}
      zIndex={20}
      w="24rem"
      maxW="calc(100vw - 6rem)"
      maxH="calc(100vh - 6rem)"
      overflowY="auto"
      borderWidth={1}
      borderRadius="base"
      bg="base.900"
      p={3}
      shadow="dark-lg"
    >
      <Flex justifyContent="space-between" alignItems="center" mb={2}>
        <Flex gap={2} alignItems="center">
          <PiInfoBold />
          <Heading size="sm">{t('legends.panelTitle')}</Heading>
          <Badge>{t(`ui.tabs.${activeTab}`)}</Badge>
        </Flex>
        <Tooltip label={t('legends.hide')}>
          <IconButton
            aria-label={t('legends.hide')}
            icon={<PiInfoBold />}
            size="xs"
            variant="ghost"
            onClick={onHideLegends}
          />
        </Tooltip>
      </Flex>
      <Divider mb={3} />
      <Flex flexDir="column" gap={3}>
        {items.map((item) => (
          <Box key={item.titleKey}>
            <Text fontSize="sm" fontWeight="semibold">
              {t(item.titleKey)}
            </Text>
            <Text fontSize="sm" variant="subtext">
              {t(item.bodyKey)}
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  );
});

LegendPanel.displayName = 'LegendPanel';
