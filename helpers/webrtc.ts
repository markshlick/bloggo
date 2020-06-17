// @ts-nocheck

const mediaConfig = {
  audio: {
    noiseSuppression: true,
  },
  video: {
    facingMode: 'user',
    aspectRatio: 1,
  },
};

const initPeerConnection = async ({
  id,
  localMediaStream,
  iceServers,
  onDisconnected,
  onIceCandidate,
  onFirstTrack,
  onDataMessage,
  onDataReady,
}) => {
  const stream = new MediaStream();

  const peerConnection = new RTCPeerConnection({
    iceServers,
  });

  const dataChannel = peerConnection.createDataChannel('app', {
    id: 0,
    negotiated: true,
  });

  dataChannel.addEventListener('open', (event) => {
    state.canSendData = true;
    onDataReady();
  });

  dataChannel.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message?.type === 'close') {
      dataChannel.close();
      peerConnection.close();
      state.canSendData = false;
      state.active = false;
      onDisconnected({ id });
    } else {
      onDataMessage(message.content || null);
    }
  });

  const sendMessage = (content: any) => {
    if (state.canSendData) {
      const s = JSON.stringify({ type: 'user', content });
      dataChannel.send(s);
    }
  };

  const close = () => {
    if (state.canSendData) {
      const s = JSON.stringify({ type: 'close' });
      dataChannel.send(s);
    }
  };

  const state = {
    id,
    peerConnection,
    stream,
    close,
    sendMessage,
    dataChannel,
    iceCandidates: [],
    active: false,
    readyForIce: false,
    canSendData: false,
  };

  for (const track of localMediaStream.getTracks()) {
    peerConnection.addTrack(track, localMediaStream);
  }

  peerConnection.addEventListener('icecandidate', (event) => {
    if (!event.candidate) {
      return;
    }

    if (state.readyForIce) {
      onIceCandidate(event.candidate);
    } else {
      state.iceCandidates.push(event.candidate);
    }
  });

  // @ts-ignore
  peerConnection.onaddstream = ({ stream }) => {
    // @ts-ignore
    if (!state.active) {
      state.active = true;
      onFirstTrack({ id, peerConnection, stream });
    }
  };

  peerConnection.addEventListener('connectionstatechange', (ev) => {
    // @ts-ignore
    if (ev.target.iceConnectionState === 'disconnected') {
      state.canSendData = false;
      onDisconnected({ id });
    }
  });

  return state;
};

const messageHandlers = {
  join: async ({ id, initPeer, send }) => {
    const peerState = await initPeer({
      id,
      reciever: false,
    });

    const offer = await peerState.peerConnection.createOffer();
    await peerState.peerConnection.setLocalDescription(offer);

    send('offer', id, { offer });
  },
  offer: async ({ id, send, initPeer, value: { offer } }) => {
    const peerState = await initPeer({
      id,
      reciever: true,
    });

    await peerState.peerConnection.setRemoteDescription(offer);
    const answer = await peerState.peerConnection.createAnswer();
    await peerState.peerConnection.setLocalDescription(answer);

    send('answer', id, { answer });
  },
  answer: async ({ id, value: { answer }, send, peers }) => {
    const peerConnection = peers[id].peerConnection;
    await peerConnection.setRemoteDescription(answer);

    peers[id].readyForIce = true;
    if (peers[id].iceCandidates.length) {
      send('ice', id, { candidates: peers[id].iceCandidates });
      peers[id].iceCandidates = [];
    }
  },
  ice: async ({ id, value: { candidates }, peers, send }) => {
    candidates.forEach((c) => peers[id].peerConnection.addIceCandidate(new RTCIceCandidate(c)));

    peers[id].readyForIce = true;
    if (peers[id].iceCandidates.length) {
      send('ice', id, { candidates: peers[id].iceCandidates });
      peers[id].iceCandidates = [];
    }
  },
};

const webrtc = async ({
  iceServers,
  sendSignalMessage,
  onLocalVideo,
  onRemoteVideo,
  onDisconnected,
  onDataMessage,
  onDataReady,
}) => {
  const peers = {};
  const localMediaStream = await navigator.mediaDevices.getUserMedia(mediaConfig);

  onLocalVideo(localMediaStream);

  const send = (type, id, value) => sendSignalMessage({ type, id, value });

  const initPeer = async ({ id }) => {
    const peer = await initPeerConnection({
      id,
      onDisconnected,
      localMediaStream,
      iceServers,
      onDataMessage,
      onFirstTrack: onRemoteVideo,
      onIceCandidate: (candidate) => {
        send('ice', id, { candidates: [candidate] });
      },
      onDataReady,
    });

    peers[id] = peer;
    return peer;
  };

  const handleSignalMessage = ({ type, id, value }) => {
    const handler = messageHandlers[type];
    if (handler) {
      handler({
        id,
        send,
        initPeer,
        peers,
        value,
      });
    }
  };

  const sendMessage = (message) => {
    Object.values(peers).forEach((peer) => peer.sendMessage(message));
  };

  const start = () => {
    sendSignalMessage({ type: 'join' });
  };

  const stop = () => {
    Object.values(peers).forEach((peer) => peer.close());
  };

  return { handleSignalMessage, start, sendMessage, stop };
};

export default webrtc;
