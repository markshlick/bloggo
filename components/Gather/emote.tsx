import { appendHtml } from 'helpers/html';
import { sleep } from 'helpers/sleep';

import styles from './chill.module.css';

export const emote = async ({
  emoji,
  containerEl,
}: {
  emoji: string;
  containerEl: HTMLDivElement;
}) => {
  const count = Math.random() * 15;
  for (let index = 0; index < count; index++) {
    const x1 = `rotate(${15 - Math.random() * 30}deg) translateX(${200 - Math.random() * 400}px)`;
    const x2 = `rotate(${Math.random() * 360}deg) scale(${0.5 + Math.random() * 1})`;

    await sleep(Math.random() * 100);

    const el = appendHtml(
      containerEl,
      `
      <div class="${styles.emoteA}" style="transform: ${x1};">
        <div class="${styles.emoteB}">
          <div style="transform: ${x2}">
            ${emoji}
          </div>
        </div>
      </div>
    `
    );

    sleep(2000).then(() => el?.remove());
  }
};
export const emoteGif = async ({
  gif,
  containerEl,
}: {
  gif: string;
  containerEl: HTMLDivElement;
}) => {
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.src = gif;
    img.onload = resolve;
    img.onerror = reject;
  });

  const el = appendHtml(
    containerEl,
    `
    <div class="${styles.gifA}">
      <div class="${styles.gifB}">
        <img class="${styles.gif}" src="${gif}">
      </div>
    </div>
  `
  );

  sleep(2500).then(() => el?.remove());
};
