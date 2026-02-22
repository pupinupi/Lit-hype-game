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
      rooms[room] = {players:[], turn:0, locked:false};
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

  socket.on("rollDice", ({room}) => {

    const game = rooms[room];
    if(!game || game.locked) return;

    const player = game.players[game.turn];
    if(!player || player.id!==socket.id) return;

    if(player.skip){
      player.skip=false;
      nextTurn(game);
      io.to(room).emit("updateRoom",game);
      return;
    }

    game.locked=true;

    // бросок кубика
    const dice=Math.floor(Math.random()*6)+1;
    player.lastDice=dice;

    movePlayer(player,dice,game,()=>{
      nextTurn(game);
      game.locked=false;
      io.to(room).emit("updateRoom",game);
    });
  });

  socket.on("disconnect",()=>{
    for(const room in rooms){
      rooms[room].players = rooms[room].players.filter(p=>p.id!==socket.id);
      if(rooms[room].players.length===0) delete rooms[room];
      else io.to(room).emit("updateRoom",rooms[room]);
    }
  });
});

// движение по шагам с подсчётом хайпа и скандалов
function movePlayer(player,steps,game,callback){
  if(steps<=0 || player.position>=cellTypes.length-1){
    callback();
    return;
  }
  player.position++;
  const cell = cellTypes[player.position];

  if(cell.startsWith("h")) player.hype+=parseInt(cell.replace("h",""));
  if(cell==="zero") player.hype=0;
  if(cell==="jail"){player.hype=Math.floor(player.hype/2); player.skip=true;}
  if(cell==="skip") player.skip=true;
  if(cell==="risk"){
    const r=Math.floor(Math.random()*6)+1;
    player.hype += r<=3?-5:5;
  }
  if(cell==="scandal"){
    const card = scandalCards[Math.floor(Math.random()*scandalCards.length)];
    if(card.all) game.players.forEach(p=>p.hype=Math.max(0,p.hype+card.hype));
    else player.hype=Math.max(0,player.hype+card.hype);
    if(card.skip) player.skip=true;
    player.lastCard=card.text;
  }

  // авто-пропуск при перегреве +8 за ход
  if(player.hype>=100){
    player.hype=100;
  }

  // передаём следующий шаг через setTimeout чтобы анимация была видна на фронте
  setTimeout(()=>movePlayer(player,steps-1,game,callback),300);
}

function nextTurn(game){
  if(game.players.length===0) return;
  game.turn=(game.turn+1)%game.players.length;
}

server.listen(3000,()=>console.log("Server running"));
