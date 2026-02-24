import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Image,
  Input,
  Progress,
  Select,
  Text,
  Textarea,
} from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useAppSelector } from 'app/store/storeHooks';
import { useGalleryImageNames } from 'features/gallery/components/use-gallery-image-names';
import { selectLastSelectedItem } from 'features/gallery/store/gallerySelectors';
import { toast } from 'features/toast/toast';
import { useIsMobileLayout } from 'features/ui/hooks/useIsMobileLayout';
import { $videoReferenceInbox, clearVideoReferenceInbox } from 'features/video/store/videoReferenceInboxStore';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImageDTO } from 'services/api/endpoints/images';
/* eslint-disable react/jsx-no-bind */
import {
  buildVideosUrl,
  useAttachVideoReferencesMutation,
  useCancelVideoJobMutation,
  useCreateVideoProfileMutation,
  useDeleteVideoProfileMutation,
  useGenerateVideoMutation,
  useListVideoJobsQuery,
  useListVideoProfilesQuery,
  useListVideosQuery,
  useUpdateVideoProfileMutation,
  type VideoGenerationLock,
  type VideoJob,
  type VideoJobStatus,
} from 'services/api/endpoints/videos';

const statusColorScheme: Record<VideoJobStatus, string> = {
  waiting: 'yellow',
  running: 'blue',
  encoding: 'purple',
  completed: 'green',
  error: 'red',
  cancelled: 'gray',
};

const statusLabelKey: Record<VideoJobStatus, string> = {
  waiting: 'videoTab.jobs.status.waiting',
  running: 'videoTab.jobs.status.running',
  encoding: 'videoTab.jobs.status.encoding',
  completed: 'videoTab.jobs.status.completed',
  error: 'videoTab.jobs.status.error',
  cancelled: 'videoTab.jobs.status.cancelled',
};

const parseImageNames = (input: string): string[] => {
  return Array.from(
    new Set(
      input
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => s.split(/[\\/]/).at(-1) ?? s)
    )
  );
};

const getStrictCharacterPreset = (): VideoGenerationLock => ({
  strict_lock: true,
  seed_jitter: 0,
  reference_weight: 1.0,
  seed_strategy: 'fixed',
});

const getErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const maybeError = error as { data?: { detail?: string } };
  return maybeError.data?.detail ?? null;
};

type MobileVideoSection = 'profile' | 'generation' | 'jobs';

