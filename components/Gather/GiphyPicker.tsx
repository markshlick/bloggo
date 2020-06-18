import { useState } from 'react';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';
import { giphyApiKey } from 'config/site';
import { fetchJson } from 'helpers/fetchJson';
import styles from './chill.module.css';

export function GiphyPicker({
  onSelect,
  onClose,
}: {
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  const [q, setQuery] = useState('');
  const [q_] = useDebounce(q, 100, { leading: false, maxWait: 1000 });

  const res = useSWR<{
    data: { id: string; images: { preview_gif: { url: string }; original: { url: string } } }[];
  }>(
    q_.length > 0
      ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${q_}&limit=12&offset=0&rating=G&lang=en1`
      : null,
    fetchJson
  );

  return (
    <div className={styles.modalContent}>
      <div>
        <input
          tabIndex={0}
          autoFocus
          placeholder="Search for gifs"
          type="text"
          className={styles.bigInput}
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(event) => {
            if (res.data?.data[0] && event.key === 'Enter') {
              setQuery('');
              onSelect(res.data.data[0].images.original.url);
            }

            if (event.key === 'Esc') {
              onClose();
            }
          }}
        />
      </div>
      <div className={styles.gifOptions}>
        {res.data?.data.map((d, i) => (
          <img
            tabIndex={0}
            key={d.id}
            className={styles.gifPreview}
            src={d.images.preview_gif.url}
            alt=""
            onKeyPress={(event) => {
              if (res.data && event.key === 'Enter') {
                setQuery('');
                onSelect(d.images.original.url);
              }

              if (event.key === 'Esc') {
                onClose();
              }
            }}
            onClick={() => {
              setQuery('');
              onSelect(d.images.original.url);
            }}
          />
        ))}
      </div>
    </div>
  );
}
