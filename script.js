var socket = io();

var videoChatForm = document.getElementById('video-chat-form');
var videoChat = document.getElementById('video-chat-rooms');
var joinBtn = document.getElementById('join');
var roomInput = document.getElementById('roomName');
var userVideo = document.getElementById('user-video');
var peerVideo = document.getElementById('peer-video');
var controlButton = document.getElementById('control-flatform-button');
var divBtnGroup = document.getElementById('btn-group');
var hideCameraBtn = document.getElementById("hideButton");
var leaveRoomBtn = document.getElementById("leaveButton");
var forwardBtn = document.getElementById('forward');
var BackwardBtn = document.getElementById('Backward');
var LeftBtn = document.getElementById('Left');
var RightBtn = document.getElementById('Right');

var hideCameraFlag = false;

var roomName = roomInput.value;

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var creator = false;

var rtcPeerConnection;
var userStream;

var data = {"address":0, "controls":{"w":0, "s":0, "d":0, "a":0}};

// ICE서버를 설정하는 객체 선언
const iceServers = {
    iceServers:[
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "turn:118.40.87.2:3478",
          username: "waveai",
          credential: "waveai0729",
        }
    ]
  };

joinBtn.addEventListener("click", function() {
    // 만약 입력된 방 이름이 비어있다면, 경고창을 표시
    if (roomInput.value == "") {
        alert("Please enter a room name!");
    }
    else {
        // 입력된 방 이름이 비어있지 않다면, 해당 방에 조인하기 위해 서버에 "join" 이벤트를 전송
        socket.emit("join", roomName);
    }
});

hideCameraBtn.addEventListener("click", function() {
    hideCameraFlag = !hideCameraFlag;
    if (hideCameraFlag) {
        userStream.getTracks()[1].enabled = false;
        hideCameraBtn.textContent = 'Show Camera';
    }
    else {
        userStream.getTracks()[1].enabled = true;
        hideCameraBtn.textContent = 'Hide Camera';
    }
});

// "created" 이벤트를 수신하는 헨들러
socket.on("created", function() {
    // 상대방이 채팅창을 생성한 경우를 나타내는 변수
    creator = true;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:1280, height:720 }
        },
        function(stream) {
            // 스트림을 userStream 변수에 저장
            userStream = stream;
            // 화상 채팅 UI를 업데이트
            videoChatForm.style = "display:none";
            divBtnGroup.style = "display:flex";
            userVideo.srcObject = stream;
            userVideo.onloadedmetadata = function(e) {
                userVideo.play();
            }
            // 서버에 "message" 이벤트를 발생시켜 데이터 전송
            socket.emit("message", data);

        },
        function(error) {
            alert("You can't access Media");
        }
    );
    // UI에 버튼을 표시하는 함수 호출
    showButtons();
});

// "joined" 이벤트를 수신하는 헨들러
socket.on("joined", function() {
    // 사용자가 채팅방에 참여한 경우를 나타내는 변수
    creator = false;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:1280, height:720 }
        },
        function(stream) {
            // 스트림을 userStream 변수에 저장
            userStream = stream;
            // 사용자의 비디오 요소에 스트림을 설정
            userVideo.srcObject = stream;
            // 화상 채팅 UI를 업데이트
            videoChatForm.style = "display:none";
            divBtnGroup.style = "display:flex";
            userVideo.onloadedmetadata = function(e) {
                userVideo.play();
            }
            // 서버에 "ready" 이벤트를 발생시켜 사용자가 준비되었음을 알린다.
            socket.emit("ready", roomName);
        },
        function(error) {
            alert("You can't access Media");
        }
    );
    showButtons();
});

socket.on("full", function() {
    alert("Room is fulled, You can't access!");
});

// "ready" 이벤트를 수신하는 헨들러
socket.on("ready", function() {
    // 사용자가 채팅방을 생성한 경우에만 실행
    if (creator) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
        rtcPeerConnection.ontrack = OntrackFunction;
        // 사용자의 오디오와 비디오 트랙을 RTCPeerConnection에 추가
        rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track
        rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track

        // Offer를 생성하고, 생성된 Offer를 로컬 설명으로 설정한 후 서버에 전송
        rtcPeerConnection.createOffer(
            function(offer) {
                rtcPeerConnection.setLocalDescription(offer); // 로컬 설명 설정
                socket.emit("offer", offer, roomName); // Offer를 서버에 전송
            },
            function(error) {
                console.log(error);
            }
        );
      }
});

// "candidate" 이벤트를 수신하는 헨들러
socket.on("candidate", function(candidate) {

    var iceCandidate = new RTCIceCandidate(candidate);
    rtcPeerConnection.addIceCandidate(iceCandidate);
});

// "offer" 이벤트를 수신하는 헨들러
socket.on("offer", function(offer) {

    if (!creator) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
        rtcPeerConnection.ontrack = OntrackFunction;
        // 사용자의 오디오와 비디오 트랙을 RTCPeerConnection에 추가
        rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track
        rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track
        
        // 상대방이 보낸 Offer를 RTCPeerConnection에 설정
        rtcPeerConnection.setRemoteDescription(offer);

        // Answer를 생성하고, 생성된 Answer를 로컬 설명으로 설정한 후 서버에 전송
        rtcPeerConnection.createAnswer(
            function(answer) {
                rtcPeerConnection.setLocalDescription(answer); // 로컬 설명 설정
                socket.emit("answer", answer, roomName); // Answer를 서버에 전송
            },
            function(error) {
                console.log(error);
            }
        );
    }
});

