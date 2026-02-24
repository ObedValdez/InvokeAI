import { MenuItem } from '@invoke-ai/ui-library';
import { useImageDTOContext } from 'features/gallery/contexts/ImageDTOContext';
import { toast } from 'features/toast/toast';
import { enqueueVideoReference } from 'features/video/store/videoReferenceInboxStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiImageBold } from 'react-icons/pi';

export const ContextMenuItemUseAsVideoReference = memo(() => {
  const { t } = useTranslation();
  const imageDTO = useImageDTOContext();

  const onClick = useCallback(() => {
    enqueueVideoReference(imageDTO.image_name);
    toast({
      id: 'VIDEO_REFERENCE_QUEUED_FROM_GALLERY',
      title: t('videoTab.toasts.referenceQueuedFromGallery'),
      status: 'success',
    });
  }, [imageDTO.image_name, t]);

  return (
    <MenuItem icon={<PiImageBold />} onClickCapture={onClick}>
      {t('videoTab.references.useAsVideoReference')}
    </MenuItem>
  );
});

ContextMenuItemUseAsVideoReference.displayName = 'ContextMenuItemUseAsVideoReference';
