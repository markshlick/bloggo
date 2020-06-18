import styles from './chill.module.css';

export function Emotes({ emoji, onClick }: { emoji: string[]; onClick: (s: string) => void }) {
  return (
    <div className={styles.emotesBar}>
      {emoji.map((emoj) => (
        <button onClick={() => onClick(emoj)} className={styles.emoteButton} key={emoj}>
          {emoj}
        </button>
      ))}
      <button onClick={() => onClick('gif')} className={styles.emoteButton} key={'gif'}>
        GIF
      </button>
    </div>
  );
}
