import { Button, Collapse, Divider, Flex, IconButton } from '@invoke-ai/ui-library';
import { useAppSelector, useAppStore } from 'app/store/storeHooks';
import { useImageUploadButton } from 'common/hooks/useImageUploadButton';
import { RefImagePreview } from 'features/controlLayers/components/RefImage/RefImagePreview';
import { CanvasManagerProviderGate } from 'features/controlLayers/contexts/CanvasManagerProviderGate';
import { RefImageIdContext } from 'features/controlLayers/contexts/RefImageIdContext';
import { getDefaultRefImageConfig } from 'features/controlLayers/hooks/addLayerHooks';
import { useNewGlobalReferenceImageFromBbox } from 'features/controlLayers/hooks/saveCanvasHooks';
import { useCanvasIsBusySafe } from 'features/controlLayers/hooks/useCanvasIsBusy';
import {
  modelChanged,
  negativePromptChanged,
  positivePromptChanged,
  setCfgScale,
  setGuidance,
  setSeed,
  setShouldRandomizeSeed,
  setSteps,
  sizeRecalled,
} from 'features/controlLayers/store/paramsSlice';
import {
  refImageAdded,
  refImageIPAdapterBeginEndStepPctChanged,
  refImageIPAdapterMethodChanged,
  refImageIPAdapterWeightChanged,
  selectIsRefImagePanelOpen,
  selectRefImageEntityIds,
  selectSelectedRefEntityId,
} from 'features/controlLayers/store/refImagesSlice';
import { imageDTOToCroppableImage } from 'features/controlLayers/store/util';
import { addGlobalReferenceImageDndTarget } from 'features/dnd/dnd';
import { DndDropTarget } from 'features/dnd/DndDropTarget';
import { selectLastSelectedItem } from 'features/gallery/store/gallerySelectors';
import { zModelIdentifierField } from 'features/nodes/types/common';
import { toast } from 'features/toast/toast';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiBoundingBoxBold, PiUploadBold } from 'react-icons/pi';
import { useImageDTO } from 'services/api/endpoints/images';
import { modelConfigsAdapterSelectors, selectModelConfigsQuery } from 'services/api/endpoints/models';
import type { ImageDTO } from 'services/api/types';
import { isNonRefinerMainModelConfig } from 'services/api/types';

import { RefImageHeader } from './RefImageHeader';
import { RefImageSettings } from './RefImageSettings';

export const RefImageList = memo(() => {
  const ids = useAppSelector(selectRefImageEntityIds);
  const isPanelOpen = useAppSelector(selectIsRefImagePanelOpen);
  const selectedEntityId = useAppSelector(selectSelectedRefEntityId);

  return (
    <Flex flexDir="column">
      <Flex gap={2} h={16}>
        {ids.map((id) => (
          <RefImageIdContext.Provider key={id} value={id}>
            <RefImagePreview />
          </RefImageIdContext.Provider>
        ))}
        {ids.length < 5 && <AddRefImageDropTargetAndButton />}
        {ids.length >= 5 && <MaxRefImages />}
      </Flex>
      <CharacterConsistencyQuickAction />
      <Collapse in={isPanelOpen}>
        <Flex pt={2} w="full">
          {selectedEntityId !== null && (
            <RefImageIdContext.Provider value={selectedEntityId}>
              <Flex flexDir="column" gap={2} w="full" h="full" borderRadius="base" bg="base.800" p={2}>
                <RefImageHeader />
                <Divider />
                <RefImageSettings />
              </Flex>
            </RefImageIdContext.Provider>
          )}
        </Flex>
      </Collapse>
    </Flex>
  );
});

RefImageList.displayName = 'RefImageList';

const dndTargetData = addGlobalReferenceImageDndTarget.getData();

const MaxRefImages = memo(() => {
  const { t } = useTranslation();
  return (
    <Button
      position="relative"
      size="sm"
      variant="ghost"
      h="full"
      w="full"
      borderWidth="2px !important"
      borderStyle="dashed !important"
      borderRadius="base"
      isDisabled
    >
      {t('controlLayers.maxRefImages')}
    </Button>
  );
});
MaxRefImages.displayName = 'MaxRefImages';

