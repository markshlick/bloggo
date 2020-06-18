import Router from 'next/router';
import { useState } from 'react';
import { fetchJson } from 'helpers/fetchJson';
import { signalingServerUrl } from 'config/site';
import { Container, Input, Button, Box, Text } from 'theme-ui';

export default function ChillLanding() {
  const [room, setRoom] = useState<string>('');

  const createRoom = async () => {
    const res = await fetchJson<{ room: string }>(`${signalingServerUrl}/room`, {
      method: 'POST',
      body: '',
    });

    Router.push('/chill/[room]', `/chill/${res.room}`);
  };

  return (
    <Container>
      <Box p={10}>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            Router.push('/chill/[room]', `/chill/${room}`);
          }}
        >
          <Input
            mb="2"
            type="text"
            placeholder="Your room's ID"
            onChange={(ev) => setRoom(ev.target.value)}
          />
          <Button type="submit" disabled={room.length === 0}>
            Join a room
          </Button>
        </form>
      </Box>
      <Text sx={{ textAlign: 'center' }}>or</Text>
      <Box p={10}>
        <Button onClick={createRoom}>Create a new room</Button>
      </Box>
    </Container>
  );
}

ChillLanding.layout = 'none';
