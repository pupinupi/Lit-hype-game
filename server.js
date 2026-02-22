const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

let rooms = {};

const cellTypes = [
  "start","h3","h2","scandal","risk","h2","scandal","h3","h5",
  "zero","jail","h3","risk","h3","skip","h2","scandal","h8",
  "zero","h4"
];

const scandalCards = [
  {text:"Перегрел аудиторию 🔥 -1", hype:-1},
  {text:"Громкий заголовок 🫣 -2", hype:-2},
  {text:"Это монтаж 😱 -3", hype:-3},
  {text:"Меня взломали #️⃣ -3 всем", hype:-3, all:true},
  {text:"Подписчики в шоке 😮 -4", hype:-4},
  {text:"Удаляй пока не поздно 🤫 -5", hype:-5},
  {text:"Это контент 🙄 -5 и пропуск", hype:-5, skip:true}
];

io.on("connection", socket => {

  socket.on("joinRoom", ({name, room, color}) => {

    socket.join(room);

    if(!rooms[room]){
      rooms[room] = {
        players: [],
        turn: 0,
        locked: false
      };
    }

    const player = {
      id: socket.id,
      name,
      color,
      position: 0,
      hype: 0,
      skip: false
    };

    rooms[room].players.push(player);

    socket.emit("playerId", socket.id);
    io.to(room).emit("updateRoom", rooms[room]);
  });

  socket.on("rollDice", ({room, value}) => {

    const game = rooms[room];
    if(!game) return;

    if(game.locked) return; // защита от двойного броска

    const player = game.players[game.turn];
    if(!player) return;
    if(player.id !== socket.id) return;

    // пропуск
    if(player.skip){
      player.skip = false;
      nextTurn(game);
      io.to(room).emit("updateRoom", game);
      return;
    }

    game.locked = true;

    // движение просто считаем
    player.position += value;
    if(player.position >= cellTypes.length){
      player.position = cellTypes.length - 1;
    }

    handleCell(player, game, socket);

    if(player.hype < 0) player.hype = 0;

    if(player.hype >= 100){
      io.to(room).emit("gameOver", player);
      delete rooms[room];
      return;
    }

    nextTurn(game);

    game.locked = false;

    io.to(room).emit("updateRoom", game);
  });

});

function handleCell(player, game, socket){

  const cell = cellTypes[player.position];

  if(cell.startsWith("h")){
    player.hype += parseInt(cell.replace("h",""));
  }

  if(cell === "zero"){
    player.hype = 0;
  }

  if(cell === "jail"){
    player.hype = Math.floor(player.hype/2);
    player.skip = true;
    socket.emit("showPopup","Тюрьма: -50% и пропуск");
  }

  if(cell === "skip"){
    player.skip = true;
    socket.emit("showPopup","Пропуск хода");
  }

  if(cell === "risk"){
    const r = Math.floor(Math.random()*6)+1;
    if(r<=3){
      player.hype -= 5;
      socket.emit("showPopup","Риск: "+r+" → -5");
    } else {
      player.hype += 5;
      socket.emit("showPopup","Риск: "+r+" → +5");
    }
  }

  if(cell === "scandal"){
    const card = scandalCards[Math.floor(Math.random()*scandalCards.length)];
    if(card.all){
      game.players.forEach(p=>{
        p.hype += card.hype;
        if(p.hype<0) p.hype=0;
      });
    } else {
      player.hype += card.hype;
    }
    if(card.skip) player.skip = true;
    socket.emit("showPopup", card.text);
  }
}

function nextTurn(game){
  if(game.players.length===0) return;
  game.turn = (game.turn+1)%game.players.length;
}

server.listen(3000, ()=>{
  console.log("Server running");
});
