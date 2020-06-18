// @ts-check

const http = require('http');
const express = require('express');
const IO = require('socket.io');
const name = require('project-name-generator');

const app = express();
const server = http.createServer(app);
const io = IO(server);

if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
}

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

io.on('connection', (socket) => {
  socket.on('message', ({ id, type, message, room }) => {
    console.log('message', { id, type, room });

    if (type === 'join') {
      if (!room) return;
      if (!io.sockets.adapter.rooms[room]) {
        console.log('new room', room);
      }
      socket.join(room);
      socket.broadcast.to(room).emit('message', { type: 'join', id: socket.id });
    } else {
      io.to(id).emit('message', { id: socket.id, type, message });
    }
  });
});

server.listen(process.env.PORT || 3001);
