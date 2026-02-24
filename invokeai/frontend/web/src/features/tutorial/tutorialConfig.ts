import type { TabName } from 'features/ui/store/uiTypes';

type TutorialStep = {
  id: string;
  tab: TabName;
  titleKey: string;
  bodyKey: string;
};

type LegendItem = {
  titleKey: string;
  bodyKey: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'generate_prompt',
    tab: 'generate',
    titleKey: 'tutorial.steps.generatePrompt.title',
    bodyKey: 'tutorial.steps.generatePrompt.body',
  },
  {
    id: 'generate_style_ref',
    tab: 'generate',
    titleKey: 'tutorial.steps.generateStyleRef.title',
    bodyKey: 'tutorial.steps.generateStyleRef.body',
  },
  {
    id: 'canvas_edit',
    tab: 'canvas',
    titleKey: 'tutorial.steps.canvasEdit.title',
    bodyKey: 'tutorial.steps.canvasEdit.body',
  },
  {
    id: 'gallery_select',
    tab: 'generate',
    titleKey: 'tutorial.steps.gallerySelect.title',
    bodyKey: 'tutorial.steps.gallerySelect.body',
  },
  {
    id: 'video_profile',
    tab: 'video',
    titleKey: 'tutorial.steps.videoProfile.title',
    bodyKey: 'tutorial.steps.videoProfile.body',
  },
  {
    id: 'video_references',
    tab: 'video',
    titleKey: 'tutorial.steps.videoReferences.title',
    bodyKey: 'tutorial.steps.videoReferences.body',
  },
  {
    id: 'video_generate',
    tab: 'video',
    titleKey: 'tutorial.steps.videoGenerate.title',
    bodyKey: 'tutorial.steps.videoGenerate.body',
  },
  {
    id: 'models_manage',
    tab: 'models',
    titleKey: 'tutorial.steps.modelsManage.title',
    bodyKey: 'tutorial.steps.modelsManage.body',
  },
  {
    id: 'queue_monitor',
    tab: 'queue',
    titleKey: 'tutorial.steps.queueMonitor.title',
    bodyKey: 'tutorial.steps.queueMonitor.body',
  },
];

export const TAB_LEGEND_ITEMS: Record<TabName, LegendItem[]> = {
  generate: [
    { titleKey: 'legends.generate.prompt.title', bodyKey: 'legends.generate.prompt.body' },
    { titleKey: 'legends.generate.model.title', bodyKey: 'legends.generate.model.body' },
    { titleKey: 'legends.generate.reference.title', bodyKey: 'legends.generate.reference.body' },
  ],
  canvas: [
    { titleKey: 'legends.canvas.layers.title', bodyKey: 'legends.canvas.layers.body' },
    { titleKey: 'legends.canvas.inpaint.title', bodyKey: 'legends.canvas.inpaint.body' },
    { titleKey: 'legends.canvas.bbox.title', bodyKey: 'legends.canvas.bbox.body' },
  ],
  upscaling: [
    { titleKey: 'legends.upscaling.input.title', bodyKey: 'legends.upscaling.input.body' },
    { titleKey: 'legends.upscaling.creativity.title', bodyKey: 'legends.upscaling.creativity.body' },
    { titleKey: 'legends.upscaling.output.title', bodyKey: 'legends.upscaling.output.body' },
  ],
  workflows: [
    { titleKey: 'legends.workflows.templates.title', bodyKey: 'legends.workflows.templates.body' },
    { titleKey: 'legends.workflows.editor.title', bodyKey: 'legends.workflows.editor.body' },
    { titleKey: 'legends.workflows.viewer.title', bodyKey: 'legends.workflows.viewer.body' },
  ],
  video: [
    { titleKey: 'legends.video.profile.title', bodyKey: 'legends.video.profile.body' },
    { titleKey: 'legends.video.references.title', bodyKey: 'legends.video.references.body' },
    { titleKey: 'legends.video.jobs.title', bodyKey: 'legends.video.jobs.body' },
  ],
  models: [
    { titleKey: 'legends.models.install.title', bodyKey: 'legends.models.install.body' },
    { titleKey: 'legends.models.types.title', bodyKey: 'legends.models.types.body' },
    { titleKey: 'legends.models.queue.title', bodyKey: 'legends.models.queue.body' },
  ],
  queue: [
    { titleKey: 'legends.queue.status.title', bodyKey: 'legends.queue.status.body' },
    { titleKey: 'legends.queue.control.title', bodyKey: 'legends.queue.control.body' },
    { titleKey: 'legends.queue.retry.title', bodyKey: 'legends.queue.retry.body' },
  ],
};
