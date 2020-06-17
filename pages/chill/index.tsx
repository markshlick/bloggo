import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import useSWR from 'swr';

import webrtc from 'helpers/webrtc';
import { signalingServer, signalingServerDev } from 'config/site';
import styles from 'pages/chill/chill.module.css';

async function fetchJson<JSON = any>(input: RequestInfo, init?: RequestInit): Promise<JSON> {
  const res = await fetch(input, init);
  return res.json();
}

const debug = (name: string, value?: any) => {
  console.log(name, value);
};

const initVideoEl = ({ mute, stream, el }: any) => {
  const videoEl = document.createElement('video');
  videoEl.setAttribute('playsinline', '');

  videoEl.onloadedmetadata = async () => {
    el.appendChild(videoEl);

    // browser quirk: programatically mute AFTER adding to dom
    if (mute) {
      videoEl.setAttribute('volume', '0');
      videoEl.setAttribute('muted', 'muted');
      videoEl.muted = true;
    }

    videoEl.play();
  };

  videoEl.srcObject = stream;

  return videoEl;
};

const signalingServerUrl =
  process.env.NODE_ENV === 'production' ? signalingServer : signalingServerDev;

const run = async ({ remoteVideoContainerEl, localVideoContainerEl, onMessage }: any) => {
  let videoEls: Record<string, HTMLVideoElement> = {};
  let localVideoEL: HTMLVideoElement | null = null;

  const { handleSignalMessage, start, sendMessage, stop } = await webrtc({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
    onDisconnected: ({ id }: { id: string }) => {
      if (videoEls[id]) {
        videoEls[id].remove();
        delete videoEls[id];
      }
    },
    onLocalVideo: (stream: MediaStream) => {
      const videoEl = initVideoEl({ mute: true, stream, el: localVideoContainerEl });
      videoEl.classList.add(styles.self);
      localVideoEL = videoEl;
    },
    onRemoteVideo: ({
      id,
      peerConnection,
      stream,
    }: {
      id: string;
      peerConnection: RTCPeerConnection;
      stream: MediaStream;
    }) => {
      debug('stream', { id, peerConnection, stream });
      const videoEl = initVideoEl({ mute: false, stream, el: remoteVideoContainerEl });
      videoEl.classList.add(styles.friend);
      videoEls[id] = videoEl;
    },
    sendSignalMessage: (m: any) => {
      debug('send', m);
      socket.emit('message', m);
    },
    onDataReady: () => {
      debug('dataready');
    },
    onDataMessage: (message: any) => {
      onMessage(message);
      debug('message', message);
    },
  });

  const socket = io(signalingServerUrl, {
    autoConnect: false,
  });

  socket.on('message', (m: any) => {
    debug('recv', m);
    handleSignalMessage(m);
  });

  socket.on('connect', () => {
    debug('starting');
    start();
  });

  window.addEventListener('beforeunload', function (e) {
    stop();
    delete e['returnValue'];
  });

  socket.open();

  return {
    stop: () => {
      localVideoEL?.remove();
      Object.values(videoEls).forEach((el) => el.remove());
      videoEls = {};
      socket.close();
      stop();
    },
    sendMessage,
  };
};

function randInt(a: number, b?: number) {
  const min = b ? a : 0;
  const max = b ? b : a;
  return min + Math.floor(Math.random() * (max - min));
}

const html = (x: string) => {
  const doc = new DOMParser().parseFromString(x, 'text/html');
  return doc.body.firstChild;
};

const appendHtml = (el: Element, c: string) => {
  const x = html(c);
  x && el.appendChild(x);
  return x;
};

const sleep = (t: number) => new Promise((n) => setTimeout(n, t));

const emote = async ({ emoji, containerEl }: { emoji: string; containerEl: HTMLDivElement }) => {
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

    sleep(1200).then(() => el?.remove());
  }
};

const emoteGif = async ({ gif, containerEl }: { gif: string; containerEl: HTMLDivElement }) => {
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
      <img src="${gif}">
    </div>
  `
  );

  sleep(2500).then(() => el?.remove());
};

function Emotes({ emoji, onClick }: { emoji: string[]; onClick: (s: string) => void }) {
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

function GiphyStickers({ onSelect }: { onSelect: (s: string) => void }) {
  const [q, setQuery] = useState('');
  const res = useSWR<{
    data: { id: string; images: { preview_gif: { url: string }; original: { url: string } } }[];
  }>(
    `https://api.giphy.com/v1/stickers/search?api_key=EilKHJDlSoAHjFVugtLEDK6gqy2aR4V8&q=${q}&limit=25&offset=0&rating=G&lang=en1`,
    fetchJson
  );

  return (
    <div className={styles.gifTray}>
      <div>
        <input
          autoFocus
          placeholder="Search for gifs"
          type="text"
          className={styles.gifInput}
          value={q}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.gifOptions}>
        {res.data?.data.map((d) => (
          <img
            key={d.id}
            className={styles.gif}
            src={d.images.preview_gif.url}
            alt=""
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

export default function Chill() {
  const [isGifDrawerOpen, setIsGifDrawerOpen] = useState(false);
  const webrtcRef = useRef<any>(null);
  const localVideoContainerRef = useRef<HTMLDivElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const emoteContainerRef = useRef<HTMLDivElement>(null);

  const send = (type: string, value: any) => {
    webrtcRef.current?.sendMessage({
      type,
      value,
    });
  };

  useEffect(() => {
    const webrtcPromise = run({
      remoteVideoContainerEl: remoteVideoContainerRef.current,
      localVideoContainerEl: localVideoContainerRef.current,
      onMessage: (message: any) => {
        if (message.type === 'emote') {
          emote({
            emoji: message.value,
            containerEl: emoteContainerRef.current!,
          });
        } else if (message.type === 'gif') {
          emoteGif({
            gif: message.value,
            containerEl: emoteContainerRef.current!,
          });
        }
      },
    });

    webrtcPromise.then((client) => {
      webrtcRef.current = client;
    });

    return () => {
      webrtcPromise.then(({ stop }) => {
        stop();
      });
    };
  }, []);

  return (
    <div className={styles.chill}>
      <div ref={localVideoContainerRef}></div>
      <div className={styles.friends} ref={remoteVideoContainerRef}></div>
      <Emotes
        emoji={['😍', '😂', '🔥', '🎉', '💩']}
        onClick={(e) => {
          if (e === 'gif') {
            setIsGifDrawerOpen(true);
          } else {
            emoteContainerRef.current &&
              emote({
                emoji: e,
                containerEl: emoteContainerRef.current,
              });
            send('emote', e);
          }
        }}
      />
      {isGifDrawerOpen && (
        <GiphyStickers
          onSelect={(url) => {
            send('gif', url);
            setIsGifDrawerOpen(false);
            emoteGif({
              gif: url,
              containerEl: emoteContainerRef.current!,
            });
          }}
        />
      )}
      <div className={styles.emotes} ref={emoteContainerRef}></div>
    </div>
  );
}

Chill.layout = 'none';
