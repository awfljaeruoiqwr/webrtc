const express = require('express');
const app = express();

const socket = require('socket.io');
const https = require('https');
const fs = require('fs');

// HTTPS 인증키
const options = {
    key: fs.readFileSync('./key/_wildcard.waveai.dev+3-key.pem'),
    cert: fs.readFileSync('./key/_wildcard.waveai.dev+3.pem'),
};

var commandData = {"controls":{"w":0, "s":0, "a":0, "d":0}};

app.get('/control', function(req, res) {
    var controlData = commandData;
    res.setHeader('Content-Type', 'application/json')
    res.send(controlData);
});

// 서버 시작
const server = https.createServer(options, app).listen(3000, () => {
    console.log("Server is running");
});

// HTTP요청의 body를 파싱하기 위한 모듈 선언
const bodyParser = require('body-parser');
// JSON,URL 형태의 요청을 파싱하기 위해 body-parser를 Express앱에 추가
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

const userRoute = require('./routes/userRoute');
app.use('/', userRoute);

var io = socket(server);
// 클라이언트가 소켓에 연결되었을 때의 이벤트
io.on("connection", function(socket) {
    console.log("User Connected: " + socket.id);

    // 로봇 제어 명령을 수신하는 이벤트 헨들러
    socket.on("control", function(data) {
        commandData = data.command;

    });

        var roomName = 'default-room';    
        var rooms = io.sockets.adapter.rooms;
        var room = rooms.get(roomName);

        // 채팅방에 처음 입장할 경우, 새로운 방을 생성하거나 기존 방에 참여
        if (room == undefined) {
            socket.join(roomName);
            socket.emit("created");
        }
        else if (room.size == 1) {
            socket.join(roomName);
            socket.emit("joined");
        }
        else {
            socket.emit("full");
        }
        console.log(room);

    // 상대방이 준비되었음을 알리는 이벤트 헨들러
    socket.on("ready", function(roomName) {
        console.log("Ready");
        socket.broadcast.to(roomName).emit("ready");
    });

    // ICE Candidate 를 전달하는 이벤트 헨들러
    socket.on("candidate", function(candidate, roomName) {
        console.log("Candidate");
        console.log(candidate);
        socket.broadcast.to(roomName).emit("candidate", candidate);
    });

    // Offer를 전달하는 이벤트 헨들러
    socket.on("offer", function(offer, roomName) {
        console.log("Offer");
        console.log(offer);
        socket.broadcast.to(roomName).emit("offer", offer);
    });

    // 메시지를 전달하는 이벤트 헨들러
    socket.on("message", function(data) {
        socket.broadcast.to(data.roomName).emit("message", data);
    });

    // Answer를 전달하는 이벤트 헨들러
    socket.on("answer", function(answer, roomName) {
        console.log("Answer");
        socket.broadcast.to(roomName).emit("answer", answer);
    });

    // 채팅방에서 퇴장하는 이벤트 헨들러
    socket.on("leave", function(roomName) {
        socket.leave(roomName);
        socket.broadcast.to(roomName).emit("leave");
    });

    // 연결이 끊어졌을 때 전달하는 이벤트 헨들러
    socket.on("disconnect", function() {
        console.log("사용자 연결 끊김");
        socket.broadcast.emit("leave", roomName);
    })
});
