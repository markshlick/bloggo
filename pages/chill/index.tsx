import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import webrtc from 'helpers/webrtc';
import styles from './chill.module.css';
import { signalingServer, signalingServerDev } from 'config/site';

// @ts-check

// const debugMode = window.location.search.includes('debug');
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
  let localVideoEL;

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

function Emotes({ emoji, onClick }: { emoji: string[]; onClick: (s: string) => void }) {
  return (
    <div className={styles.emotesBar}>
      {emoji.map((emoj) => (
        <button onClick={() => onClick(emoj)} className={styles.emoteButton} key={emoj}>
          {emoj}
        </button>
      ))}
    </div>
  );
}

export default function Chill() {
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
      <div className={styles.emotes} ref={emoteContainerRef}></div>
      <Emotes
        emoji={['😍', '😂', '🔥', '🎉', '💩']}
        onClick={(e) => {
          emoteContainerRef.current &&
            emote({
              emoji: e,
              containerEl: emoteContainerRef.current,
            });
          send('emote', e);
        }}
      />
    </div>
  );
}

Chill.layout = 'none';