const AddRefImageDropTargetAndButton = memo(() => {
  const { dispatch, getState } = useAppStore();
  const { t } = useTranslation();
  const tab = useAppSelector(selectActiveTab);

  const getCompatibleRefConfig = useCallback(() => {
    let config = getDefaultRefImageConfig(getState);
    if (config.type !== 'ip_adapter' || config.model) {
      return config;
    }

    const state = getState();
    const query = selectModelConfigsQuery(state);
    if (!query.data) {
      return null;
    }

    const compatibleMainModel = modelConfigsAdapterSelectors
      .selectAll(query.data)
      .find((modelConfig) => isNonRefinerMainModelConfig(modelConfig) && modelConfig.base === 'sd-1');

    if (!compatibleMainModel) {
      return null;
    }

    dispatch(
      modelChanged({
        model: zModelIdentifierField.parse(compatibleMainModel),
        previousModel: state.params.model,
      })
    );

    config = getDefaultRefImageConfig(getState);
    if (config.type === 'ip_adapter' && !config.model) {
      return null;
    }

    toast({
      id: 'CHARACTER_CONSISTENCY_AUTOSWITCH_MODEL_REF_LIST',
      title: t('controlLayers.characterConsistencyModelAutoSwitched', { modelName: compatibleMainModel.name }),
      status: 'info',
    });

    return config;
  }, [dispatch, getState, t]);

  const applyCharacterConsistencyPreset = useCallback(
    (referenceImageId: string) => {
      const state = getState();
      const currentPositivePrompt = state.params.positivePrompt;
      const currentNegativePrompt = state.params.negativePrompt ?? '';
      const identityLockPositive = 'same character, same face, consistent identity';
      const identityLockNegative =
        'different person, face drift, identity drift, deformed face, asymmetrical eyes, extra eyes';

      const appendIfMissing = (prompt: string, fragment: string) => {
        const normalizedPrompt = prompt.toLowerCase();
        const normalizedFragment = fragment.toLowerCase();
        if (normalizedPrompt.includes(normalizedFragment)) {
          return prompt;
        }
        if (!prompt.trim().length) {
          return fragment;
        }
        return `${prompt.trim()}, ${fragment}`;
      };

      dispatch(setShouldRandomizeSeed(false));
      dispatch(setSeed(424242));
      dispatch(setSteps(18));
      dispatch(setCfgScale(5));
      dispatch(setGuidance(4));
      dispatch(sizeRecalled({ width: 768, height: 1024 }));
      dispatch(positivePromptChanged(appendIfMissing(currentPositivePrompt, identityLockPositive)));
      dispatch(negativePromptChanged(appendIfMissing(currentNegativePrompt, identityLockNegative)));

      dispatch(refImageIPAdapterMethodChanged({ id: referenceImageId, method: 'full' }));
      dispatch(refImageIPAdapterWeightChanged({ id: referenceImageId, weight: 1.2 }));
      dispatch(refImageIPAdapterBeginEndStepPctChanged({ id: referenceImageId, beginEndStepPct: [0, 0.9] }));
    },
    [dispatch, getState]
  );

  const uploadOptions = useMemo(
    () =>
      ({
        onUpload: (imageDTO: ImageDTO) => {
          const config = getCompatibleRefConfig();
          if (!config) {
            toast({
              id: 'CHARACTER_CONSISTENCY_NO_COMPATIBLE_REF_MODEL_UPLOAD',
              title: t('controlLayers.characterConsistencyNoCompatibleRefModel'),
              status: 'error',
            });
            return;
          }
          config.image = imageDTOToCroppableImage(imageDTO);
          const action = dispatch(refImageAdded({ overrides: { config } }));
          applyCharacterConsistencyPreset(action.payload.id);
          toast({
            id: 'CHARACTER_CONSISTENCY_PRESET_APPLIED_ON_UPLOAD',
            title: t('controlLayers.characterConsistencyPresetApplied'),
            status: 'success',
          });
        },
        allowMultiple: false,
      }) as const,
    [applyCharacterConsistencyPreset, dispatch, getCompatibleRefConfig, t]
  );

  const uploadApi = useImageUploadButton(uploadOptions);

  return (
    <Flex gap={1} h="full" w="full">
      <Button
        position="relative"
        size="sm"
        variant="ghost"
        h="full"
        w="full"
        borderWidth="2px !important"
        borderStyle="dashed !important"
        borderRadius="base"
        leftIcon={<PiUploadBold />}
        {...uploadApi.getUploadButtonProps()}
      >
        {t('controlLayers.referenceImage')}
        <input {...uploadApi.getUploadInputProps()} />
        <DndDropTarget label="Drop" dndTarget={addGlobalReferenceImageDndTarget} dndTargetData={dndTargetData} />
      </Button>
      {tab === 'canvas' && (
        <CanvasManagerProviderGate>
          <BboxButton />
        </CanvasManagerProviderGate>
      )}
    </Flex>
  );
});
AddRefImageDropTargetAndButton.displayName = 'AddRefImageDropTargetAndButton';

