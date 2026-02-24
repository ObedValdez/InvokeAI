import 'dockview/dist/styles/dockview.css';
import 'features/ui/styles/dockview-theme-invoke.css';

import { Flex } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useAppSelector } from 'app/store/storeHooks';
import Loading from 'common/components/Loading/Loading';
import { useIsMobileLayout } from 'features/ui/hooks/useIsMobileLayout';
import { navigationApi } from 'features/ui/layouts/navigation-api';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import { lazy, memo, Suspense } from 'react';

const GenerateTabAutoLayout = lazy(() =>
  import('features/ui/layouts/generate-tab-auto-layout').then((m) => ({ default: m.GenerateTabAutoLayout }))
);
const CanvasTabAutoLayout = lazy(() =>
  import('features/ui/layouts/canvas-tab-auto-layout').then((m) => ({ default: m.CanvasTabAutoLayout }))
);
const UpscalingTabAutoLayout = lazy(() =>
  import('features/ui/layouts/upscaling-tab-auto-layout').then((m) => ({ default: m.UpscalingTabAutoLayout }))
);
const WorkflowsTabAutoLayout = lazy(() =>
  import('features/ui/layouts/workflows-tab-auto-layout').then((m) => ({ default: m.WorkflowsTabAutoLayout }))
);
const VideoTabAutoLayout = lazy(() =>
  import('features/ui/layouts/video-tab-auto-layout').then((m) => ({ default: m.VideoTabAutoLayout }))
);
const ModelsTabAutoLayout = lazy(() =>
  import('features/ui/layouts/models-tab-auto-layout').then((m) => ({ default: m.ModelsTabAutoLayout }))
);
const QueueTabAutoLayout = lazy(() =>
  import('features/ui/layouts/queue-tab-auto-layout').then((m) => ({ default: m.QueueTabAutoLayout }))
);
const VerticalNavBar = lazy(() =>
  import('features/ui/components/VerticalNavBar').then((m) => ({ default: m.VerticalNavBar }))
);
const MobileBottomNavBar = lazy(() =>
  import('features/ui/components/MobileBottomNavBar').then((m) => ({ default: m.MobileBottomNavBar }))
);
const LegendPanel = lazy(() =>
  import('features/tutorial/components/LegendPanel').then((m) => ({ default: m.LegendPanel }))
);
const TutorialCoach = lazy(() =>
  import('features/tutorial/components/TutorialCoach').then((m) => ({ default: m.TutorialCoach }))
);

export const AppContent = memo(() => {
  const isMobileLayout = useIsMobileLayout();

  return (
    <Flex
      position="relative"
      w="full"
      h="full"
      overflow="hidden"
      flexDir={{ base: 'column', lg: 'row' }}
      sx={{ touchAction: { base: 'pan-y', lg: 'auto' } }}
    >
      <Flex display={{ base: 'none', lg: 'flex' }} h="full">
        <Suspense fallback={null}>
          <VerticalNavBar />
        </Suspense>
      </Flex>
      <Flex
        position="relative"
        w="full"
        h="full"
        overflow="hidden"
        pb={{ base: '60px', lg: 0 }}
        sx={{ touchAction: { base: 'pan-y', lg: 'auto' } }}
      >
        <TabContent />
      </Flex>
      <Suspense fallback={null}>
        <MobileBottomNavBar />
      </Suspense>
      {!isMobileLayout ? (
        <Suspense fallback={null}>
          <LegendPanel />
          <TutorialCoach />
        </Suspense>
      ) : null}
    </Flex>
  );
});
AppContent.displayName = 'AppContent';

const TabContent = memo(() => {
  const tab = useAppSelector(selectActiveTab);

  return (
    <Suspense fallback={<Loading />}>
      <Flex position="relative" w="full" h="full" overflow="hidden">
        {tab === 'generate' && <GenerateTabAutoLayout />}
        {tab === 'canvas' && <CanvasTabAutoLayout />}
        {tab === 'upscaling' && <UpscalingTabAutoLayout />}
        {tab === 'workflows' && <WorkflowsTabAutoLayout />}
        {tab === 'video' && <VideoTabAutoLayout />}
        {tab === 'models' && <ModelsTabAutoLayout />}
        {tab === 'queue' && <QueueTabAutoLayout />}
        <SwitchingTabsLoader />
      </Flex>
    </Suspense>
  );
});
TabContent.displayName = 'TabContent';

const SwitchingTabsLoader = memo(() => {
  const isSwitchingTabs = useStore(navigationApi.$isLoading);

  if (isSwitchingTabs) {
    return <Loading />;
  }

  return null;
});
SwitchingTabsLoader.displayName = 'SwitchingTabsLoader';
