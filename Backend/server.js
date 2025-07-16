// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const shortid = require('shortid'); // For generating unique room IDs

const app = express();
const server = http.createServer(app);

// Configure Socket.IO to allow connections from your React app's origin
// Replace 'http://localhost:3000' with the actual URL where your React app is running
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // IMPORTANT: Change this to your React app's actual URL
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001; // Server will run on port 3001

// In-memory storage for rooms and players.
// In a real application, you'd use a database (like Firestore, MongoDB, Redis) for persistence.
const rooms = {}; // { roomId: { players: [{ id, name }], status: 'waiting', ... } }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle 'createRoom' event
    socket.on('createRoom', ({ playerName }) => {
        const roomId = shortid.generate(); // Generate a unique room ID
        rooms[roomId] = {
            id: roomId,
            players: [{ id: socket.id, name: playerName }],
            status: 'waiting', // 'waiting', 'in-progress', 'finished'
            // Add other room-specific data here, like problem statement, scores, etc.
        };
        socket.join(roomId); // Make the socket join the room

        // Emit 'roomCreated' event back to the client that created the room
        socket.emit('roomCreated', { roomId, players: rooms[roomId].players });
        console.log(`Room ${roomId} created by ${playerName} (${socket.id})`);
    });

    // Handle 'joinRoom' event
    socket.on('joinRoom', ({ roomId, playerName }) => {
        if (!rooms[roomId]) {
            // Room does not exist
            socket.emit('roomError', 'Room does not exist.');
            return;
        }

        const room = rooms[roomId];

        // Check if player is already in the room (e.g., refreshing)
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (existingPlayer) {
            console.log(`${playerName} (${socket.id}) rejoining room ${roomId}`);
            socket.join(roomId);
            socket.emit('roomJoined', { roomId, players: room.players });
            return;
        }

        // Limit to 2 players for 1v1
        if (room.players.length >= 2) {
            socket.emit('roomError', 'Room is full.');
            return;
        }

        // Add player to the room
        room.players.push({ id: socket.id, name: playerName });
        socket.join(roomId); // Make the socket join the room

        // Emit 'roomJoined' event back to the client that joined
        socket.emit('roomJoined', { roomId, players: room.players });
        console.log(`${playerName} (${socket.id}) joined room ${roomId}`);

        // Broadcast 'playerJoinedRoom' to all other clients in the room
        socket.to(roomId).emit('playerJoinedRoom', { players: room.players, playerName });

        // If two players are now in the room, you could potentially start the game here
        if (room.players.length === 2) {
            // io.to(roomId).emit('gameReady', { message: 'Two players are ready! Game can start.' });
            console.log(`Room ${roomId} now has two players. Ready to start.`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Find which room the disconnected user was in and update it
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1); // Remove player

                // If room becomes empty, delete it (optional, depends on persistence needs)
                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} is now empty and deleted.`);
                } else {
                    // Notify remaining players that someone left
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                    console.log(`${playerName} (${socket.id}) left room ${roomId}. Remaining players: ${room.players.length}`);
                }
                break; // Player found and handled, exit loop
            }
        }
    });

    // Add more Socket.IO event handlers here for game logic later (e.g., 'submitCode', 'runTests', 'gameUpdate')
});

server.listen(PORT, () => {
    console.log(`Socket.IO server listening on port ${PORT}`);
});
