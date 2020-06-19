import styles from './chill.module.css';

export function Emotes({ options, onClick }: { options: string[]; onClick: (s: string) => void }) {
  return (
    <div className={styles.emotesBar}>
      {options.map((emoj) => (
        <button onClick={() => onClick(emoj)} className={styles.emoteButton} key={emoj}>
          {emoj}
        </button>
      ))}
    </div>
  );
}
