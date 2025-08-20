// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const shortid = require('shortid'); 
const connectdb = require('./services/db');
const { getRandomProblem, getProblemById } = require('./services/problemservice');

const app = express();
const server = http.createServer(app);
require('dotenv').config();


connectdb();

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001; 



const rooms = {}; // { roomId: { players: [{ id, name }], status: 'waiting', ... } }


const getPlayerState = (roomId, playerId) => {
    const room = rooms[roomId];
    if (room) {
       
        return room.players.find(p => p.id === playerId);
    }
    return null;
};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    
    socket.on('createRoom', ({ playerName }) => {
        const roomId = shortid.generate(); 
        rooms[roomId] = {
            id: roomId,
            players: [{ id: socket.id, name: playerName }],
            status: 'waiting', 
            
        };
        socket.join(roomId); 

      
        socket.emit('roomCreated', { roomId, players: rooms[roomId].players });
        console.log(`Room ${roomId} created by ${playerName} (${socket.id})`);
    });


    socket.on('leaveRoom', ({ roomId }) => {
        console.log(`Server: Received 'leaveRoom' event from ${socket.id} for room ${roomId}`);
        const room = rooms[roomId];
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                socket.leave(roomId);

                console.log(`${playerName} (${socket.id}) left room ${roomId}.`);

                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} is empty and has been deleted.`);
                } else {
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                }
            }
        }
    });

   socket.on('giveUp', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const loser = room.players.find(p => p.id === socket.id);
    const winner = room.players.find(p => p.id !== socket.id);

    if (loser && winner) {
        io.to(roomId).emit('playerGaveUp', { loser: loser.name, winner: winner.name });
        delete rooms[roomId]; 
    }
});

    
    socket.on('joinRoom', ({ roomId, playerName }) => {
        if (!rooms[roomId]) {
           
            socket.emit('roomError', 'Room does not exist.');
            return;
        }

        const room = rooms[roomId];

       
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (existingPlayer) {
            console.log(`${playerName} (${socket.id}) rejoining room ${roomId}`);
            socket.join(roomId);
            socket.emit('roomJoined', { roomId, players: room.players });
            return;
        }

       
        if (room.players.length >= 2) {
            socket.emit('roomError', 'Room is full.');
            return;
        }

      
        room.players.push({ id: socket.id, name: playerName });
        socket.join(roomId);

        
        socket.emit('roomJoined', { roomId, players: room.players });
        console.log(`${playerName} (${socket.id}) joined room ${roomId}`);

       
        socket.to(roomId).emit('playerJoinedRoom', { players: room.players, playerName });

        
        if (room.players.length === 2) {
           
            console.log(`Room ${roomId} now has two players. Ready to start.`);
        }
    });

    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);

               
                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} is now empty and deleted.`);
                } else {
                
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                    console.log(`${playerName} (${socket.id}) left room ${roomId}. Remaining players: ${room.players.length}`);
                }
                break; 
            }
        }
    });

   socket.on('startGame', async ({ roomId }) => {
        console.log(`Server: Received 'startGame' event for room: ${roomId} from ${socket.id}`);
        const room = rooms[roomId];
        if (!room) {
            console.log(`Server: Error: Room ${roomId} not found for startGame.`);
            socket.emit('roomError', 'Room not found.');
            return;
        }
        if (room.players.length < 2) {
            console.log(`Server: Error: Not enough players in room ${roomId} (${room.players.length}).`);
            socket.emit('roomError', 'Need two players to start the game.');
            return;
        }
        if (room.status === 'in-progress') {
            console.log(`Server: Error: Game already in progress in room ${roomId}.`);
            socket.emit('roomError', 'Game already in progress.');
            return;
        }

        const selectedProblem = await getRandomProblem();

        if (!selectedProblem) {
            console.log(`Server: Error: No problems found in the database.`);
            io.to(roomId).emit('roomError', 'Could not start the game. No problems are available.');
            return;
        }

        room.status = 'in-progress';
        // We still store just the ID on the server for reference
        room.problemId = selectedProblem.id; 
        room.winnerId = null; 

      
        room.players.forEach(p => {
            p.code = '';
            p.passedTests = 0;
            p.lastSubmissionTime = null; 
        });

        // This is the corrected line that sends the FULL object
        io.to(roomId).emit('gameStarted',  { problem: selectedProblem });
        
        console.log(`Server: Game started in room ${roomId} with problem: ${selectedProblem.title}`);
    });
    
   
   
       socket.on('submitSolution', async ({ roomId, passedTests }) => {
        console.log(`Submission from ${socket.id} in room ${roomId} with ${passedTests} tests passed.`);
        const room = rooms[roomId];
        
        if (!room || room.status !== 'in-progress') {
            return;
        }

        const player = getPlayerState(roomId, socket.id);
        if (player) {
            player.passedTests = passedTests;

            io.to(roomId).emit('testResultsUpdate', { playerId: socket.id, passedTests });

            const problem = await getProblemById(room.problemId);
            if (problem && passedTests === problem.testCases.length) {
                room.winnerId = socket.id;
                room.status = 'finished';
                io.to(roomId).emit('gameFinished', { winnerId: socket.id });
                console.log(`Game in room ${roomId} finished. Winner: ${player.name}`);
            }
        }
    });

   
    socket.on('resetGame', ({ roomId }) => {
        console.log(`Server: Received 'resetGame' event for room: ${roomId}`);
        const room = rooms[roomId];
        if (room) {
            room.status = 'waiting';
            room.problemId = null;
            room.winnerId = null;
            room.players.forEach(p => {
                p.code = '';
                p.passedTests = 0;
                p.lastSubmissionTime = null; 
            });
            io.to(roomId).emit('gameReset');
            console.log(`Server: Room ${roomId} game state reset.`);
        }
    });

   
});

server.listen(PORT, () => {
    console.log(`Socket.IO server listening on port ${PORT}`);
});
