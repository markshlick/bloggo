import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Modal from 'react-modal';

import { signalingServerUrl, iceServers } from 'config/site';
import { GiphyPicker } from 'components/Gather/GiphyPicker';
import { Emotes } from 'components/Gather/Emotes';
import { emote, emoteGif } from 'components/Gather/emote';
import webrtc from 'helpers/webrtc';
import { debug } from 'helpers/debug';

import styles from 'components/Gather/chill.module.css';

const run = async ({ remoteVideoContainerEl, localVideoContainerEl, onMessage, room }: any) => {
  let videoEls: Record<string, HTMLVideoElement> = {};
  let localVideoEL: HTMLVideoElement | null = null;

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

  const { handleSignalMessage, start, sendMessage, stop } = await webrtc({
    iceServers: iceServers,
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
      const n = { ...m, room };
      debug('send', n);
      socket.emit('message', n);
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

const appEl = typeof window === 'undefined' ? undefined : document.getElementById('__next');

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

  const handleMessage = (message: any) => {
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
  };

  useEffect(() => {
    const room = window.location.pathname.split('/')[2];

    const webrtcPromise = run({
      room,
      remoteVideoContainerEl: remoteVideoContainerRef.current,
      localVideoContainerEl: localVideoContainerRef.current,
      onMessage: handleMessage,
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
      <Modal
        isOpen={isGifDrawerOpen}
        contentLabel="GIF picker"
        className={styles.gifTray}
        appElement={appEl!}
        style={{
          overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'none',
          },
        }}
        onRequestClose={() => setIsGifDrawerOpen(false)}
      >
        <GiphyPicker
          onSelect={(url) => {
            send('gif', url);
            emoteGif({
              gif: url,
              containerEl: emoteContainerRef.current!,
            });
            setIsGifDrawerOpen(false);
          }}
          onClose={() => {
            setIsGifDrawerOpen(false);
          }}
        />
      </Modal>

      <div className={styles.emotes} ref={emoteContainerRef}></div>
    </div>
  );
}

Chill.layout = 'none';
