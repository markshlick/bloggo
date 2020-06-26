// @ts-check

const http = require('http');
const express = require('express');
const IO = require('socket.io');
const name = require('project-name-generator');
const base64id = require('base64id');

const app = express();
const server = http.createServer(app);
const io = IO(server);

const isDev = process.env.NODE_ENV === 'development';

app.use(express.json());

app.use((req, res, next) => {
  res.header(
    'Access-Control-Allow-Origin',
    isDev ? '*' : 'https://mksh.io',
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET,PUT,POST,DELETE',
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type',
  );
  next();
});

app.get('/', (req, res) => {
  res.status(200).end();
});

app.post('/room', (req, res) => {
  let room;
  do {
    room = name({ words: 4 }).dashed;
  } while (io.sockets.adapter.rooms[room]);

  res.status(200).json({ room });
});

const clientIdsToSocketId = {};

io.on('connection', (socket) => {
  let socketClientId = base64id.generateId();

  socket.on('message', ({ id, type, message, room }) => {
    console.log('message', { id, type, room });

    if (type === 'join') {
      if (!room) return;
      if (id) {
        socketClientId = id;
      }

      clientIdsToSocketId[socketClientId] = socket.id;

      if (!io.sockets.adapter.rooms[room]) {
        console.log('new room', room);
      }
      socket.join(room);
      socket.broadcast.to(room).emit('message', {
        type: 'join',
        id: socketClientId,
      });
    } else {
      io.to(clientIdsToSocketId[id]).emit('message', {
        id: socketClientId,
        type,
        message,
      });
    }
  });

  socket.emit('id', {
    id: socketClientId,
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`listening on localhost:${process.env.PORT}`);
});
