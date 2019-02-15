const express = require('express');
const socket = require('socket.io');
const Max = require('max-api');
const path = require('path');

Max.post(`Loaded the ${path.basename(__filename)} script`);
Max.outlet("connected", 0);
Max.outlet("open_server", 0);

let app = express();
let server = app.listen(3000);

app.use(express.static('public'));

let io = socket(server);

Max.outlet("open_server", 1);

io.sockets.on('connection', newConnection);

function newConnection(socket){
  console.log('new connection' + socket.id);
  socket.on('magnote', magNote);
  Max.addHandler("maxnote", maxNote);
  Max.addHandler("maxkey", maxKey);
  Max.addHandler("maxtemperature", maxTemperature);
  Max.outlet("connected", 1);
  socket.on('printmax', printMax);
}


function magNote(data){
  console.log(data);
  //socket.broadcast.emit('maxnote', data);
  Max.outlet("playnote", data);
}

function maxKey(data){
  //socket.broadcast.emit('maxnote', data);
  io.sockets.emit('maxkey', data);
}

function maxNote(data){
  // send max data to magenta-js
  io.sockets.emit('maxnote', data);
}

function maxTemperature(data){
  // send max data to magenta-js
  io.sockets.emit('maxtemperature', data);
}

function printMax(data){
Max.outlet("printmax", data);
}
