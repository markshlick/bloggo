import Router from 'next/router';
import { useState } from 'react';
import { fetchJson } from 'helpers/fetchJson';
import { signalingServerUrl } from 'config/site';
import { Container, Input, Button, Box, Text } from 'theme-ui';

export default function GatherLanding() {
  const [room, setRoom] = useState<string>('');

  const createRoom = async () => {
    const res = await fetchJson<{ room: string }>(`${signalingServerUrl}/room`, {
      method: 'POST',
      body: '',
    });

    Router.push('/gather/[room]', `/gather/${res.room}`);
  };

  return (
    <Container>
      <Box p={10}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            Router.push('/gather/[room]', `/gather/${room}`);
          }}
        >
          <Input
            mb="2"
            type="text"
            placeholder="Your room's ID"
            onChange={(event) => setRoom(event.target.value)}
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

GatherLanding.layout = 'none';
