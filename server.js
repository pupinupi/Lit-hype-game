const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

const cells = [
  "start","h3","h2","scandal","risk","h2","scandal","h3","h5",
  "zero","jail","h3","risk","h3","skip","h2","scandal","h8",
  "zero","h4"
];

const scandalCards = [
  {text:"Перегрел аудиторию -1", hype:-1},
  {text:"Громкий заголовок -2", hype:-2},
  {text:"Это монтаж -3", hype:-3},
  {text:"Меня взломали -3 всем", hype:-3, all:true},
  {text:"Подписчики в шоке -4", hype:-4},
  {text:"Удаляй пока не поздно -5", hype:-5},
  {text:"Это контент -5 и пропуск", hype:-5, skip:true}
];

io.on("connection", socket => {

  socket.on("joinRoom", ({name, room, color}) => {

    socket.join(room);

    if(!rooms[room]){
      rooms[room] = {players:[], turn:0};
    }

    rooms[room].players.push({
      id:socket.id,
      name,
      color,
      position:0,
      hype:0,
      skip:false,
      lastDice:0,
      lastCard:null
    });

    socket.emit("playerId", socket.id);
    io.to(room).emit("updateRoom", rooms[room]);
  });

  socket.on("rollDice", ({room}) => {

    const game = rooms[room];
    if(!game) return;

    const player = game.players[game.turn];
    if(!player || player.id !== socket.id) return;

    if(player.skip){
      player.skip=false;
      nextTurn(game);
      io.to(room).emit("updateRoom", game);
      return;
    }

    const dice = Math.floor(Math.random()*6)+1;
    player.lastDice = dice;

    player.position = (player.position + dice) % cells.length;

    handleCell(player, game);

    if(player.hype < 0) player.hype = 0;

    if(player.hype >= 100){
      io.to(room).emit("gameOver", player);
      delete rooms[room];
      return;
    }

    nextTurn(game);
    io.to(room).emit("updateRoom", game);
  });

});

function handleCell(player, game){

  const cell = cells[player.position];

  if(cell.startsWith("h")){
    player.hype += parseInt(cell.slice(1));
  }

  if(cell==="zero"){
    player.hype = 0;
  }

  if(cell==="jail"){
    player.hype = Math.floor(player.hype/2);
    player.skip = true;
  }

  if(cell==="skip"){
    player.skip = true;
  }

  if(cell==="risk"){
    const r = Math.floor(Math.random()*6)+1;
    player.hype += r<=3 ? -5 : 5;
  }

  if(cell==="scandal"){
    const card = scandalCards[Math.floor(Math.random()*scandalCards.length)];
    if(card.all){
      game.players.forEach(p=>p.hype += card.hype);
    } else {
      player.hype += card.hype;
    }
    if(card.skip) player.skip = true;
  }
}

function nextTurn(game){
  game.turn = (game.turn + 1) % game.players.length;
}

server.listen(3000, ()=>console.log("Server running"));
