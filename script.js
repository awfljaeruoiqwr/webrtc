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

var iceServers = {
    iceServers:[
        {urls: "stun:stun.services.mozilla.com"},
        {urls: "stun:stun1.1.google.com:19302"}
    ]
};

joinBtn.addEventListener("click", function() {
    if (roomInput.value == "") {
        alert("Please enter a room name!");
    }
    else {
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

socket.on("created", function() {

    showButtons();

    creator = true;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:1280, height:720 }
        },
        function(stream) {
            userStream = stream;
            videoChatForm.style = "display:none";
            divBtnGroup.style = "display:flex";
            userVideo.srcObject = stream;
            userVideo.onloadedmetadata = function(e) {
                userVideo.play();
            }
            socket.emit("message", data);

            messageInterval = setInterval(function(){
                socket.emit("message", data);
            }, 1000);

        },
        function(error) {
            alert("You can't access Media");
        }
    );
});

socket.on("joined", function() {

    showButtons();

    creator = false;
    navigator.getUserMedia(
        {
            audio:true,
            video:{ width:1280, height:720 }
        },
        function(stream) {
            userStream = stream;
            userVideo.srcObject = stream;
            videoChatForm.style = "display:none";
            divBtnGroup.style = "display:flex";
            userVideo.onloadedmetadata = function(e) {
                userVideo.play();
            }
            socket.emit("ready", roomName);
        },
        function(error) {
            alert("You can't access Media");
        }
    );
});

socket.on("full", function() {
    alert("Room is fulled, You can't access!");
});

socket.on("ready", function() {
    if (creator) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
        rtcPeerConnection.ontrack = OntrackFunction;
        rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track
        rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track
        rtcPeerConnection.createOffer(
            function(offer) {
                rtcPeerConnection.setLocalDescription(offer);
                socket.emit("offer", offer, roomName);
            },
            function(error) {
                console.log(error);
            }
        );
      }
});

socket.on("candidate", function(candidate) {

    var iceCandidate = new RTCIceCandidate(candidate);
    rtcPeerConnection.addIceCandidate(iceCandidate);
});

socket.on("offer", function(offer) {

    if (!creator) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
        rtcPeerConnection.ontrack = OntrackFunction;
        rtcPeerConnection.addTrack(userStream.getTracks()[0], userStream); // for audio track
        rtcPeerConnection.addTrack(userStream.getTracks()[1], userStream); // for video track
        rtcPeerConnection.setRemoteDescription(offer);
        rtcPeerConnection.createAnswer(
            function(answer) {
                rtcPeerConnection.setLocalDescription(answer);
                socket.emit("answer", answer, roomName);
            },
            function(error) {
                console.log(error);
            }
        );
    }
});

socket.on("answer", function(answer) {
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
});

socket.on("leave", function() {
    creator = true;

    if (peerVideo.srcObject) {
        peerVideo.srcObject.getTracks()[0].stop();
        peerVideo.srcObject.getTracks()[1].stop();
    }

    if(rtcPeerConnection) {
        rtcPeerConnection.ontrack = null;
        rtcPeerConnection.onicecandidate = null;
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

document.addEventListener('keydown', function(event) {
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

    var button = document.getElementById(buttonID);
    if (button) {

        button.style.backgroundColor = '#00FF00';
        socket.emit("message", data);

        setTimeout(function() {
            button.style.backgroundColor = '';
        }, 50);
    }
});

document.addEventListener('keyup', function(event) {
    switch (event.key) {
        case 'w':
            buttonID = 'forward';
            data["controls"]["w"] = 0;
            socket.emit('control', {command: 'stop'});
            break;
        case 's':
            buttonID = 'Backward';
            data["controls"]["s"] = 0;
            socket.emit('control', {command: 'stop'});
            break;
        case 'a':
            buttonID = 'Left';
            data["controls"]["a"] = 0;
            socket.emit('control', {command: 'stop'});
            break;
        case 'd':
            buttonID = 'Right';
            data["controls"]["d"] = 0;
            socket.emit('control', {command: 'stop'});
            break;
    }

    socket.emit("message", data);
});

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


