import { Divider, Flex, IconButton, Spacer, Tooltip } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import InvokeAILogoComponent from 'features/system/components/InvokeAILogoComponent';
import SettingsMenu from 'features/system/components/SettingsModal/SettingsMenu';
import StatusIndicator from 'features/system/components/StatusIndicator';
import { VideosModalButton } from 'features/system/components/VideosModal/VideosModalButton';
import { selectSystemShowLegends, setShowLegends } from 'features/system/store/systemSlice';
import { openTutorial } from 'features/tutorial/store/tutorialUiStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiBoundingBoxBold,
  PiCubeBold,
  PiFlowArrowBold,
  PiFrameCornersBold,
  PiInfoBold,
  PiQueueBold,
  PiTextAaBold,
} from 'react-icons/pi';

import { Notifications } from './Notifications';
import { TabButton } from './TabButton';

export const VerticalNavBar = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const showLegends = useAppSelector(selectSystemShowLegends);
  const onToggleLegends = useCallback(() => dispatch(setShowLegends(!showLegends)), [dispatch, showLegends]);

  return (
    <Flex flexDir="column" alignItems="center" py={6} ps={4} pe={2} gap={4} minW={0} flexShrink={0}>
      <InvokeAILogoComponent />

      <Flex gap={6} pt={6} h="full" flexDir="column">
        <TabButton tab="generate" icon={<PiTextAaBold />} label={t('ui.tabs.generate')} />
        <TabButton tab="canvas" icon={<PiBoundingBoxBold />} label={t('ui.tabs.canvas')} />
        <TabButton tab="upscaling" icon={<PiFrameCornersBold />} label={t('ui.tabs.upscaling')} />
        <TabButton tab="workflows" icon={<PiFlowArrowBold />} label={t('ui.tabs.workflows')} />
        <TabButton tab="video" icon={<PiFrameCornersBold />} label={t('ui.tabs.video')} />
      </Flex>

      <Spacer />

      <StatusIndicator />
      <TabButton tab="models" icon={<PiCubeBold />} label={t('ui.tabs.models')} />
      <TabButton tab="queue" icon={<PiQueueBold />} label={t('ui.tabs.queue')} />

      <Divider />

      <Notifications />
      <Tooltip label={t('tutorial.openCoach')}>
        <IconButton
          aria-label={t('tutorial.openCoach')}
          icon={<PiInfoBold fontSize={20} />}
          variant="link"
          boxSize={8}
          onClick={openTutorial}
        />
      </Tooltip>
      <Tooltip label={showLegends ? t('legends.hide') : t('legends.show')}>
        <IconButton
          aria-label={showLegends ? t('legends.hide') : t('legends.show')}
          icon={<PiInfoBold fontSize={20} />}
          variant="link"
          boxSize={8}
          color={showLegends ? 'invokeYellow.300' : undefined}
          onClick={onToggleLegends}
        />
      </Tooltip>
      <VideosModalButton />
      <SettingsMenu />
    </Flex>
  );
});

VerticalNavBar.displayName = 'VerticalNavBar';
