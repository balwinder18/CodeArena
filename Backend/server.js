// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const shortid = require('shortid'); 
const connectdb = require('./services/db');
const { getRandomProblem, getProblemById } = require('./services/problemservice');
const connectRedis = require('./services/redis');

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





// redis


async function createRoom(roomId, roomData) {

  await client.set(`room:${roomId}`, JSON.stringify(roomData));
  
}

async function createPlayerMap(roomId, playerId) {

  await client.set(`player:${playerId}:room`, roomId);
}

async function deletePlayerMap(playerId) {
  await client.del(`player:${playerId}:room`);
}

async function getPlayerMap(playerId) {
  const data = await client.get(`player:${playerId}:room`);
  return data ? data : null;
}


async function getRoom(roomId) {
  const data = await client.get(`room:${roomId}`);
  return data ? JSON.parse(data) : null;
}

async function updateRoom(roomId, newData) {
  await client.set(`room:${roomId}`, JSON.stringify(newData));
}

async function deleteRoom(roomId) {
  await client.del(`room:${roomId}`);
}

async function roomExists(roomId) {
  const exists = await client.exists(`room:${roomId}`);
  return exists === 1;
}









io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    
    socket.on('createRoom', async ({ playerName }) => {
        const roomId = shortid.generate(); 
        const roomData = {
            id: roomId,
            players: [{ id: socket.id, name: playerName }],
            status: 'waiting', 
            
        };

        await createRoom(roomId , roomData);
        await createPlayerMap(roomId,socket.id)
        socket.join(roomId); 

        const room = await getRoom(roomId);
        socket.emit('roomCreated', { roomId, players: room.players });
        console.log(`Room ${roomId} created by ${playerName} (${socket.id})`);
    });


    socket.on('leaveRoom', async ({ roomId }) => {
        console.log(`Server: Received 'leaveRoom' event from ${socket.id} for room ${roomId}`);
        const room =await getRoom(roomId);
        if (!room) return;
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                await deletePlayerMap(socket.id);
                socket.leave(roomId);

                console.log(`${playerName} (${socket.id}) left room ${roomId}.`);

                if (room.players.length === 0) {
                   await deleteRoom(roomId);
                    console.log(`Room ${roomId} is empty and has been deleted.`);
                } else {
                    updateRoom(roomId,room);
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                }
            }
        }
    });

   socket.on('giveUp',async ({ roomId }) => {
    const room = await getRoom(roomId);
    if (!room) return;

    const loser = room.players.find(p => p.id === socket.id);
    const winner = room.players.find(p => p.id !== socket.id);

    if (loser && winner) {
        io.to(roomId).emit('playerGaveUp', { loser: loser.name, winner: winner.name });
       await deleteRoom(roomId); 
    }
});

    
    socket.on('joinRoom',async ({ roomId, playerName }) => {
        if (!(await roomExists(roomId))) {
           
            socket.emit('roomError', 'Room does not exist.');
            return;
        }

        const room = await getRoom(roomId);

       
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
        await updateRoom(roomId,room);
        await createPlayerMap(roomId,socket.id);
        socket.join(roomId);

        
        socket.emit('roomJoined', { roomId, players: room.players });
        console.log(`${playerName} (${socket.id}) joined room ${roomId}`);

       
        socket.to(roomId).emit('playerJoinedRoom', { players: room.players, playerName });

        
        if (room.players.length === 2) {
           
            console.log(`Room ${roomId} now has two players. Ready to start.`);
        }
    });

    
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);

        const roomId = await getPlayerMap(socket.id);
        if (!room) return;
        
        if (roomId) {
            const room =await getRoom(roomId);
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
               
               
                if (room.players.length === 0) {
                  await deleteRoom(roomId);
                    console.log(`Room ${roomId} is now empty and deleted.`);
                } else {
                
                    io.to(roomId).emit('playerLeftRoom', { players: room.players, playerName });
                   await updateRoom(roomId,room);
                   await deletePlayerMap(socket.id);
                    console.log(`${playerName} (${socket.id}) left room ${roomId}. Remaining players: ${room.players.length}`);
                }
                
            }
        }
    });

   socket.on('startGame', async ({ roomId }) => {
        console.log(`Server: Received 'startGame' event for room: ${roomId} from ${socket.id}`);
        const room =await getRoom(roomId);
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
        
        room.problemId = selectedProblem.id; 
        room.winnerId = null; 
        
      
        room.players.forEach(p => {
            p.code = '';
            p.passedTests = 0;
            p.lastSubmissionTime = null; 
        });

        await updateRoom(roomId,room);
        
        io.to(roomId).emit('gameStarted',  { problem: selectedProblem });
        
        console.log(`Server: Game started in room ${roomId} with problem: ${selectedProblem.title}`);
    });
    
   
   
       socket.on('submitSolution', async ({ roomId, passedTests }) => {
        console.log(`Submission from ${socket.id} in room ${roomId} with ${passedTests} tests passed.`);
        const room = await getRoom(roomId);
        
        if (!room || room.status !== 'in-progress') {
            console.log(room.status);
            console.log(`Room ${roomId} not found or game not in progress`);
          
            return;
        }

        const playerIndex = room.players.findIndex(p => p.id === socket.id);

        if (playerIndex !== -1) {
          
            room.players[playerIndex].passedTests = passedTests;
            
            io.to(roomId).emit('testResultsUpdate', { playerId: socket.id, passedTests });
            await updateRoom(roomId,room);
            const problem = await getProblemById(room.problemId);
            if (problem && passedTests === problem.testCases.length) {
                room.winnerId = socket.id;
                room.status = 'finished';
                io.to(roomId).emit('gameFinished', { winnerId: socket.id });
                await updateRoom(roomId,room);
                const winner = room.players[playerIndex];
                console.log(`Game in room ${roomId} finished. Winner: ${winner.name}`);
            }
        }
    });

   
    socket.on('resetGame', async ({ roomId }) => {
        console.log(`Server: Received 'resetGame' event for room: ${roomId}`);
        const room = await getRoom(roomId);
        if (room) {
            room.status = 'waiting';
            room.problemId = null;
            room.winnerId = null;
            room.players.forEach(p => {
                p.code = '';
                p.passedTests = 0;
                p.lastSubmissionTime = null; 
            });

            await updateRoom(roomId,room);
            io.to(roomId).emit('gameReset');
            console.log(`Server: Room ${roomId} game state reset.`);
        }
    });

   
});

let client;

(async () => {
  client = await connectRedis();
  server.listen(PORT, () => {
    console.log(`Socket.IO server listening on port ${PORT}`);
  });
})();