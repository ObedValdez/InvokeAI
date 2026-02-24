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
  Input,
  Progress,
  Select,
  Text,
  Textarea,
} from '@invoke-ai/ui-library';
import { toast } from 'features/toast/toast';
import { memo, useEffect, useMemo, useState } from 'react';
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

const parseImageNames = (input: string): string[] => {
  return Array.from(
    new Set(
      input
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  );
};

export const VideoTab = memo(() => {
  const { data: profiles = [] } = useListVideoProfilesQuery();
  const { data: jobs = [] } = useListVideoJobsQuery(undefined, { pollingInterval: 2000 });
  const { data: videos = [] } = useListVideosQuery(undefined, { pollingInterval: 3000 });

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
  const [referencesInput, setReferencesInput] = useState('');
  const [generationLockInput, setGenerationLockInput] = useState('{"strict_lock": true}');

  const [prompt, setPrompt] = useState('cinematic medium shot, gentle movement, natural lighting');
  const [negativePrompt, setNegativePrompt] = useState('distorted face, low quality, blurry');
  const [durationSec, setDurationSec] = useState(6);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);

  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [selectedVideoId, videos]
  );

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
    setReferencesInput(selectedProfile.reference_images.join('\n'));
    setGenerationLockInput(JSON.stringify(selectedProfile.generation_lock ?? {}, null, 2));
  }, [selectedProfile]);

  const createProfileHandler = async () => {
    const name = newProfileName.trim();
    if (!name) {
      toast({ id: 'VIDEO_PROFILE_NAME_REQUIRED', title: 'Profile name is required', status: 'error' });
      return;
    }

    let generationLock: VideoGenerationLock = { strict_lock: true };
    try {
      generationLock = JSON.parse(generationLockInput) as VideoGenerationLock;
    } catch {
      toast({ id: 'VIDEO_PROFILE_LOCK_INVALID', title: 'Generation lock JSON is invalid', status: 'error' });
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
      toast({ id: 'VIDEO_PROFILE_CREATED', title: 'Video profile created', status: 'success' });
    } catch {
      toast({ id: 'VIDEO_PROFILE_CREATE_FAILED', title: 'Could not create video profile', status: 'error' });
    }
  };

  const saveProfileHandler = async () => {
    if (!selectedProfileId) {
      return;
    }

    let generationLock: VideoGenerationLock = { strict_lock: true };
    try {
      generationLock = JSON.parse(generationLockInput) as VideoGenerationLock;
    } catch {
      toast({ id: 'VIDEO_PROFILE_LOCK_INVALID_SAVE', title: 'Generation lock JSON is invalid', status: 'error' });
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
      toast({ id: 'VIDEO_PROFILE_SAVED', title: 'Profile settings saved', status: 'success' });
    } catch {
      toast({ id: 'VIDEO_PROFILE_SAVE_FAILED', title: 'Could not save profile settings', status: 'error' });
    }
  };

  const saveReferencesHandler = async () => {
    if (!selectedProfileId) {
      return;
    }

    try {
      const imageNames = parseImageNames(referencesInput);
      await attachReferences({ profileId: selectedProfileId, image_names: imageNames }).unwrap();
      toast({ id: 'VIDEO_PROFILE_REFS_SAVED', title: 'Profile references saved', status: 'success' });
    } catch {
      toast({ id: 'VIDEO_PROFILE_REFS_FAILED', title: 'Could not save references', status: 'error' });
    }
  };

  const deleteSelectedProfileHandler = async () => {
    if (!selectedProfileId) {
      return;
    }

    try {
      await deleteProfile(selectedProfileId).unwrap();
      setSelectedProfileId('');
      toast({ id: 'VIDEO_PROFILE_DELETED', title: 'Video profile deleted', status: 'success' });
    } catch {
      toast({ id: 'VIDEO_PROFILE_DELETE_FAILED', title: 'Could not delete profile', status: 'error' });
    }
  };

  const generateVideoHandler = async () => {
    if (!selectedProfileId) {
      toast({ id: 'VIDEO_GENERATE_NO_PROFILE', title: 'Select a profile first', status: 'error' });
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
      toast({ id: 'VIDEO_JOB_QUEUED', title: 'Video job queued', status: 'success' });
    } catch {
      toast({ id: 'VIDEO_JOB_FAILED', title: 'Could not queue video job', status: 'error' });
    }
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
    <Flex w="full" h="full" gap={3} p={3} overflow="hidden">
      <Flex flexDir="column" w="24rem" h="full" borderRadius="base" borderWidth={1} p={3} gap={3} overflowY="auto">
        <Heading size="sm">Character Profiles</Heading>

        <FormControl>
          <FormLabel mb={1}>Create profile</FormLabel>
          <Input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Profile name" />
        </FormControl>

        <FormControl>
          <FormLabel mb={1}>Identity mode</FormLabel>
          <Select value={mode} onChange={(e) => setMode(e.target.value as 'fictional' | 'real_identity')}>
            <option value="fictional">Fictional</option>
            <option value="real_identity">Real identity (consent required)</option>
          </Select>
        </FormControl>

        <Checkbox isChecked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)}>
          Consent confirmed
        </Checkbox>

        <Button onClick={createProfileHandler} isLoading={isCreatingProfile} colorScheme="invokeBlue">
          Create Profile
        </Button>

        <Divider />

        <FormControl>
          <FormLabel mb={1}>Select profile</FormLabel>
          <Select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel mb={1}>Reference images (image_name, one per line)</FormLabel>
          <Textarea
            value={referencesInput}
            onChange={(e) => setReferencesInput(e.target.value)}
            minH={28}
            placeholder="image_1.png&#10;image_2.png"
          />
        </FormControl>

        <FormControl>
          <FormLabel mb={1}>Generation lock (JSON)</FormLabel>
          <Textarea value={generationLockInput} onChange={(e) => setGenerationLockInput(e.target.value)} minH={28} />
        </FormControl>

        <Flex gap={2}>
          <Button flex={1} onClick={saveProfileHandler} isLoading={isSavingProfile}>
            Save Settings
          </Button>
          <Button flex={1} onClick={saveReferencesHandler} isLoading={isSavingReferences}>
            Save References
          </Button>
        </Flex>

        <Button onClick={deleteSelectedProfileHandler} colorScheme="red" variant="outline" isDisabled={!selectedProfileId}>
          Delete Profile
        </Button>
      </Flex>

      <Flex flexDir="column" flex={1} h="full" borderRadius="base" borderWidth={1} p={3} gap={3} overflowY="auto">
        <Heading size="sm">Video Generation + Preview</Heading>

        <Flex gap={3} flexWrap="wrap">
          <FormControl maxW="22rem">
            <FormLabel mb={1}>Prompt</FormLabel>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} minH={20} />
          </FormControl>

          <FormControl maxW="22rem">
            <FormLabel mb={1}>Negative prompt</FormLabel>
            <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} minH={20} />
          </FormControl>
        </Flex>

        <Flex gap={3} flexWrap="wrap">
          <FormControl maxW="8rem">
            <FormLabel mb={1}>Duration (s)</FormLabel>
            <Input type="number" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="8rem">
            <FormLabel mb={1}>FPS</FormLabel>
            <Input type="number" value={fps} onChange={(e) => setFps(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="10rem">
            <FormLabel mb={1}>Width</FormLabel>
            <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="10rem">
            <FormLabel mb={1}>Height</FormLabel>
            <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </FormControl>
        </Flex>

        <Button onClick={generateVideoHandler} isLoading={isGenerating} colorScheme="invokeYellow" maxW="14rem">
          Generate 5-10s Clip
        </Button>

        <Divider />

        <Heading size="sm">Video Player</Heading>
        <Box borderWidth={1} borderRadius="base" p={2} minH="20rem">
          {selectedVideo ? (
            <video
              controls
              src={buildVideosUrl(`${selectedVideo.id}/file`)}
              style={{ width: '100%', maxHeight: '28rem', borderRadius: '8px', background: '#111' }}
            />
          ) : (
            <Text variant="subtext">No videos generated yet.</Text>
          )}
        </Box>

        <Heading size="sm">Video Gallery</Heading>
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

      <Flex flexDir="column" w="24rem" h="full" borderRadius="base" borderWidth={1} p={3} gap={3} overflowY="auto">
        <Heading size="sm">Video Jobs</Heading>
        {jobs.length === 0 && <Text variant="subtext">No jobs yet.</Text>}

        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onCancel={async () => {
              try {
                await cancelVideoJob(job.id).unwrap();
              } catch {
                toast({ id: `VIDEO_CANCEL_FAILED_${job.id}`, title: 'Could not cancel job', status: 'error' });
              }
            }}
            onOpenVideo={(videoId) => setSelectedVideoId(videoId)}
          />
        ))}
      </Flex>
    </Flex>
  );
});

VideoTab.displayName = 'VideoTab';

const JobCard = ({
  job,
  onCancel,
  onOpenVideo,
}: {
  job: VideoJob;
  onCancel: () => void;
  onOpenVideo: (videoId: string) => void;
}) => {
  const canCancel = job.status === 'waiting' || job.status === 'running' || job.status === 'encoding';

  return (
    <Flex borderWidth={1} borderRadius="base" p={2} flexDir="column" gap={2}>
      <Flex justifyContent="space-between" alignItems="center" gap={2}>
        <Text fontSize="sm" noOfLines={1}>
          {job.id}
        </Text>
        <Badge colorScheme={statusColorScheme[job.status]}>{job.status}</Badge>
      </Flex>

      <Progress value={job.progress} max={100} size="xs" borderRadius="full" colorScheme="invokeBlue" />

      {job.error ? (
        <Text fontSize="xs" color="error.400" noOfLines={4}>
          {job.error}
        </Text>
      ) : null}

      <Flex gap={2}>
        <Button size="xs" variant="outline" onClick={onCancel} isDisabled={!canCancel}>
          Cancel
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
          Open Video
        </Button>
      </Flex>
    </Flex>
  );
};
