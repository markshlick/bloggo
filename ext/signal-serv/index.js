// @ts-check

const http = require('http');
const IO = require('socket.io');

const server = http.createServer(async (req, res) => {
  res.writeHead(404).end();
});

const io = IO(server);

io.on('connection', (socket) => {
  socket.on('message', async ({ id, type, value }) => {
    if (type === 'join') {
      socket.broadcast.emit('message', { type: 'join', id: socket.id });
    } else {
      io.to(id).emit('message', { id: socket.id, type, value });
    }
  });
});

server.listen(process.env.PORT);
