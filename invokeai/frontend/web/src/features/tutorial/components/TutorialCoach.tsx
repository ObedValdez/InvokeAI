import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Flex,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import {
  addTutorialCompletedStep,
  resetTutorialCompletedSteps,
  selectSystemTutorialCompletedSteps,
  selectSystemTutorialEnabled,
  setShowLegends,
  setTutorialEnabled,
} from 'features/system/store/systemSlice';
import { $isTutorialOpen, closeTutorial, openTutorial } from 'features/tutorial/store/tutorialUiStore';
import { TUTORIAL_STEPS } from 'features/tutorial/tutorialConfig';
import { navigationApi } from 'features/ui/layouts/navigation-api';
import type { ChangeEvent } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const TutorialCoach = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useStore($isTutorialOpen);
  const tutorialEnabled = useAppSelector(selectSystemTutorialEnabled);
  const completedSteps = useAppSelector(selectSystemTutorialCompletedSteps);
  const [stepIndex, setStepIndex] = useState(0);
  const totalSteps = TUTORIAL_STEPS.length;

  const completedSet = useMemo(() => new Set(completedSteps), [completedSteps]);
  const safeStepIndex = Math.min(stepIndex, Math.max(totalSteps - 1, 0));
  const currentStep = TUTORIAL_STEPS[safeStepIndex];
  const doneCount = useMemo(() => TUTORIAL_STEPS.filter((step) => completedSet.has(step.id)).length, [completedSet]);

  useEffect(() => {
    if (totalSteps === 0) {
      return;
    }
    if (!tutorialEnabled) {
      return;
    }
    if (completedSteps.length === 0) {
      // Open once for first-time users after defaults/migrations.
      const timeout = window.setTimeout(() => {
        if (!$isTutorialOpen.get()) {
          openTutorial();
        }
      }, 300);
      return () => window.clearTimeout(timeout);
    }
  }, [completedSteps.length, totalSteps, tutorialEnabled]);

  useEffect(() => {
    if (totalSteps === 0) {
      return;
    }
    if (!isOpen) {
      return;
    }
    const firstPending = TUTORIAL_STEPS.findIndex((step) => !completedSet.has(step.id));
    setStepIndex(firstPending >= 0 ? firstPending : 0);
  }, [completedSet, isOpen, totalSteps]);

  const onGoToStep = useCallback(() => {
    if (!currentStep) {
      return;
    }
    navigationApi.switchToTab(currentStep.tab);
    dispatch(setShowLegends(true));
  }, [currentStep, dispatch]);

  const onNext = useCallback(() => {
    if (!currentStep) {
      return;
    }
    dispatch(addTutorialCompletedStep(currentStep.id));
    setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
  }, [currentStep, dispatch]);

  const onPrevious = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const onClose = useCallback(() => {
    closeTutorial();
  }, []);

  const onResetProgress = useCallback(() => {
    dispatch(resetTutorialCompletedSteps());
    setStepIndex(0);
  }, [dispatch]);

  const onToggleTutorialEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      dispatch(setTutorialEnabled(e.target.checked));
    },
    [dispatch]
  );

  if (!currentStep) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex alignItems="center" justifyContent="space-between" me={8}>
            <Heading size="sm">{t('tutorial.title')}</Heading>
            <Badge>{t('tutorial.progress', { current: safeStepIndex + 1, total: totalSteps })}</Badge>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex flexDir="column" gap={4}>
            <Text fontSize="sm" variant="subtext">
              {t('tutorial.completedCount', { done: doneCount, total: totalSteps })}
            </Text>
            <Divider />
            <Heading size="sm">{t(currentStep.titleKey)}</Heading>
            <Text>{t(currentStep.bodyKey)}</Text>
            <Button onClick={onGoToStep} colorScheme="invokeBlue" alignSelf="flex-start">
              {t('tutorial.goToStep')}
            </Button>
            <Divider />
            <Checkbox isChecked={tutorialEnabled} onChange={onToggleTutorialEnabled}>
              {t('tutorial.enableOnStartup')}
            </Checkbox>
          </Flex>
        </ModalBody>
        <ModalFooter>
          <Flex w="full" justifyContent="space-between">
            <Button variant="ghost" onClick={onResetProgress}>
              {t('tutorial.resetProgress')}
            </Button>
            <Flex gap={2}>
              <Button variant="outline" onClick={onPrevious} isDisabled={stepIndex === 0}>
                {t('tutorial.previous')}
              </Button>
              <Button onClick={onNext} colorScheme="invokeBlue">
                {safeStepIndex === TUTORIAL_STEPS.length - 1 ? t('tutorial.finish') : t('tutorial.next')}
              </Button>
            </Flex>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
});

TutorialCoach.displayName = 'TutorialCoach';
