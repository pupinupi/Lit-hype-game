const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

let rooms = {};

const cellTypes = ["start","h3","h2","scandal","risk","h2","scandal","h3","h5","zero","jail","h3","risk","h3","skip","h2","scandal","h8","zero","h4"];
const scandalCards = [
  {text:"Перегрел аудиторию 🔥 -1", hype:-1, skip:false},
  {text:"Громкий заголовок 🫣 -2", hype:-2, skip:false},
  {text:"Это монтаж 😱 -3", hype:-3, skip:false},
  {text:"Меня взломали #️⃣ -3 всем", hype:-3, skip:false, all:true},
  {text:"Подписчики в шоке 😮 -4", hype:-4, skip:false},
  {text:"Удаляй пока не поздно 🤫 -5", hype:-5, skip:false},
  {text:"Это контент, вы не понимаете 🙄 -5 + пропусти ход", hype:-5, skip:true}
];

io.on("connection", socket => {
  console.log("Новый игрок:", socket.id);

  socket.on("joinRoom", ({name, room, color}) => {
    socket.join(room);
    if(!rooms[room]){
      rooms[room] = {players:[], turn:0};
    }
    const player = {
      id: socket.id,
      name,
      color,
      position:0,
      hype:0,
      skip:false
    };
    rooms[room].players.push(player);
    socket.emit("playerId", socket.id);
    io.to(room).emit("updateRoom", rooms[room]);
  });

  socket.on("rollDice", ({room, value}) => {
    const game = rooms[room];
    if(!game) return;

    const player = game.players[game.turn];
    if(player.id!==socket.id || player.skip) return;

    // Двигаем фишку по клеткам пошагово
    for(let i=0;i<value;i++){
      if(player.position<cellTypes.length-1) player.position++;
    }

    const cell = cellTypes[player.position];

    // Обработка клеток
    if(cell==="risk"){
      const riskRoll = Math.floor(Math.random()*6)+1;
      if(riskRoll <= 3) player.hype -=5;
      else player.hype +=5;
      socket.emit("showPopup","Риск: выпало "+riskRoll+" | Хайп теперь: "+player.hype);
    }

    if(cell==="scandal"){
      const card = scandalCards[Math.floor(Math.random()*scandalCards.length)];
      if(card.all) game.players.forEach(p=>p.hype+=card.hype);
      else player.hype += card.hype;
      if(card.skip) player.skip = true;
      io.to(socket.id).emit("showPopup", card.text);
    }

    if(cell==="skip" || cell==="jail"){
      player.skip=true;
      if(cell==="jail") player.hype = Math.floor(player.hype/2);
    }

    if(player.hype<0) player.hype=0;

    if(player.hype>=100){
      io.to(room).emit("gameOver", player);
      delete rooms[room];
      return;
    }

    // Передаем ход следующему игроку
    let nextIndex = game.turn;
    do {
      nextIndex = (nextIndex+1) % game.players.length;
    } while(game.players[nextIndex].skip);
    game.turn = nextIndex;

    io.to(room).emit("updateRoom", game);
  });

  socket.on("disconnect", ()=>{
    for(const room in rooms){
      rooms[room].players = rooms[room].players.filter(p=>p.id!==socket.id);
      if(rooms[room].players.length===0) delete rooms[room];
      else io.to(room).emit("updateRoom", rooms[room]);
    }
  });
});

server.listen(3000, ()=>console.log("Сервер запущен на порту 3000"));