export const VideoTab = memo(() => {
  const { t } = useTranslation();
  const isMobileLayout = useIsMobileLayout();
  const { data: profiles = [] } = useListVideoProfilesQuery();
  const { data: jobs = [] } = useListVideoJobsQuery(undefined, { pollingInterval: 2000 });
  const { data: videos = [] } = useListVideosQuery(undefined, { pollingInterval: 3000 });
  const { imageNames } = useGalleryImageNames();
  const selectedGalleryImageName = useAppSelector(selectLastSelectedItem);
  const selectedGalleryImage = useImageDTO(selectedGalleryImageName);
  const inboxReferences = useStore($videoReferenceInbox);

  const [createProfile, { isLoading: isCreatingProfile }] = useCreateVideoProfileMutation();
  const [updateProfile, { isLoading: isSavingProfile }] = useUpdateVideoProfileMutation();
  const [deleteProfile] = useDeleteVideoProfileMutation();
  const [attachReferences, { isLoading: isSavingReferences }] = useAttachVideoReferencesMutation();
  const [generateVideo, { isLoading: isGenerating }] = useGenerateVideoMutation();
  const [cancelVideoJob] = useCancelVideoJobMutation();

  const [newProfileName, setNewProfileName] = useState('Character 01');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [mode, setMode] = useState<'fictional' | 'real_identity'>('fictional');
  const [consentChecked, setConsentChecked] = useState(false);
  const [referenceImageNames, setReferenceImageNames] = useState<string[]>([]);
  const [referencesInput, setReferencesInput] = useState('');
  const [showManualReferenceEditor, setShowManualReferenceEditor] = useState(false);
  const [imageToAdd, setImageToAdd] = useState('');
  const [generationLockInput, setGenerationLockInput] = useState(JSON.stringify(getStrictCharacterPreset(), null, 2));

  const [prompt, setPrompt] = useState('cinematic medium shot, gentle movement, natural lighting');
  const [negativePrompt, setNegativePrompt] = useState(
    'distorted face, low quality, blurry, deformed eyes, bad anatomy'
  );
  const [durationSec, setDurationSec] = useState(6);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);

  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [mobileSection, setMobileSection] = useState<MobileVideoSection>('generation');

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [selectedVideoId, videos]
  );

  useEffect(() => {
    if (!imageToAdd && imageNames[0]) {
      setImageToAdd(imageNames[0]);
    }
  }, [imageNames, imageToAdd]);

  useEffect(() => {
    const firstProfile = profiles[0];
    if (!selectedProfileId && firstProfile) {
      setSelectedProfileId(firstProfile.id);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    const firstVideo = videos[0];
    if (!selectedVideoId && firstVideo) {
      setSelectedVideoId(firstVideo.id);
    }
  }, [selectedVideoId, videos]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    setMode(selectedProfile.mode);
    setConsentChecked(selectedProfile.consent_checked);
    setReferenceImageNames(selectedProfile.reference_images);
    setReferencesInput(selectedProfile.reference_images.join('\n'));
    setGenerationLockInput(JSON.stringify(selectedProfile.generation_lock ?? {}, null, 2));
  }, [selectedProfile]);

  useEffect(() => {
    if (inboxReferences.length === 0) {
      return;
    }
    setReferenceImageNames((prev) => Array.from(new Set([...prev, ...inboxReferences])));
    clearVideoReferenceInbox();
  }, [inboxReferences]);

  const parseGenerationLockInput = (): VideoGenerationLock | null => {
    try {
      return JSON.parse(generationLockInput) as VideoGenerationLock;
    } catch {
      toast({
        id: 'VIDEO_PROFILE_LOCK_INVALID',
        title: t('videoTab.toasts.invalidGenerationLock'),
        status: 'error',
      });
      return null;
    }
  };

  const upsertReferenceImageName = (imageName: string | null | undefined) => {
    if (!imageName) {
      return;
    }
    const sanitized = imageName.split(/[\\/]/).at(-1) ?? imageName;
    setReferenceImageNames((prev) => (prev.includes(sanitized) ? prev : [...prev, sanitized]));
  };

  const removeReferenceImageName = (imageName: string) => {
    setReferenceImageNames((prev) => prev.filter((name) => name !== imageName));
  };

  const moveReferenceImageName = (index: number, direction: 'up' | 'down') => {
    setReferenceImageNames((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      const currentValue = next[index];
      const targetValue = next[target];
      if (!currentValue || !targetValue) {
        return prev;
      }
      next[index] = targetValue;
      next[target] = currentValue;
      return next;
    });
  };

  const applyStrictCharacterPreset = () => {
    setGenerationLockInput(JSON.stringify(getStrictCharacterPreset(), null, 2));
    setDurationSec(6);
    setFps(12);
    setWidth(1280);
    setHeight(720);
    setNegativePrompt('distorted face, low quality, blurry, deformed eyes, bad anatomy, extra fingers');
    toast({
      id: 'VIDEO_PRESET_APPLIED',
      title: t('videoTab.toasts.strictPresetApplied'),
      status: 'success',
    });
  };

  const createProfileHandler = async () => {
    const name = newProfileName.trim();
    if (!name) {
      toast({ id: 'VIDEO_PROFILE_NAME_REQUIRED', title: t('videoTab.toasts.profileNameRequired'), status: 'error' });
      return;
    }

    const generationLock = parseGenerationLockInput();
    if (!generationLock) {
      return;
    }

    try {
      const created = await createProfile({
        name,
        mode,
        consent_checked: consentChecked,
        generation_lock: generationLock,
      }).unwrap();
      setSelectedProfileId(created.id);
      toast({ id: 'VIDEO_PROFILE_CREATED', title: t('videoTab.toasts.profileCreated'), status: 'success' });
    } catch (error) {
      toast({
        id: 'VIDEO_PROFILE_CREATE_FAILED',
        title: getErrorMessage(error) ?? t('videoTab.toasts.profileCreateFailed'),
        status: 'error',
      });
    }
  };

  const saveProfileHandler = async () => {
    if (!selectedProfileId) {
      return;
    }
    const generationLock = parseGenerationLockInput();
    if (!generationLock) {
      return;
    }

    try {
      await updateProfile({
        profileId: selectedProfileId,
        changes: {
          mode,
          consent_checked: consentChecked,
          generation_lock: generationLock,
        },
      }).unwrap();
      toast({ id: 'VIDEO_PROFILE_SAVED', title: t('videoTab.toasts.profileSaved'), status: 'success' });
    } catch (error) {
      toast({
        id: 'VIDEO_PROFILE_SAVE_FAILED',
        title: getErrorMessage(error) ?? t('videoTab.toasts.profileSaveFailed'),
        status: 'error',
      });
    }
  };

  const saveReferencesHandler = async () => {
    if (!selectedProfileId) {
      return;
    }

    try {
      await attachReferences({ profileId: selectedProfileId, image_names: referenceImageNames }).unwrap();
      setReferencesInput(referenceImageNames.join('\n'));
      toast({ id: 'VIDEO_PROFILE_REFS_SAVED', title: t('videoTab.toasts.referencesSaved'), status: 'success' });
    } catch (error) {
      toast({
        id: 'VIDEO_PROFILE_REFS_FAILED',
        title: getErrorMessage(error) ?? t('videoTab.toasts.referencesSaveFailed'),
        status: 'error',
      });
    }
  };

  const deleteSelectedProfileHandler = async () => {
    if (!selectedProfileId) {
      return;
    }

    try {
      await deleteProfile(selectedProfileId).unwrap();
      setSelectedProfileId('');
      toast({ id: 'VIDEO_PROFILE_DELETED', title: t('videoTab.toasts.profileDeleted'), status: 'success' });
    } catch {
      toast({ id: 'VIDEO_PROFILE_DELETE_FAILED', title: t('videoTab.toasts.profileDeleteFailed'), status: 'error' });
    }
  };

  const generateVideoHandler = async () => {
    if (!selectedProfileId) {
      toast({ id: 'VIDEO_GENERATE_NO_PROFILE', title: t('videoTab.toasts.selectProfileFirst'), status: 'error' });
      return;
    }

    try {
      await generateVideo({
        profile_id: selectedProfileId,
        prompt,
        negative_prompt: negativePrompt,
        duration_sec: durationSec,
        fps,
        width,
        height,
      }).unwrap();
      toast({ id: 'VIDEO_JOB_QUEUED', title: t('videoTab.toasts.jobQueued'), status: 'success' });
    } catch (error) {
      toast({
        id: 'VIDEO_JOB_FAILED',
        title: getErrorMessage(error) ?? t('videoTab.toasts.jobFailed'),
        status: 'error',
      });
    }
  };

  const applyManualReferencesHandler = () => {
    const parsed = parseImageNames(referencesInput);
    setReferenceImageNames(parsed);
    toast({ id: 'VIDEO_MANUAL_REFS_APPLIED', title: t('videoTab.toasts.manualReferencesApplied'), status: 'info' });
  };

  const lastCompletedVideoFromJobs = useMemo(() => {
    const completed = jobs.find((job) => job.status === 'completed' && job.output_video_id);
    if (!completed?.output_video_id) {
      return null;
    }
    return videos.find((video) => video.id === completed.output_video_id) ?? null;
  }, [jobs, videos]);

  useEffect(() => {
    if (lastCompletedVideoFromJobs && lastCompletedVideoFromJobs.id !== selectedVideoId) {
      setSelectedVideoId(lastCompletedVideoFromJobs.id);
    }
  }, [lastCompletedVideoFromJobs, selectedVideoId]);

  return (
    <Flex
      w="full"
      h="full"
      gap={{ base: 2, xl: 3 }}
      p={{ base: 2, xl: 3 }}
      overflowX="hidden"
      overflowY={{ base: 'auto', xl: 'hidden' }}
      flexDir={{ base: 'column', xl: 'row' }}
    >
      {isMobileLayout && (
        <Flex gap={2} flexWrap="wrap">
          <Button
            size="sm"
            variant={mobileSection === 'generation' ? 'solid' : 'outline'}
            onClick={() => setMobileSection('generation')}
          >
            {t('videoTab.generation.heading')}
          </Button>
          <Button
            size="sm"
            variant={mobileSection === 'profile' ? 'solid' : 'outline'}
            onClick={() => setMobileSection('profile')}
          >
            {t('videoTab.profile.heading')}
          </Button>
          <Button size="sm" variant={mobileSection === 'jobs' ? 'solid' : 'outline'} onClick={() => setMobileSection('jobs')}>
            {t('videoTab.jobs.heading')}
          </Button>
        </Flex>
      )}
      {(!isMobileLayout || mobileSection === 'profile') && (
        <Flex
          flexDir="column"
          w={{ base: 'full', xl: '26rem' }}
          minW={0}
          h={{ base: 'auto', xl: 'full' }}
          borderRadius="base"
          borderWidth={1}
          p={3}
          gap={3}
          overflowY={{ base: 'visible', xl: 'auto' }}
        >
        <Heading size="sm">{t('videoTab.profile.heading')}</Heading>
        <Text variant="subtext">{t('videoTab.profile.description')}</Text>

        <Button onClick={applyStrictCharacterPreset} variant="outline" colorScheme="invokeBlue">
          {t('videoTab.profile.applyStrictPreset')}
        </Button>

        <FormControl>
          <FormLabel mb={1}>{t('videoTab.profile.createProfile')}</FormLabel>
          <Input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder={t('videoTab.profile.profileNamePlaceholder')}
          />
        </FormControl>

        <FormControl>
          <FormLabel mb={1}>{t('videoTab.profile.identityMode')}</FormLabel>
          <Select value={mode} onChange={(e) => setMode(e.target.value as 'fictional' | 'real_identity')}>
            <option value="fictional">{t('videoTab.profile.mode.fictional')}</option>
            <option value="real_identity">{t('videoTab.profile.mode.realIdentity')}</option>
          </Select>
        </FormControl>

        <Checkbox isChecked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)}>
          {t('videoTab.profile.consentConfirmed')}
        </Checkbox>

        <Button onClick={createProfileHandler} isLoading={isCreatingProfile} colorScheme="invokeBlue">
          {t('videoTab.profile.createProfileAction')}
        </Button>

        <Divider />

        <FormControl>
          <FormLabel mb={1}>{t('videoTab.profile.selectProfile')}</FormLabel>
          <Select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <Heading size="xs">{t('videoTab.references.heading')}</Heading>
        <Text variant="subtext">{t('videoTab.references.description')}</Text>

        <Flex gap={2}>
          <Button
            flex={1}
            onClick={() => upsertReferenceImageName(selectedGalleryImageName)}
            isDisabled={!selectedGalleryImageName}
          >
            {t('videoTab.references.useSelectedFromGallery')}
          </Button>
          <Button
            flex={1}
            variant="outline"
            onClick={() => upsertReferenceImageName(imageToAdd)}
            isDisabled={!imageToAdd}
          >
            {t('videoTab.references.addFromList')}
          </Button>
        </Flex>

        <Select value={imageToAdd} onChange={(e) => setImageToAdd(e.target.value)}>
          {imageNames.map((imageName) => (
            <option key={imageName} value={imageName}>
              {imageName}
            </option>
          ))}
        </Select>

        {selectedGalleryImage ? (
          <Flex alignItems="center" gap={2} borderWidth={1} borderRadius="base" p={2}>
            <Image
              src={selectedGalleryImage.thumbnail_url}
              alt={selectedGalleryImage.image_name}
              boxSize="2.5rem"
              objectFit="cover"
              borderRadius="base"
            />
            <Text fontSize="xs" noOfLines={1}>
              {t('videoTab.references.currentSelection')}: {selectedGalleryImage.image_name}
            </Text>
          </Flex>
        ) : (
          <Text variant="subtext">{t('videoTab.references.noGallerySelection')}</Text>
        )}

        <Flex flexDir="column" gap={2}>
          {referenceImageNames.length === 0 ? (
            <Text variant="subtext">{t('videoTab.references.empty')}</Text>
          ) : (
            referenceImageNames.map((imageName, index) => (
              <ReferenceImageRow
                key={imageName}
                imageName={imageName}
                index={index}
                total={referenceImageNames.length}
                onMove={moveReferenceImageName}
                onRemove={removeReferenceImageName}
              />
            ))
          )}
        </Flex>

        <Button onClick={saveReferencesHandler} isLoading={isSavingReferences} isDisabled={!selectedProfileId}>
          {t('videoTab.references.saveReferences')}
        </Button>

        <Button variant="ghost" onClick={() => setShowManualReferenceEditor((v) => !v)}>
          {showManualReferenceEditor ? t('videoTab.references.hideManual') : t('videoTab.references.showManual')}
        </Button>

        {showManualReferenceEditor && (
          <Flex flexDir="column" gap={2}>
            <FormControl>
              <FormLabel mb={1}>{t('videoTab.references.manualLabel')}</FormLabel>
              <Textarea
                value={referencesInput}
                onChange={(e) => setReferencesInput(e.target.value)}
                minH={20}
                placeholder={t('videoTab.references.manualPlaceholder')}
              />
            </FormControl>
            <Button variant="outline" onClick={applyManualReferencesHandler}>
              {t('videoTab.references.applyManual')}
            </Button>
          </Flex>
        )}

        <FormControl>
          <FormLabel mb={1}>{t('videoTab.profile.generationLock')}</FormLabel>
          <Textarea value={generationLockInput} onChange={(e) => setGenerationLockInput(e.target.value)} minH={24} />
        </FormControl>

        <Flex gap={2}>
          <Button flex={1} onClick={saveProfileHandler} isLoading={isSavingProfile}>
            {t('videoTab.profile.saveSettings')}
          </Button>
          <Button
            flex={1}
            onClick={deleteSelectedProfileHandler}
            colorScheme="red"
            variant="outline"
            isDisabled={!selectedProfileId}
          >
            {t('videoTab.profile.deleteProfile')}
          </Button>
        </Flex>
      </Flex>
      )}

      {(!isMobileLayout || mobileSection === 'generation') && (
      <Flex
        flexDir="column"
        flex={1}
        minW={0}
        h={{ base: 'auto', xl: 'full' }}
        borderRadius="base"
        borderWidth={1}
        p={3}
        gap={3}
        overflowY={{ base: 'visible', xl: 'auto' }}
      >
        <Heading size="sm">{t('videoTab.generation.heading')}</Heading>
        <Text variant="subtext">{t('videoTab.generation.description')}</Text>

        <Flex gap={3} flexWrap="wrap">
          <FormControl maxW="22rem">
            <FormLabel mb={1}>{t('videoTab.generation.prompt')}</FormLabel>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} minH={20} />
          </FormControl>

          <FormControl maxW="22rem">
            <FormLabel mb={1}>{t('videoTab.generation.negativePrompt')}</FormLabel>
            <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} minH={20} />
          </FormControl>
        </Flex>

        <Flex gap={3} flexWrap="wrap">
          <FormControl maxW="8rem">
            <FormLabel mb={1}>{t('videoTab.generation.duration')}</FormLabel>
            <Input type="number" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="8rem">
            <FormLabel mb={1}>{t('videoTab.generation.fps')}</FormLabel>
            <Input type="number" value={fps} onChange={(e) => setFps(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="10rem">
            <FormLabel mb={1}>{t('videoTab.generation.width')}</FormLabel>
            <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="10rem">
            <FormLabel mb={1}>{t('videoTab.generation.height')}</FormLabel>
            <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </FormControl>
        </Flex>

        <Button onClick={generateVideoHandler} isLoading={isGenerating} colorScheme="invokeYellow" maxW="16rem">
          {t('videoTab.generation.generateButton')}
        </Button>

        <Divider />

        <Heading size="sm">{t('videoTab.player.heading')}</Heading>
        <Box borderWidth={1} borderRadius="base" p={2} minH={{ base: '14rem', xl: '20rem' }}>
          {selectedVideo ? (
            <video
              controls
              src={buildVideosUrl(`${selectedVideo.id}/file`)}
              style={{ width: '100%', maxHeight: '28rem', borderRadius: '8px', background: '#111' }}
            />
          ) : (
            <Text variant="subtext">{t('videoTab.player.empty')}</Text>
          )}
        </Box>

        <Heading size="sm">{t('videoTab.gallery.heading')}</Heading>
        <Flex flexWrap="wrap" gap={2}>
          {videos.map((video) => (
            <Button
              key={video.id}
              size="sm"
              variant={video.id === selectedVideo?.id ? 'solid' : 'outline'}
              onClick={() => setSelectedVideoId(video.id)}
            >
              {video.filename}
            </Button>
          ))}
        </Flex>
      </Flex>
      )}

      {(!isMobileLayout || mobileSection === 'jobs') && (
        <Flex
          flexDir="column"
          w={{ base: 'full', xl: '24rem' }}
          minW={0}
          h={{ base: 'auto', xl: 'full' }}
          borderRadius="base"
          borderWidth={1}
          p={3}
          gap={3}
          overflowY={{ base: 'visible', xl: 'auto' }}
        >
        <Heading size="sm">{t('videoTab.jobs.heading')}</Heading>
        {jobs.length === 0 && <Text variant="subtext">{t('videoTab.jobs.empty')}</Text>}

        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onCancel={async () => {
              try {
                await cancelVideoJob(job.id).unwrap();
              } catch {
                toast({
                  id: `VIDEO_CANCEL_FAILED_${job.id}`,
                  title: t('videoTab.toasts.cancelJobFailed'),
                  status: 'error',
                });
              }
            }}
            onOpenVideo={(videoId) => setSelectedVideoId(videoId)}
          />
        ))}
      </Flex>
      )}
    </Flex>
  );
});