// "answer" 이벤트를 수신하는 헨들러
socket.on("answer", function(answer) {
    // 수신된 Answer를 RTCPeerConnection에 설정
    rtcPeerConnection.setRemoteDescription(answer);
});

leaveRoomBtn.addEventListener("click", function() {
    socket.emit("leave", roomName);

    videoChatForm.style = "display:block";
    divBtnGroup.style = "display:none";
    controlButton.style = "display:none";

    if (userVideo.srcObject) {
        userVideo.srcObject.getTracks()[0].stop();
        userVideo.srcObject.getTracks()[1].stop();
    }

    if (peerVideo.srcObject) {
        peerVideo.srcObject.getTracks()[0].stop();
        peerVideo.srcObject.getTracks()[1].stop();
    }

    if(rtcPeerConnection) {
        rtcPeerConnection.ontrack = null;
        rtcPeerConnection.onicecandidate = null;
        rtcPeerConnection.close();
    }

    clearInterval(messageInterval);

    showButtons();
});

// "leave" 이벤트를 수신하는 헨들러
socket.on("leave", function() {
    // 사용자가 채팅방을 생성한 것으로 설정
    creator = true;

    // 상대방의 비디오 스트림이 있는 경우에만 실행
    if (peerVideo.srcObject) {
        // 상대방의 비디오 트랙 중지
        peerVideo.srcObject.getTracks()[0].stop();
        peerVideo.srcObject.getTracks()[1].stop();
    }

    // RTCPeerConnection이 존재하는 경우에만 실행
    if (rtcPeerConnection) {
        // 이벤트 핸들러 및 RTCPeerConnection을 정리
        rtcPeerConnection.ontrack = null; // 트랙 수신 이벤트 핸들러 제거
        rtcPeerConnection.onicecandidate = null; // ICE candidate 이벤트 핸들러 제거
        rtcPeerConnection.close();
    }
});

function OnIceCandidateFunction(event) {
    
    if(event.candidate) {
        socket.emit("candidate", event.candidate, roomName);
    }
};

function OntrackFunction(event) {

    peerVideo.srcObject = event.streams[0];
    peerVideo.onloadedmetadata = function(e) {
            peerVideo.play();
    };
};

function showButtons() {
    forwardBtn.style.display = 'inline-block';
    BackwardBtn.style.display = 'inline-block';
    LeftBtn.style.display = 'inline-block';
    RightBtn.style.display = 'inline-block';
};

var isKeyPressed = false;

document.addEventListener('keypress', function(event) {
    isKeyPressed = true;
    var buttonID;
    switch (event.key) {
        case 'w':
            buttonID = 'forward';
            data["controls"]["w"] = 1;
            socket.emit('control', {command: 'forward'});
            break;
        case 's':
            buttonID = 'Backward';
            data["controls"]["s"] = 1;
            socket.emit('control', {command: 'Backward'});
            break;
        case 'a':
            buttonID = 'Left';
            data["controls"]["a"] = 1;
            socket.emit('control', {command: 'Left'});
            break;
        case 'd':
            buttonID = 'Right';
            data["controls"]["d"] = 1;
            socket.emit('control', {command: 'Right'});
            break;
    }
});

document.addEventListener('keyup', function(event) {
    isKeyPressed = false;
    switch (event.key) {
        case 'w':
            buttonID = 'forward';
            data["controls"]["w"] = 0;
            break;
        case 's':
            buttonID = 'Backward';
            data["controls"]["s"] = 0;
            break;
        case 'a':
            buttonID = 'Left';
            data["controls"]["a"] = 0;
            break;
        case 'd':
            buttonID = 'Right';
            data["controls"]["d"] = 0;
            break;
    }

    socket.emit("message", data);
});

setInterval(function() {
    if (!isKeyPressed) {
        socket.emit('control', {command: 'stop'});
    }
}, 1000);

forwardBtn.addEventListener('mousedown', function() {
    data["controls"]["w"] = 1;
    socket.emit('control', {command: 'forward'});
});
forwardBtn.addEventListener('mouseup', function() {
    data["controls"]["w"] = 0;
    socket.emit('control', {command: 'stop'});
});
BackwardBtn.addEventListener('mousedown', function() {
    data["controls"]["s"] = 1;
    socket.emit('control', {command: 'Backward'});
});
BackwardBtn.addEventListener('mouseup', function() {
    data["controls"]["s"] = 0;
    socket.emit('control', {command: 'stop'});
});
LeftBtn.addEventListener('mousedown', function() {
    data["controls"]["a"] = 1;
    socket.emit('control', {command: 'Left'});
});
LeftBtn.addEventListener('mouseup', function() {
    data["controls"]["a"] = 0;
    socket.emit('control', {command: 'stop'});
});
RightBtn.addEventListener('mousedown', function() {
    data["controls"]["d"] = 1;
    socket.emit('control', {command: 'Right'});
});
RightBtn.addEventListener('mouseup', function() {
    data["controls"]["d"] = 0;
    socket.emit('control', {command: 'stop'});
});
