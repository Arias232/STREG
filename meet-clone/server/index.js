const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const rooms = {}; // { roomId: [socketId1, socketId2, ...] }

io.on('connection', (socket) => {
  console.log('✅ Nuevo usuario conectado:', socket.id);

  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`🆕 Sala creada: ${roomId}`);
    }

    socket.roomId = roomId;
    rooms[roomId].push(socket.id);
    socket.join(roomId);

    const otherUsers = rooms[roomId].filter(id => id !== socket.id);
    console.log(`📥 Usuario ${socket.id} se unió a sala ${roomId}`);
    console.log(`👥 Usuarios actuales en sala ${roomId}:`, rooms[roomId]);

    socket.emit('all-users', otherUsers);

    if (otherUsers.length > 0) {
      console.log(`📡 Notificando a otros usuarios de la sala ${roomId} que se unió ${socket.id}`);
    }

    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('offer', ({ to, sdp }) => {
    console.log(`📤 Oferta de ${socket.id} para ${to}`);
    io.to(to).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ to, sdp }) => {
    console.log(`📩 Respuesta de ${socket.id} para ${to}`);
    io.to(to).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`❄️ ICE Candidate de ${socket.id} para ${to}`);
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    console.log(`❌ Usuario desconectado: ${socket.id}`);

    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit('user-disconnected', socket.id);

      console.log(`🔄 Sala ${roomId} actualizada:`, rooms[roomId]);

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`🗑️ Sala ${roomId} eliminada por estar vacía.`);
      }
    }
  });
});

server.listen(3001, '0.0.0.0', () => {
  console.log('🚀 Servidor (Express + Socket.IO) escuchando en LAN por puerto 3001');
});
