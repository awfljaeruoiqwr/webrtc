var socket = io();

var videoChat = document.getElementById('video-chat-rooms');
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
var switch_access = document.getElementById('switch-access');
var videoSelect = document.getElementById('video-select');

var hideCameraFlag = false;

var roomName = 'default-room';

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var creator = false;
var isKeyPressed = false;
var intervalId = null;

var rtcPeerConnection;
var userStream;
var commandData;

var data = {"address":0, "controls":{"w":0, "s":0, "d":0, "a":0}};

var keysPressed = {
    "w":0,
    "s":0,
    "a":0,
    "d":0
};

navigator.mediaDevices.enumerateDevices()
.then(function(devices) {
  devices.forEach(function(device) {
    if (device.kind === 'videoinput') {
      var option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || '카메라 ' + (videoSelect.length + 1);
      videoSelect.appendChild(option);
    }
  });
})
.catch(function(err) {
  console.log(err.name + ": " + err.message);
});

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

const keypressHandler = function(event) {
    isKeyPressed = true;
    if(event.key in keysPressed) {
        keysPressed[event.key] = 1;
        socket.emit('control', {command: {"controls": keysPressed}});
    }
};

const keyupHandler = function(event) {
    isKeyPressed = false;
    if(event.key in keysPressed) {
        keysPressed[event.key] = 0;
        socket.emit('control', {command: {"controls": keysPressed}});
    }
};
socket.emit('create', 'default-room');

// "created" 이벤트를 송신하는 헨들러
socket.on("created", function() {
    // 사용자가 채팅창을 생성한 경우를 나타내는 변수
    creator = true;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:840, height:720 }
        },
        function(stream) {
            // 스트림을 userStream 변수에 저장
            userStream = stream;
            // 화상 채팅 UI를 업데이트
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

    // 키보드 이벤트 리스너 생성
    document.addEventListener('keypress', keypressHandler);
    document.addEventListener('keyup', keyupHandler);

    // UI에 버튼을 표시하는 함수 호출
    showButtons();
    switch_access.style.display = 'flex';
});

// "joined" 이벤트를 송신하는 헨들러
socket.on("joined", function() {
    // 상대방이 채팅방에 참여한 경우를 나타내는 변수
    creator = false;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:840, height:720 }
        },
        function(stream) {
            // 스트림을 userStream 변수에 저장
            userStream = stream;
            // 사용자의 비디오 요소에 스트림을 설정
            userVideo.srcObject = stream;
            // 화상 채팅 UI를 업데이트
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
    // 키보드 이벤트 리스너 생성
    document.addEventListener('keypress', keypressHandler);
    document.addEventListener('keyup', keyupHandler);
    // UI에 버튼을 표시하는 함수 호출
    showButtons();
});

socket.on("full", function() {
    alert("Room is fulled, You can't access!");
});

// "ready" 이벤트를 송신하는 헨들러
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

// "candidate" 이벤트를 송신하는 헨들러
socket.on("candidate", function(candidate) {

    var iceCandidate = new RTCIceCandidate(candidate);
    rtcPeerConnection.addIceCandidate(iceCandidate);
});

// "offer" 이벤트를 송신하는 헨들러
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

// "answer" 이벤트를 송신하는 헨들러
socket.on("answer", function(answer) {
    // 수신된 Answer를 RTCPeerConnection에 설정
    rtcPeerConnection.setRemoteDescription(answer);
});

// "leave" 이벤트를 송신하는 헨들러
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
        rtcPeerConnection.ontrack = null; // 트랙 송신 이벤트 핸들러 제거
        rtcPeerConnection.onicecandidate = null; // ICE candidate 이벤트 핸들러 제거
        rtcPeerConnection.close();
    }
});

socket.on("disconnect", function() {
    // 이더넷 연결이 끊어졌을 때 실행할 코드
    alert("연결이 끊겼습니다. 다시 연결해 주세요!");
    // peerVideo 화면 검은색으로 바꾸기
    peerVideo.style.display = "none";
  
    // 비디오 재생 중지
    if (peerVideo.srcObject) {
      peerVideo.srcObject.getTracks()[0].stop();
      peerVideo.srcObject.getTracks()[1].stop();
    }
  
    // RTCPeerConnection 정리
    if (rtcPeerConnection) {
      rtcPeerConnection.ontrack = null;
      rtcPeerConnection.onicecandidate = null;
      rtcPeerConnection.close();
    }
  
    // 페이지 새로고침
    location.reload();
});

leaveRoomBtn.addEventListener("click", function() {
    // 확인 메시지 표시
    if (confirm("정말 퇴장하시겠습니까?")) {
        // 웹소켓 서버에 "leave" 이벤트 전송
        socket.emit("leave", roomName);
        // 현재 페이지를 닫음
        Window.opener.close();
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

forwardBtn.addEventListener('mousedown', function() {
    commandData = {"controls":{"w":1, "s":0, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    if(intervalId === null) {
        intervalId = setInterval(function() {
            if(!isKeyPressed) {
                socket.emit('control', {command: commandData});
            }
        }, 1000);
    }
});

forwardBtn.addEventListener('mouseup', function() {
    commandData = {"controls":{"w":0, "s":0, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    clearInterval(intervalId);
    intervalId = null;
});

BackwardBtn.addEventListener('mousedown', function() {
    commandData = {"controls":{"w":0, "s":1, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    if(intervalId === null) {
        intervalId = setInterval(function() {
            if(!isKeyPressed) {
                socket.emit('control', {command: commandData});
            }
        }, 1000);
    }
});

BackwardBtn.addEventListener('mouseup', function() {
    commandData = {"controls":{"w":0, "s":0, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    clearInterval(intervalId);
    intervalId = null;
});

LeftBtn.addEventListener('mousedown', function() {
    commandData = {"controls":{"w":0, "s":0, "a":1, "d":0}};
    socket.emit('control', {command: commandData});
    if(intervalId === null) {
        intervalId = setInterval(function() {
            if(!isKeyPressed) {
                socket.emit('control', {command: commandData});
            }
        }, 1000);
    }
});

LeftBtn.addEventListener('mouseup', function() {
    commandData = {"controls":{"w":0, "s":0, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    clearInterval(intervalId);
    intervalId = null;
});

RightBtn.addEventListener('mousedown', function() {
    commandData = {"controls":{"w":0, "s":0, "a":0, "d":1}};
    socket.emit('control', {command: commandData});
    if(intervalId === null) {
        intervalId = setInterval(function() {
            if(!isKeyPressed) {
                socket.emit('control', {command: commandData});
            }
        }, 1000);
    }
});

RightBtn.addEventListener('mouseup', function() {
    commandData = {"controls":{"w":0, "s":0, "a":0, "d":0}};
    socket.emit('control', {command: commandData});
    clearInterval(intervalId);
    intervalId = null;
});
