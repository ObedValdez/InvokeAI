import { api, buildV1Url, LIST_TAG } from '..';

export type VideoProfileMode = 'fictional' | 'real_identity';
export type VideoJobStatus = 'waiting' | 'running' | 'encoding' | 'completed' | 'error' | 'cancelled';

export type VideoGenerationLock = {
  base_model?: string | null;
  loras?: string[];
  vae?: string | null;
  prompt_template?: string | null;
  negative_prompt?: string | null;
  cfg_scale?: number | null;
  seed?: number | null;
  seed_strategy?: string | null;
  seed_jitter?: number;
  reference_weight?: number;
  strict_lock?: boolean;
};

export type VideoProfile = {
  id: string;
  name: string;
  mode: VideoProfileMode;
  consent_checked: boolean;
  reference_images: string[];
  generation_lock: VideoGenerationLock;
  created_at: string;
  updated_at: string;
};

export type VideoProfileCreate = {
  name: string;
  mode: VideoProfileMode;
  consent_checked: boolean;
  generation_lock?: VideoGenerationLock;
};

export type VideoProfileUpdate = {
  name?: string;
  mode?: VideoProfileMode;
  consent_checked?: boolean;
  generation_lock?: VideoGenerationLock;
};

export type VideoGenerateRequest = {
  profile_id: string;
  prompt?: string;
  negative_prompt?: string;
  duration_sec?: number;
  fps?: number;
  width: number;
  height: number;
};

export type VideoJob = {
  id: string;
  profile_id: string;
  status: VideoJobStatus;
  progress: number;
  error: string | null;
  output_video_id: string | null;
  request: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VideoAsset = {
  id: string;
  filename: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  created_at: string;
  path: string;
  profile_id: string | null;
};

const buildVideoProfilesUrl = (path = '') => buildV1Url(path ? `video_profiles/${path}` : 'video_profiles');
const buildVideosUrl = (path = '') => buildV1Url(path ? `videos/${path}` : 'videos');

export const videosApi = api.injectEndpoints({
  endpoints: (build) => ({
    listVideoProfiles: build.query<VideoProfile[], void>({
      query: () => ({ url: buildVideoProfilesUrl() }),
      providesTags: ['FetchOnReconnect', { type: 'VideoProfile', id: LIST_TAG }],
    }),
    createVideoProfile: build.mutation<VideoProfile, VideoProfileCreate>({
      query: (body) => ({
        url: buildVideoProfilesUrl(),
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'VideoProfile', id: LIST_TAG }],
    }),
    getVideoProfile: build.query<VideoProfile, string>({
      query: (profileId) => ({ url: buildVideoProfilesUrl(profileId) }),
      providesTags: (result, error, profileId) => [{ type: 'VideoProfile', id: profileId }],
    }),
    updateVideoProfile: build.mutation<VideoProfile, { profileId: string; changes: VideoProfileUpdate }>({
      query: ({ profileId, changes }) => ({
        url: buildVideoProfilesUrl(profileId),
        method: 'PUT',
        body: changes,
      }),
      invalidatesTags: (result, error, { profileId }) => [
        { type: 'VideoProfile', id: LIST_TAG },
        { type: 'VideoProfile', id: profileId },
      ],
    }),
    deleteVideoProfile: build.mutation<void, string>({
      query: (profileId) => ({
        url: buildVideoProfilesUrl(profileId),
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'VideoProfile', id: LIST_TAG }],
    }),
    attachVideoReferences: build.mutation<VideoProfile, { profileId: string; image_names: string[] }>({
      query: ({ profileId, image_names }) => ({
        url: buildVideoProfilesUrl(`${profileId}/references`),
        method: 'POST',
        body: { image_names },
      }),
      invalidatesTags: (result, error, { profileId }) => [
        { type: 'VideoProfile', id: LIST_TAG },
        { type: 'VideoProfile', id: profileId },
      ],
    }),
    generateVideo: build.mutation<VideoJob, VideoGenerateRequest>({
      query: (body) => ({
        url: buildVideosUrl('generate'),
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'VideoJob', id: LIST_TAG }],
    }),
    listVideoJobs: build.query<VideoJob[], void>({
      query: () => ({ url: buildVideosUrl('jobs') }),
      providesTags: ['FetchOnReconnect', { type: 'VideoJob', id: LIST_TAG }],
    }),
    getVideoJob: build.query<VideoJob, string>({
      query: (jobId) => ({ url: buildVideosUrl(`jobs/${jobId}`) }),
      providesTags: (result, error, jobId) => [{ type: 'VideoJob', id: jobId }],
    }),
    cancelVideoJob: build.mutation<void, string>({
      query: (jobId) => ({
        url: buildVideosUrl(`jobs/${jobId}`),
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, jobId) => [
        { type: 'VideoJob', id: LIST_TAG },
        { type: 'VideoJob', id: jobId },
      ],
    }),
    listVideos: build.query<VideoAsset[], void>({
      query: () => ({ url: buildVideosUrl() }),
      providesTags: ['FetchOnReconnect', { type: 'VideoAsset', id: LIST_TAG }],
    }),
  }),
});

export const {
  useListVideoProfilesQuery,
  useCreateVideoProfileMutation,
  useGetVideoProfileQuery,
  useUpdateVideoProfileMutation,
  useDeleteVideoProfileMutation,
  useAttachVideoReferencesMutation,
  useGenerateVideoMutation,
  useListVideoJobsQuery,
  useGetVideoJobQuery,
  useCancelVideoJobMutation,
  useListVideosQuery,
} = videosApi;

export { buildVideosUrl };
