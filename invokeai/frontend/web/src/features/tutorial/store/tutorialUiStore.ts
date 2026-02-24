import { atom } from 'nanostores';

export const $isTutorialOpen = atom(false);

export const openTutorial = () => {
  $isTutorialOpen.set(true);
};

export const closeTutorial = () => {
  $isTutorialOpen.set(false);
};
