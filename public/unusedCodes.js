function sendsData(){
	/*
	Placeholder for the function sending the data of the current canvas(full body / only eyes);
	*/
	let data;
	return data
}

function receivesData(){
	/*
	Placeholder for the function getting the data of the current canvas from the partner(full body / only eyes);
	*/
	let data;
	return data
}

function displaysFromData(){
	/*
	Placeholder for the function that takes data and displays on screen;
		Cases are:
		1: Used with receivesData (in states of "Absent","Connecting","Displaying");
		2: Used with saveTrace (in state "default")
	*/
}

function sendsInterruption(){
	/*
	Only in state "Connecting": Placeholder for the function that sends an interruption in making the eye contact, which would make t = 0;
	triggered by blinking / moving from FD
	*/
}

function saveTraceStart(){
	/*
	Placeholder for the function getting the data of the current canvas locally full body;
	Should be saved to an variable and renewed whenever state "Default" is triggered.
	*/
	let data;
	return data
}

function saveTraceFinish(){
	/*
	Placeholder for the function getting the data of the current canvas locally full body;
	Should be saved to an variable and renewed whenever state "Default" is triggered.
	*/
	let data;
	return data
}





let simplepeers = [];
let socket;
let myStream;

let isReceiving;
let isDetecting;
let savedTrace;
let eyeCenterPointAnchor;

window.addEventListener('load', function(){
    initCapture();
})

function setup(){

}

function draw(){
    
}

function initCapture(){
    console.log("init capture");

    let video = document.getElementById('myVideo');
    let constraints = {audio: false, video: true}
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream){
        myStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = function(e){
            video.play();
        }
        setupSocket();
    })
    .catch(function(err){
        alert(err);
    });
}

function setupSocket() {
    socket = io.connect();

    socket.on('connect', function () {
        console.log("Socket Connected");
        console.log("My socket id: ", socket.id);

        // Tell the server we want a list of the other users
        socket.emit('list');
    });



    socket.on('disconnect', function (data) {
        console.log("Socket disconnected");
    });

    socket.on('peer_disconnect', function (data) {
        console.log("simplepeer has disconnected " + data);
        for (let i = 0; i < simplepeers.length; i++) {
            if (simplepeers[i].socket_id == data) {
                console.log("Removing simplepeer: " + i);
                simplepeers.splice(i, 1);
                // Should also remove video from page
                document.getElementById(data).remove();
            }
        }

        socket.on('peer_disconnect', function (userId) {
            let userDiv = document.getElementById(userId);
            if (userDiv) {
                userDiv.remove();
            }
        });

    });

    socket.on('listresults', function (data) {
        console.log(data);
        for (let i = 0; i < data.length; i++) {
            // Make sure it's not us
            if (data[i] != socket.id) {
                // Check if a div for this user already exists, if not, create it
                let existingDiv = document.getElementById(data[i]);
                if (!existingDiv) {
                    let newUserDiv = document.createElement('div');
                    newUserDiv.id = data[i];
                }

                if (mystream) {
                    // Assuming mystream is your local media stream
                    let simplepeer = new SimplePeerWrapper(
                        true, data[i], socket, mystream, receivedStream, receivedData
                    );
                    simplepeers.push(simplepeer);
                } else {
                    console.error("Media stream is not ready.");
                }
            }
        }
    });


    socket.on('signal', function (to, from, data) {

        console.log("Got a signal from the server: ", to, from, data);

        // to should be us
        if (to != socket.id) {
            console.log("Socket IDs don't match");
        }

        // Look for the right simplepeer in our array
        let found = false;
        for (let i = 0; i < simplepeers.length; i++) {

            if (simplepeers[i].socket_id == from) {
                console.log("Found right object");
                // Give that simplepeer the signal
                simplepeers[i].inputsignal(data);
                found = true;
                break;
            }

        }
        if (!found) {
            console.log("Never found right simplepeer object");
            // Let's create it then, we won't be the "initiator"
            let simplepeer = new SimplePeerWrapper(
                false, from, socket, mystream, receivedStream, receivedData
            );

            // Push into our array
            simplepeers.push(simplepeer);

            // Tell the new simplepeer that signal
            simplepeer.inputsignal(data);
        }
    });
}

