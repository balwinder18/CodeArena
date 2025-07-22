// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const shortid = require('shortid'); 

const app = express();
const server = http.createServer(app);
require('dotenv').config();


const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // IMPORTANT: Change this to your React app's actual URL
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001; 



const rooms = {}; // { roomId: { players: [{ id, name }], status: 'waiting', ... } }

const PROBLEMS = [
    {
        id: 'sumTwoNumbers',
        title: "Sum of Two Numbers",
        description: "Write a function that takes two numbers, `a` and `b`, and returns their sum.",
        example: "Input: a = 5, b = 3\nOutput: 8",
        testCases: [
            { input: [1, 2], expectedOutput: 3 },
            { input: [5, 5], expectedOutput: 10 },
            { input: [-1, 1], expectedOutput: 0 },
            { input: [0, 0], expectedOutput: 0 },
            { input: [100, 200], expectedOutput: 300 },
        ],
        correctSolutionSnippet: "return a + b;",
    },
    {
        id: 'multiplyByTen',
        title: "Multiply by Ten",
        description: "Write a function that takes a number `x` and returns `x` multiplied by 10.",
        example: "Input: x = 7\nOutput: 70",
        testCases: [
            { input: [1], expectedOutput: 10 },
            { input: [0], expectedOutput: 0 },
            { input: [-5], expectedOutput: -50 },
            { input: [100], expectedOutput: 1000 },
        ],
        correctSolutionSnippet: "return x * 10;",
    },
    
];

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
                // Remove the player from the room
                room.players.splice(playerIndex, 1);
                socket.leave(roomId);

                console.log(`${playerName} (${socket.id}) left room ${roomId}.`);

                // If the room is now empty, delete it
                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} is empty and has been deleted.`);
                } else {
                    // Otherwise, notify the remaining player
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                }
            }
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

    socket.on('startGame', ({ roomId }) => {
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

      
        const randomIndex = Math.floor(Math.random() * PROBLEMS.length);
        const selectedProblem = PROBLEMS[randomIndex];

        room.status = 'in-progress';
        room.problemId = selectedProblem.id; 
        room.winnerId = null; 

      
        room.players.forEach(p => {
            p.code = '';
            p.passedTests = 0;
            p.lastSubmissionTime = null; 
        });

        
        io.to(roomId).emit('gameStarted', { problemId: selectedProblem.id });
        console.log(`Server: Game started in room ${roomId} with problem: ${selectedProblem.title}`);
    });

    
    // socket.on('codeChange', ({ roomId, code }) => {
    //     const room = rooms[roomId];
    //     if (room && room.status === 'in-progress') {
    //         const player = getPlayerState(roomId, socket.id);
    //         if (player) {
    //             player.code = code; 
    //             socket.to(roomId).emit('codeUpdate', { playerId: socket.id, code });
    //         }
    //     }
    // });

   
       socket.on('submitSolution', ({ roomId, passedTests }) => {
        console.log(`Submission from ${socket.id} in room ${roomId} with ${passedTests} tests passed.`);
        const room = rooms[roomId];
        
        // Ensure the room exists and the game is in progress
        if (!room || room.status !== 'in-progress') {
            return;
        }

        const player = getPlayerState(roomId, socket.id);
        if (player) {
            player.passedTests = passedTests;

            // Broadcast the latest test results to everyone in the room
            io.to(roomId).emit('testResultsUpdate', { playerId: socket.id, passedTests });

            // Check for a winner
            const problem = PROBLEMS.find(p => p.id === room.problemId);
            if (problem && passedTests === problem.testCases.length) {
                // This player is the first to solve all test cases
                room.winnerId = socket.id;
                room.status = 'finished';
                io.to(roomId).emit('gameFinished', { winnerId: socket.id });
                console.log(`Game in room ${roomId} finished. Winner: ${player.name}`);
            }
            // NOTE: All other logic for partial scores or time-based wins has been removed.
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
