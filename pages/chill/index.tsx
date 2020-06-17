import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import webrtc from 'helpers/webrtc';
import styles from 'config/chill.module.css';

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

const run = async ({ remoteVideoContainerEl, localVideoContainerEl }: any) => {
  const videoEls: Record<string, HTMLVideoElement> = {};
  const socket = io(
    process.env.NODE_ENV === 'production' ? 'https://justcallme.herokuapp.com/' : 'localhost:3001',
    {
      autoConnect: false,
    }
  );

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
      // if (message.type === 'emote') {
      //   emote(message.value);
      // }
      debug('message', message);
    },
  });

  socket.on('message', (m: any) => {
    debug('recv', m);
    handleSignalMessage(m);
  });

  socket.open();
  socket.on('connect', () => {
    debug('starting');
    start();
  });

  window.addEventListener('beforeunload', function (e) {
    stop();
    delete e['returnValue'];
  });
};

export default function Chill() {
  const localVideoContainerRef = useRef<HTMLDivElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    run({
      remoteVideoContainerEl: remoteVideoContainerRef.current,
      localVideoContainerEl: localVideoContainerRef.current,
    });
  }, []);

  return (
    <div className={styles.chill}>
      <div ref={localVideoContainerRef}></div>
      <div className={styles.friends} ref={remoteVideoContainerRef}></div>
    </div>
  );
}

Chill.layout = 'none';
