import { atom } from 'nanostores';

export const $videoReferenceInbox = atom<string[]>([]);

export const enqueueVideoReference = (imageName: string) => {
  const sanitized = imageName.split(/[\\/]/).at(-1) ?? imageName;
  const current = $videoReferenceInbox.get();
  if (current.includes(sanitized)) {
    return;
  }
  $videoReferenceInbox.set([...current, sanitized]);
};

export const clearVideoReferenceInbox = () => {
  $videoReferenceInbox.set([]);
};