VideoTab.displayName = 'VideoTab';

const ReferenceImageRow = ({
  imageName,
  index,
  total,
  onMove,
  onRemove,
}: {
  imageName: string;
  index: number;
  total: number;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onRemove: (imageName: string) => void;
}) => {
  const image = useImageDTO(imageName);
  const { t } = useTranslation();

  return (
    <Flex borderWidth={1} borderRadius="base" p={2} gap={2} alignItems="center">
      <Box boxSize="2.5rem" borderRadius="base" overflow="hidden" bg="base.800" flexShrink={0}>
        {image ? <Image src={image.thumbnail_url} alt={image.image_name} boxSize="2.5rem" objectFit="cover" /> : null}
      </Box>
      <Text fontSize="xs" noOfLines={1} flex={1}>
        {imageName}
      </Text>
      <Button size="xs" variant="ghost" onClick={() => onMove(index, 'up')} isDisabled={index === 0}>
        {t('videoTab.references.up')}
      </Button>
      <Button size="xs" variant="ghost" onClick={() => onMove(index, 'down')} isDisabled={index === total - 1}>
        {t('videoTab.references.down')}
      </Button>
      <Button size="xs" colorScheme="red" variant="ghost" onClick={() => onRemove(imageName)}>
        {t('videoTab.references.remove')}
      </Button>
    </Flex>
  );
};

