// @ts-check

const http = require('http');
const IO = require('socket.io');

const server = http.createServer(async (req, res) => {
  res.writeHead(200).end();
});

const io = IO(server);

io.on('connection', (socket) => {
  socket.on('message', async ({ id, type, message }) => {
    if (type === 'join') {
      socket.broadcast.emit('message', { type: 'join', id: socket.id });
    } else {
      io.to(id).emit('message', { id: socket.id, type, message });
    }
  });
});

server.listen(process.env.PORT);
