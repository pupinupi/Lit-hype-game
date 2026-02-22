const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.static(__dirname + "/public"));
app.get("/", (req,res) => res.sendFile(__dirname + "/public/index.html"));

const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*"}});

const rooms={};

io.on("connection", socket => {

  socket.on("joinRoom", ({name,room,color})=>{
    if(!rooms[room]) rooms[room]={players:[], turn:0};
    if(rooms[room].players.length>=4) return;

    const player={id:socket.id,name,color,position:0,hype:0,skip:false,lastGain:0};
    rooms[room].players.push(player);
    socket.join(room);
    io.to(room).emit("updateRoom", rooms[room]);
  });

  socket.on("rollDice", ({room})=>{
    const game = rooms[room];
    if(!game) return;
    const player = game.players[game.turn];
    if(!player || player.id !== socket.id) return;

    if(player.skip){
      player.skip=false;
      game.turn=(game.turn+1)%game.players.length;
      io.to(room).emit("updateRoom", game);
      return;
    }

    const dice = Math.floor(Math.random()*6)+1;
    player.nextMove=dice; // передаём количество шагов
    player.position=(player.position+dice)%20;

    handleCell(player, game);

    if(player.hype>=100){
      io.to(room).emit("gameOver", player);
      return;
    }

    game.turn=(game.turn+1)%game.players.length;
    io.to(room).emit("updateRoom", game);
  });

  socket.on("disconnect", ()=>{
    for(const r in rooms) rooms[r].players=rooms[r].players.filter(p=>p.id!==socket.id);
  });

});

function handleCell(player,game){
  const cells=[
    "start","h3","h2","scandal","risk","h2","scandal","h3","h5",
    "zero","jail","h3","risk","h3","skip","h2","scandal","h8",
    "zero","h4"
  ];
  const cell=cells[player.position];
  player.lastGain=0;

  if(cell.startsWith("h")){
    const val=parseInt(cell.replace("h",""));
    player.hype+=val;
    player.lastGain+=val;
  }

  if(cell==="zero") player.hype=0;
  if(cell==="jail"){player.hype=Math.floor(player.hype/2); player.skip=true;}
  if(cell==="skip") player.skip=true;
  if(cell==="risk"){const r=Math.floor(Math.random()*6)+1; player.hype+=r>3?5:-5;}
  if(cell==="scandal"){const p=[-1,-2,-3,-3,-4,-5,-5]; player.hype+=p[Math.floor(Math.random()*p.length)];}

  if(player.hype<0) player.hype=0;
  if(player.lastGain>8) player.skip=true;
}

server.listen(process.env.PORT||3001,()=>console.log("Server running 🚀"));
