const socket = io();
let myId=null;
let gameState=null;
let myColor="yellow";
let currentRoom=null;

const positions=[
{x:110,y:580},{x:110,y:500},{x:110,y:420},{x:110,y:340},{x:110,y:260},
{x:110,y:180},{x:200,y:120},{x:320,y:100},{x:450,y:100},{x:580,y:100},
{x:700,y:100},{x:820,y:120},{x:900,y:200},{x:900,y:320},{x:900,y:440},
{x:820,y:580},{x:700,y:580},{x:580,y:580},{x:450,y:580},{x:320,y:580}
];

function setColor(c){myColor=c;}

function joinRoom(){
  const name=document.getElementById("nameInput").value;
  const room=document.getElementById("roomInput").value;
  if(!name || !room){alert("Введите имя и код комнаты");return;}
  currentRoom=room;
  socket.emit("joinRoom",{name,room,color:myColor});
  document.getElementById("lobby").style.display="none";
  document.getElementById("game").style.display="block";
}

socket.on("playerId",id=>myId=id);

socket.on("updateRoom",state=>{
  gameState=state;
  render();
});

socket.on("gameOver",w=>alert("Победил: "+w.name));

function rollDice(){
  if(!gameState) return;
  const player=gameState.players[gameState.turn];
  if(player.id!==myId) return;
  socket.emit("rollDice",{room:currentRoom});
}

function render(){
  const board=document.getElementById("board");
  board.innerHTML="";
  if(!gameState) return;

  document.getElementById("turnInfo").innerText="Ход: "+gameState.players[gameState.turn].name;
  document.getElementById("hypeList").innerHTML="";

  gameState.players.forEach(p=>{
    const token=document.createElement("div");
    token.className="token";
    token.style.background=p.color;
    const pos=positions[p.position];
    token.style.left=pos.x+"px";
    token.style.top=pos.y+"px";
    board.appendChild(token);

    document.getElementById("hypeList").innerHTML+=p.name+": "+p.hype+"<br>";
  });

  const lastPlayer=gameState.players.find(p=>p.lastCard);
  if(lastPlayer){
    document.getElementById("cardInfo").innerText=lastPlayer.lastCard;
    delete lastPlayer.lastCard;
  }
}