const CharacterConsistencyQuickAction = memo(() => {
  const { dispatch, getState } = useAppStore();
  const { t } = useTranslation();
  const selectedGalleryImageName = useAppSelector(selectLastSelectedItem);
  const selectedGalleryImage = useImageDTO(selectedGalleryImageName);

  const getCompatibleRefConfig = useCallback(() => {
    let config = getDefaultRefImageConfig(getState);
    if (config.type !== 'ip_adapter' || config.model) {
      return config;
    }

    const state = getState();
    const query = selectModelConfigsQuery(state);
    if (!query.data) {
      return null;
    }

    const compatibleMainModel = modelConfigsAdapterSelectors
      .selectAll(query.data)
      .find((modelConfig) => isNonRefinerMainModelConfig(modelConfig) && modelConfig.base === 'sd-1');

    if (!compatibleMainModel) {
      return null;
    }

    dispatch(
      modelChanged({
        model: zModelIdentifierField.parse(compatibleMainModel),
        previousModel: state.params.model,
      })
    );

    config = getDefaultRefImageConfig(getState);
    if (config.type === 'ip_adapter' && !config.model) {
      return null;
    }

    toast({
      id: 'CHARACTER_CONSISTENCY_AUTOSWITCH_MODEL_QUICK_ACTION',
      title: t('controlLayers.characterConsistencyModelAutoSwitched', { modelName: compatibleMainModel.name }),
      status: 'info',
    });

    return config;
  }, [dispatch, getState, t]);

  const applyFromSelectedGallery = useCallback(() => {
    if (!selectedGalleryImage) {
      toast({
        id: 'CHARACTER_CONSISTENCY_NO_SELECTION',
        title: t('controlLayers.characterConsistencyNeedsGallerySelection'),
        status: 'warning',
      });
      return;
    }

    const config = getCompatibleRefConfig();
    if (!config) {
      toast({
        id: 'CHARACTER_CONSISTENCY_NO_COMPATIBLE_REF_MODEL',
        title: t('controlLayers.characterConsistencyNoCompatibleRefModel'),
        status: 'error',
      });
      return;
    }
    config.image = imageDTOToCroppableImage(selectedGalleryImage);
    const action = dispatch(refImageAdded({ overrides: { config } }));
    const referenceImageId = action.payload.id;

    const state = getState();
    const currentPositivePrompt = state.params.positivePrompt;
    const currentNegativePrompt = state.params.negativePrompt ?? '';
    const identityLockPositive = 'same character, same face, consistent identity';
    const identityLockNegative =
      'different person, face drift, identity drift, deformed face, asymmetrical eyes, extra eyes';

    const appendIfMissing = (prompt: string, fragment: string) => {
      const normalizedPrompt = prompt.toLowerCase();
      const normalizedFragment = fragment.toLowerCase();
      if (normalizedPrompt.includes(normalizedFragment)) {
        return prompt;
      }
      if (!prompt.trim().length) {
        return fragment;
      }
      return `${prompt.trim()}, ${fragment}`;
    };

    dispatch(setShouldRandomizeSeed(false));
    dispatch(setSeed(424242));
    dispatch(setSteps(18));
    dispatch(setCfgScale(5));
    dispatch(setGuidance(4));
    dispatch(sizeRecalled({ width: 768, height: 1024 }));
    dispatch(positivePromptChanged(appendIfMissing(currentPositivePrompt, identityLockPositive)));
    dispatch(negativePromptChanged(appendIfMissing(currentNegativePrompt, identityLockNegative)));

    dispatch(refImageIPAdapterMethodChanged({ id: referenceImageId, method: 'full' }));
    dispatch(refImageIPAdapterWeightChanged({ id: referenceImageId, weight: 1.2 }));
    dispatch(refImageIPAdapterBeginEndStepPctChanged({ id: referenceImageId, beginEndStepPct: [0, 0.9] }));

    toast({
      id: 'CHARACTER_CONSISTENCY_FROM_GALLERY_APPLIED',
      title: t('controlLayers.characterConsistencyPresetAppliedFromGallery'),
      status: 'success',
    });
  }, [dispatch, getCompatibleRefConfig, getState, selectedGalleryImage, t]);

  return (
    <Button
      size="sm"
      mt={2}
      variant="outline"
      colorScheme="invokeBlue"
      onClick={applyFromSelectedGallery}
    >
      {t('controlLayers.characterConsistencyAction')}
    </Button>
  );
});
CharacterConsistencyQuickAction.displayName = 'CharacterConsistencyQuickAction';

const BboxButton = memo(() => {
  const { t } = useTranslation();
  const isBusy = useCanvasIsBusySafe();
  const newGlobalReferenceImageFromBbox = useNewGlobalReferenceImageFromBbox();

  return (
    <IconButton
      size="lg"
      variant="outline"
      h="full"
      icon={<PiBoundingBoxBold />}
      onClick={newGlobalReferenceImageFromBbox}
      isDisabled={isBusy}
      aria-label={t('controlLayers.pullBboxIntoReferenceImage')}
      tooltip={t('controlLayers.pullBboxIntoReferenceImage')}
    />
  );
});
BboxButton.displayName = 'BboxButton';
