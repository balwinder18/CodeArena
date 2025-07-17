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
    {
        id: 'isEven',
        title: "Is Even?",
        description: "Write a function that takes a number `n` and returns `true` if it's even, `false` otherwise.",
        example: "Input: n = 4\nOutput: true",
        testCases: [
            { input: [2], expectedOutput: true },
            { input: [3], expectedOutput: false },
            { input: [0], expectedOutput: true },
            { input: [100], expectedOutput: true },
            { input: [99], expectedOutput: false },
        ],
        correctSolutionSnippet: "return n % 2 === 0;",
    }
];

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

        // Select a random problem
        const randomIndex = Math.floor(Math.random() * PROBLEMS.length);
        const selectedProblem = PROBLEMS[randomIndex];

        room.status = 'in-progress';
        room.problemId = selectedProblem.id; // Store the problem ID
        room.winnerId = null; // Reset winner for new game

        // Reset player states for the new game
        room.players.forEach(p => {
            p.code = '';
            p.passedTests = 0;
            p.lastSubmissionTime = null; // Ensure submission time is reset
        });

        // Broadcast 'gameStarted' to all clients in the room
        io.to(roomId).emit('gameStarted', { problemId: selectedProblem.id });
        console.log(`Server: Game started in room ${roomId} with problem: ${selectedProblem.title}`);
    });

    // New: Handle 'codeChange' event (for live opponent code view)
    socket.on('codeChange', ({ roomId, code }) => {
        const room = rooms[roomId];
        if (room && room.status === 'in-progress') {
            const player = getPlayerState(roomId, socket.id);
            if (player) {
                player.code = code; // Update player's code on the server
                // Broadcast code update to other players in the room
                socket.to(roomId).emit('codeUpdate', { playerId: socket.id, code });
            }
        }
    });

    // New: Handle 'submitSolution' event
    socket.on('submitSolution', ({ roomId, passedTests }) => {
        console.log(`Server: Received submitSolution from ${socket.id} in room ${roomId} with ${passedTests} tests passed.`);
        const room = rooms[roomId];
        if (!room || room.status !== 'in-progress') {
            socket.emit('roomError', 'Game not in progress.');
            return;
        }

        const player = getPlayerState(roomId, socket.id);
        if (player) {
            player.passedTests = passedTests;
            // Record submission time for tie-breaking
            player.lastSubmissionTime = new Date().getTime();

            // Broadcast test results to all clients in the room
            io.to(roomId).emit('testResultsUpdate', { playerId: socket.id, passedTests });
            console.log(`Server: Player ${player.name} (${socket.id}) in room ${roomId} submitted with ${passedTests} passed tests.`);

            // Check for winner
            const problem = PROBLEMS.find(p => p.id === room.problemId);
            if (problem && passedTests === problem.testCases.length) {
                // This player solved all tests
                if (room.status !== 'finished') { // Prevent multiple winner declarations
                    room.winnerId = socket.id;
                    room.status = 'finished';
                    io.to(roomId).emit('gameFinished', { winnerId: socket.id });
                    console.log(`Server: Game in room ${roomId} finished. Winner: ${player.name}`);
                }
            } else {
                // If the other player already solved, they are the winner
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                if (otherPlayer && problem && otherPlayer.passedTests === problem.testCases.length) {
                    if (room.status !== 'finished') { // Prevent multiple winner declarations
                        room.winnerId = otherPlayer.id;
                        room.status = 'finished';
                        io.to(roomId).emit('gameFinished', { winnerId: otherPlayer.id });
                        console.log(`Server: Game in room ${roomId} finished. Winner: ${otherPlayer.name}`);
                    }
                }
            }
            // If game is still in progress and both players have submitted (even partially)
            // This logic should ideally be triggered when both players have submitted *and* the full solution isn't found
            // For simplicity, we'll keep it here, but a more robust judge would handle this.
            if (room.status === 'in-progress' && room.players.every(p => p.lastSubmissionTime !== null)) {
                console.log(`Server: Both players submitted in room ${roomId}, determining winner based on partial results or time.`);
                const p1 = room.players[0];
                const p2 = room.players[1];

                if (p1.passedTests > p2.passedTests) {
                    room.winnerId = p1.id;
                } else if (p2.passedTests > p1.passedTests) {
                    room.winnerId = p2.id;
                } else {
                    // Tie in passed tests, check submission time (earlier time wins)
                    if (p1.lastSubmissionTime < p2.lastSubmissionTime) {
                        room.winnerId = p1.id;
                    } else if (p2.lastSubmissionTime < p1.lastSubmissionTime) {
                        room.winnerId = p2.id;
                    } else {
                        room.winnerId = 'draw'; // Actual draw
                    }
                }
                room.status = 'finished';
                io.to(roomId).emit('gameFinished', { winnerId: room.winnerId });
                console.log(`Server: Game in room ${roomId} finished by partial solutions/time. Winner: ${room.winnerId}`);
            }
        }
    });

    // New: Handle 'resetGame' event
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
                p.lastSubmissionTime = null; // Clear submission time
            });
            io.to(roomId).emit('gameReset');
            console.log(`Server: Room ${roomId} game state reset.`);
        }
    });

    // Add more Socket.IO event handlers here for game logic later (e.g., 'submitCode', 'runTests', 'gameUpdate')
});

server.listen(PORT, () => {
    console.log(`Socket.IO server listening on port ${PORT}`);
});