const JobCard = ({
  job,
  onCancel,
  onOpenVideo,
}: {
  job: VideoJob;
  onCancel: () => void;
  onOpenVideo: (videoId: string) => void;
}) => {
  const { t } = useTranslation();
  const canCancel = job.status === 'waiting' || job.status === 'running' || job.status === 'encoding';

  return (
    <Flex borderWidth={1} borderRadius="base" p={2} flexDir="column" gap={2}>
      <Flex justifyContent="space-between" alignItems="center" gap={2}>
        <Text fontSize="sm" noOfLines={1}>
          {job.id}
        </Text>
        <Badge colorScheme={statusColorScheme[job.status]}>{t(statusLabelKey[job.status])}</Badge>
      </Flex>

      <Progress value={job.progress} max={100} size="xs" borderRadius="full" colorScheme="invokeBlue" />

      {job.error ? (
        <Text fontSize="xs" color="error.400" noOfLines={4}>
          {job.error}
        </Text>
      ) : null}

      <Flex gap={2}>
        <Button size="xs" variant="outline" onClick={onCancel} isDisabled={!canCancel}>
          {t('videoTab.jobs.cancel')}
        </Button>
        <Button
          size="xs"
          onClick={() => {
            if (job.output_video_id) {
              onOpenVideo(job.output_video_id);
            }
          }}
          isDisabled={!job.output_video_id}
        >
          {t('videoTab.jobs.openVideo')}
        </Button>
      </Flex>
    </Flex>
  );
};
