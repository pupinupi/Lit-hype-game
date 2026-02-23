const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

const cells = [
  {type:"start"},
  {type:"hype", value:3},
  {type:"hype", value:2},
  {type:"scandal"},
  {type:"risk"},
  {type:"hype", value:2},
  {type:"scandal"},
  {type:"hype", value:3},
  {type:"hype", value:5},
  {type:"zero"},
  {type:"jail"},
  {type:"hype", value:3},
  {type:"risk"},
  {type:"hype", value:3},
  {type:"skip"},
  {type:"hype", value:2},
  {type:"scandal"},
  {type:"hype", value:8},
  {type:"zero"},
  {type:"hype", value:4}
];

const scandalCards = [
  {text:"🔥 Перегрел аудиторию -1", hype:-1},
  {text:"🫣 Громкий заголовок -2", hype:-2},
  {text:"😱 Это монтаж -3", hype:-3},
  {text:"#️⃣ Меня взломали -3 всем", hype:-3, all:true},
  {text:"😮 Подписчики в шоке -4", hype:-4},
  {text:"🤫 Удаляй пока не поздно -5", hype:-5},
  {text:"🙄 Это контент -5 и пропуск", hype:-5, skip:true}
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
      message:""
    });

    socket.emit("playerId", socket.id);
    io.to(room).emit("updateGame", rooms[room]);
  });

  socket.on("rollDice", ({room}) => {

    const game = rooms[room];
    if(!game) return;

    const player = game.players[game.turn];
    if(!player || player.id !== socket.id) return;

    if(player.skip){
      player.skip = false;
      player.message = "Пропуск хода";
      nextTurn(game);
      io.to(room).emit("updateGame", game);
      return;
    }

    const dice = Math.floor(Math.random()*6)+1;
    player.lastDice = dice;
    player.message = "";

    player.position = (player.position + dice) % 20;

    applyCell(game, player);

    game.players.forEach(p=>{
      if(p.hype < 0) p.hype = 0;
    });

    if(player.hype >= 100){
      io.to(room).emit("gameOver", player);
      delete rooms[room];
      return;
    }

    nextTurn(game);
    io.to(room).emit("updateGame", game);
  });

});

function applyCell(game, player){

  const cell = cells[player.position];

  if(cell.type === "hype"){
    player.hype += cell.value;
    player.message = "+" + cell.value + " хайп";
  }

  if(cell.type === "zero"){
    player.hype = 0;
    player.message = "Потеря всего хайпа";
  }

  if(cell.type === "jail"){
    player.hype = Math.floor(player.hype/2);
    player.skip = true;
    player.message = "Тюрьма: -50% и пропуск";
  }

  if(cell.type === "skip"){
    player.skip = true;
    player.message = "Пропуск хода";
  }

  if(cell.type === "risk"){
    const r = Math.floor(Math.random()*6)+1;
    if(r <= 3){
      player.hype -= 5;
      player.message = "Риск: -5 хайп";
    } else {
      player.hype += 5;
      player.message = "Риск: +5 хайп";
    }
  }

  if(cell.type === "scandal"){
    const card = scandalCards[Math.floor(Math.random()*scandalCards.length)];

    if(card.all){
      game.players.forEach(p=>p.hype += card.hype);
    } else {
      player.hype += card.hype;
    }

    if(card.skip) player.skip = true;
    player.message = card.text;
  }
}

function nextTurn(game){
  game.turn = (game.turn + 1) % game.players.length;
}

server.listen(3000);
