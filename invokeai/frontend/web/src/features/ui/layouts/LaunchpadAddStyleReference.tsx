import { Button, Flex, Heading, Icon, Text } from '@invoke-ai/ui-library';
import { useAppSelector, useAppStore } from 'app/store/storeHooks';
import { useImageUploadButton } from 'common/hooks/useImageUploadButton';
import { getDefaultRefImageConfig } from 'features/controlLayers/hooks/addLayerHooks';
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
} from 'features/controlLayers/store/refImagesSlice';
import { imageDTOToCroppableImage } from 'features/controlLayers/store/util';
import { addGlobalReferenceImageDndTarget } from 'features/dnd/dnd';
import { DndDropTarget } from 'features/dnd/DndDropTarget';
import { selectLastSelectedItem } from 'features/gallery/store/gallerySelectors';
import { zModelIdentifierField } from 'features/nodes/types/common';
import { toast } from 'features/toast/toast';
import { LaunchpadButton } from 'features/ui/layouts/LaunchpadButton';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiUploadBold, PiUserCircleGearBold } from 'react-icons/pi';
import { useImageDTO } from 'services/api/endpoints/images';
import { modelConfigsAdapterSelectors, selectModelConfigsQuery } from 'services/api/endpoints/models';
import type { ImageDTO } from 'services/api/types';
import { isNonRefinerMainModelConfig } from 'services/api/types';

const dndTargetData = addGlobalReferenceImageDndTarget.getData();

export const LaunchpadAddStyleReference = memo((props: { extraAction?: () => void }) => {
  const { t } = useTranslation();
  const { dispatch, getState } = useAppStore();
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
      id: 'CHARACTER_CONSISTENCY_AUTOSWITCH_MODEL_LAUNCHPAD',
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
              id: 'CHARACTER_CONSISTENCY_NO_COMPATIBLE_REF_MODEL_LAUNCHPAD_UPLOAD',
              title: t('controlLayers.characterConsistencyNoCompatibleRefModel'),
              status: 'error',
            });
            return;
          }
          config.image = imageDTOToCroppableImage(imageDTO);
          const action = dispatch(refImageAdded({ overrides: { config } }));
          applyCharacterConsistencyPreset(action.payload.id);
          toast({
            id: 'CHARACTER_CONSISTENCY_PRESET_APPLIED_ON_UPLOAD_LAUNCHPAD',
            title: t('controlLayers.characterConsistencyPresetApplied'),
            status: 'success',
          });
          props.extraAction?.();
        },
        allowMultiple: false,
      }) as const,
    [applyCharacterConsistencyPreset, dispatch, getCompatibleRefConfig, props, t]
  );

  const uploadApi = useImageUploadButton(uploadOptions);

  const applyFromSelectedGallery = useCallback(() => {
    if (!selectedGalleryImage) {
      toast({
        id: 'CHARACTER_CONSISTENCY_NO_SELECTION_LAUNCHPAD',
        title: t('controlLayers.characterConsistencyNeedsGallerySelection'),
        status: 'warning',
      });
      return;
    }

    const config = getCompatibleRefConfig();
    if (!config) {
      toast({
        id: 'CHARACTER_CONSISTENCY_NO_COMPATIBLE_REF_MODEL_LAUNCHPAD_GALLERY',
        title: t('controlLayers.characterConsistencyNoCompatibleRefModel'),
        status: 'error',
      });
      return;
    }
    config.image = imageDTOToCroppableImage(selectedGalleryImage);
    const action = dispatch(refImageAdded({ overrides: { config } }));
    applyCharacterConsistencyPreset(action.payload.id);
    props.extraAction?.();

    toast({
      id: 'CHARACTER_CONSISTENCY_FROM_GALLERY_APPLIED_LAUNCHPAD',
      title: t('controlLayers.characterConsistencyPresetAppliedFromGallery'),
      status: 'success',
    });
  }, [applyCharacterConsistencyPreset, dispatch, getCompatibleRefConfig, props, selectedGalleryImage, t]);

  return (
    <Flex flexDir="column" gap={2} w="full">
      <LaunchpadButton {...uploadApi.getUploadButtonProps()} position="relative" gap={8}>
        <Icon as={PiUserCircleGearBold} boxSize={8} color="base.500" />
        <Flex flexDir="column" alignItems="flex-start" gap={2}>
          <Heading size="sm">{t('ui.launchpad.addStyleRef.title')}</Heading>
          <Text>{t('ui.launchpad.addStyleRef.description')}</Text>
        </Flex>
        <Flex position="absolute" right={3} bottom={3}>
          <PiUploadBold />
          <input {...uploadApi.getUploadInputProps()} />
        </Flex>
        <DndDropTarget dndTarget={addGlobalReferenceImageDndTarget} dndTargetData={dndTargetData} label="Drop" />
      </LaunchpadButton>
      <Button
        size="sm"
        variant="outline"
        colorScheme="invokeBlue"
        onClick={applyFromSelectedGallery}
      >
        {t('controlLayers.characterConsistencyAction')}
      </Button>
    </Flex>
  );
});

LaunchpadAddStyleReference.displayName = 'LaunchpadAddStyleReference';