/*
function receivedStream(stream, simplePeerWrapper) {
    let ovideo = document.createElement("VIDEO");
    ovideo.id = simplePeerWrapper.socket_id;
    ovideo.srcObject = stream;
    ovideo.muted = true;
    ovideo.onloadedmetadata = function (e) {
        ovideo.play();
    };
    document.body.appendChild(ovideo);
    console.log(ovideo);
}
*/

function receivedStream(stream, simplePeerWrapper) {
    let videoElementId = `video_${simplePeerWrapper.socket_id}`;
    let canvasElementId = `canvas_${simplePeerWrapper.socket_id}`;

    let video = document.createElement("video");
    video.id = videoElementId;
    video.srcObject = stream;
    video.muted = true;  // Mute to avoid feedback loops in case of local testing
    video.play();

    let canvasDiv = document.createElement("div");
    canvasDiv.id = canvasElementId;
    document.body.appendChild(canvasDiv);

    // Attach video element to the body or a specific div as needed
    document.body.appendChild(video);

    // Initialize a p5 instance for this video
    new p5(function (p) {
        let myVideo;  // This will reference the p5 media element

        p.setup = function () {
            p.createCanvas(640, 480);  // Set the size as needed
            myVideo = p.createCapture(p.VIDEO);
            myVideo.id(`p5_${videoElementId}`);
            myVideo.hide();  // Hide the HTML video element, and just show the canvas
        };

        p.draw = function () {
            p.background(0);
            p.image(myVideo, 0, 0, 640, 480);  // Draw the video to the canvas
            // You can now apply any p5 effects here
        };
    }, canvasDiv);
}


function receivedData(theData, simplePeerWrapper) {
    console.log("receivedData: " + theData);
    document.getElementById("data").innerHTML += theData + "<br />";
}

function sendData(data) {
    console.log("Sending: " + data);
    for (let i = 0; i < simplepeers.length; i++) {
        simplepeers[i].sendData(data);
    }
}



// A wrapper for simplepeer as we need a bit more than it provides
class SimplePeerWrapper {

    constructor(initiator, socket_id, socket, stream, streamCallback, dataCallback) {
        this.simplepeer = new SimplePeer({
            initiator: initiator,
            trickle: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }]
            },
        });

        // Their socket id, our unique id for them
        this.socket_id = socket_id;

        // Socket.io Socket
        this.socket = socket;

        // Our video stream - need getters and setters for this
        this.stream = stream;

        // Callback for when we get a stream from a peer
        this.streamCallback = streamCallback;

        // Callback for when we get data form a peer
        this.dataCallback = dataCallback;

        // simplepeer generates signals which need to be sent across socket
        this.simplepeer.on('signal', data => {
            this.socket.emit('signal', this.socket_id, this.socket.id, data);
        });

        // When we have a connection, send our stream
        this.simplepeer.on('connect', () => {
            console.log('CONNECT')
            console.log(this.simplepeer);
            //p.send('whatever' + Math.random())

            // Let's give them our stream
            this.simplepeer.addStream(stream);
            console.log("Send our stream");
        });

        // Stream coming in to us
        this.simplepeer.on('stream', stream => {
            console.log('Incoming Stream');
            streamCallback(stream, this);
        });

        this.simplepeer.on('close', () => {
            console.log('Got close event');
            // Should probably remove from the array of simplepeers
        });

        this.simplepeer.on('error', (err) => {
            console.log(err);
        });

        // Handle Data
        this.simplepeer.on('data', data => {
            console.log("Got Data: " + data);
            dataCallback(data, this);
        });
    }

    inputsignal(sig) {
        this.simplepeer.signal(sig);
    }

    // Handle Data
    sendData(data) {
        this.simplepeer.send(data);
    }
}


