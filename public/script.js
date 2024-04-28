let simplepeers = [];
let socket;
let myStream;


let isReceiving;
let isDetecting;
let savedTrace;
let eyeCenterPointAnchor;

let videoElements = {};


window.addEventListener('load', function () {
    initCapture();
})


function initCapture() {
    console.log("init capture");

    let video = document.getElementById('myVideo');
    let constraints = { audio: false, video: true }
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        myStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = function (e) {
            video.play();
        }
        setupSocket();
    })
        .catch(function (err) {
            alert(err);
        });
}

const s = (sketch) => {
    let previousPixels;
    let accumulatedImage;
    let thresholdSlider;
    let timeout = 50;
    let sliderInitial = 25;

    let w = 320;
    let h = 240;

    let faceapis = new Map(); // Stores FaceAPI instances keyed by socket ID
    let detections = new Map(); // Stores detections keyed by socket ID
    let scale = 1.5;

    sketch.setup = () => {
        // sketch.frameRate(24);
        sketch.pixelDensity(1);
        sketch.createCanvas(sketch.windowWidth, sketch.windowHeight);
        sketch.background(200);

        console.log("width: " + w + " " + "height: " + h);

        thresholdSlider = sketch.createSlider(0, 100, sliderInitial);
        thresholdSlider.position(10, 10);

        accumulatedImage = sketch.createImage(w, h);
        // accumulatedImage = sketch.createImage(capture.width, capture.height);
        accumulatedImage.loadPixels();
        for (let i = 0; i < accumulatedImage.pixels.length; i++) {
            accumulatedImage.pixels[i] = 255;
        }
        accumulatedImage.updatePixels();



        for (let socketId in videoElements) {
            console.log("looping in setup with socketID: ", socketId)
            const options = {
                withLandmarks: true,
                withDescriptors: false,
            };
            let faceapi = ml5.faceApi(video, options, modelReady(socketId));
            faceapis.set(socketId, faceapi);
        }


        setTimeout(sketch.resetImage, timeout);
    };

    sketch.modelReady = (socketId) => {
        return function() {
            console.log(`Model loaded for source ${socketId}`);
            faceapis.get(socketId).detect(gotResults(socketId));
        }
    };

    sketch.gotResults = (socketId) => {
        return function(err, result) {
            if (err) {
                console.log(err);
                return;
            }
            detections.set(socketId, result);
            faceapis.get(socketId).detect(gotResults(socketId)); // Continue detecting faces
        }
    };

sketch.getEyeBoundingBoxes = () => {
    console.log("getEyeBoundingBoxes")

    let allEyeBoundingBoxes = new Map(); // Stores bounding boxes for each socket
    detections.forEach((detectionArray, socketId) => {
        let eyeBoundingBoxes = [];
        detectionArray.forEach(detection => {
            const leftEye = detection.parts.leftEye;
            const rightEye = detection.parts.rightEye;

            // Calculate and store bounding boxes for both eyes
            eyeBoundingBoxes.push(sketch.calculateBoundingBox(leftEye));
            eyeBoundingBoxes.push(sketch.calculateBoundingBox(rightEye));
        });
        allEyeBoundingBoxes.set(socketId, eyeBoundingBoxes);
    });
    return allEyeBoundingBoxes;
};


    sketch.calculateBoundingBox = (eye) => {
        console.log("calculateBoundingBox")
        const x1 = min(eye.map(p => p._x));
        const y1 = min(eye.map(p => p._y));
        const x2 = max(eye.map(p => p._x));
        const y2 = max(eye.map(p => p._y));

        const width = (x2 - x1) * scale;
        const height = (y2 - y1) * scale;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        // Adjust position to keep the box centered around the eye
        const newX = centerX - width / 2;
        const newY = centerY - height / 2;

        // Return scaled and centered bounding box as an object
        return { x: newX, y: newY, width: width, height: height };
    };


    sketch.draw = () => {
        sketch.background(120);


        // #region Original - working
        // let clientIndex = 0;
        // for (const socketId in videoElements) {
        //     if (socketId !== socket.id) {
        //         // let x = (index % 2) * (sketch.width / 2);
        //         // let y = Math.floor(index / 2) * (sketch.height / 2);
        //         let x = 0;
        //         let y = 0;

        //         sketch.tint(255, 100);
        //         sketch.image(videoElements[socketId], x, y, sketch.width, sketch.height);
        //         clientIndex++;
        //     }
        // }
        // #endregion


        for (let socketId in videoElements) {
            if (socketId !== socket.id) {
                let capture = videoElements[socketId];
                capture.loadPixels();

                let eyeBoxes;
                if (detections.has(socketId) && detections.get(socketId).length > 0) {
                    console.log("[draw]: detections.has(socketId) && detections.get(socketId).length > 0")
                    eyeBoxes = sketch.getEyeBoundingBoxes().get(socketId);
                }
                // console.log("capture.pixels.length: ",capture.pixels.length)
                // console.log("capture.width: ",capture.width)
                // console.log("capture.height: ",capture.height)
                if (capture.pixels.length > 0) {
                    if (!previousPixels) {
                        // Copy initial pixels to previousPixels array using copyImage
                        previousPixels = sketch.copyImage(capture.pixels, previousPixels);
                    } else {
                        var cw = capture.width,
                            ch = capture.height;
                        var pixels = capture.pixels;
                        accumulatedImage.loadPixels();
                        sketch.loadPixels();
                        let thresholdAmount = (thresholdSlider.value() * 255) / 100;
                        thresholdAmount *= 3;
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                var index = (x + y * w) * 4; // Calculate the index for the pixels array
                                let rdiff = Math.abs(pixels[index] - previousPixels[index]);
                                let gdiff = Math.abs(
                                    pixels[index + 1] - previousPixels[index + 1]
                                );
                                let bdiff = Math.abs(
                                    pixels[index + 2] - previousPixels[index + 2]
                                );
                                var diffs = rdiff + gdiff + bdiff;
                                if (diffs > thresholdAmount) {
                                    let coord = sketch.getPixelCoordinates(index, cw)
                                    let isInsideBoxes = sketch.isPixelInBoundingBoxes(coord.x, coord.y, eyeBoxes)


                                    if (isInsideBoxes) {
                                        accumulatedImage.pixels[index] = pixels[index]; // Red channel
                                        accumulatedImage.pixels[index + 1] = pixels[index + 1]; // Green channel
                                        accumulatedImage.pixels[index + 2] = pixels[index + 2]; // Blue channel}

                                    } else {
                                        // accumulatedImage.pixels[index + 3] = 32;
                                        // pixels[index + 3] -= 20;
                                    }
                                    // Update previousPixels for the next frame
                                    previousPixels[index] = pixels[index];
                                    previousPixels[index + 1] = pixels[index + 1];
                                    previousPixels[index + 2] = pixels[index + 2];
                                }
                            }
                            accumulatedImage.updatePixels();
                            sketch.updatePixels();

                            sketch.image(accumulatedImage, 0, 0, sketch.width, sketch.height);
                        }

                        // sketch.tint(255, 100);
                        // sketch.image(capture, 0, 0, sketch.width, sketch.height);
                    }
                }
            }

        };

        sketch.isPixelInBoundingBoxes = (x, y, boxes) => {
            for (let box of boxes) {
                if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) {
                    return true;
                }
            }
            return false;
        };

        sketch.getPixelCoordinates = (idx, ncw) => {
            let n = idx / 4; // Convert the index to account for r, g, b, a components
            let y = Math.floor(n / ncw); // Use floor to calculate y coordinate
            let x = n % ncw; // Use modulo to calculate x coordinate
            return { x, y };
        };

        sketch.copyImage = (src, dst) => {
            let n = src.length;
            if (!dst || dst.length !== n) {
                dst = new src.constructor(n);
            }
            while (n--) {
                dst[n] = src[n];
            }
            return dst;
        };

        sketch.resetImage = () => {
            accumulatedImage.loadPixels();
            for (let i = 0; i < accumulatedImage.pixels.length; i++) {
                accumulatedImage.pixels[i] = 255; // Red
                accumulatedImage.pixels[i + 1] = 255; // Green
                accumulatedImage.pixels[i + 2] = 255; // Blue
                accumulatedImage.pixels[i + 3] = 100; // Alpha
            }
            accumulatedImage.updatePixels();
            setTimeout(sketch.resetImage, timeout);
        };

        sketch.receivedStream = (stream, simplePeerWrapper) => {
            if (simplePeerWrapper.socket_id !== socket.id) {
                let domElement = document.createElement("VIDEO");
                domElement.className = "domVideo";
                domElement.srcObject = stream;
                document.body.appendChild(domElement);

                let videoEl = new p5.MediaElement(domElement, sketch);
                // sketch._elements.push(videoEl);
                videoEl.loadedmetadata = false;
                // set width and height onload metadata
                domElement.addEventListener('loadedmetadata', function () {
                    console.log("loaded metadata");
                    domElement.play();
                    videoEl.play();

                    // videoEl = new p5.MediaElement(domElement, sketch);
                    sketch._elements.push(videoEl);

                    if (domElement.width) {
                        videoEl.width = domElement.width;
                        videoEl.height = domElement.height;
                    } else {
                        videoEl.width = videoEl.elt.width = domElement.videoWidth;
                        videoEl.height = videoEl.elt.height = domElement.videoHeight;
                    }
                    videoEl.loadedmetadata = true;
                    videoElements[simplePeerWrapper.socket_id] = videoEl;


                    // ADD FACEAPI LOAD HERE?

                });


                // videoElements[simplePeerWrapper.socket_id] = videoEl;
            }
        };

    };
};
let myp5 = new p5(s, 'p5sketch');

function onStreamReceived(stream, simplePeerWrapper) {
    if (myp5) {
        myp5.receivedStream(stream, simplePeerWrapper);
    }
};

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
                // document.getElementById(data).remove();
                if (videoElements[data]) {
                    delete videoElements[data];
                }
            }
        }

        // socket.on('peer_disconnect', function (userId) {
        //     for (let i = 0; i < simplepeers.length; i++) {
        //         if (simplepeers[i].userId == userId) {
        //             simplepeers.splice(i, 1);

        //             if (videoElements[userId]) {
        //                 delete videoElements[userId];
        //             }
        //         }
        //     }

        // });

    });

    socket.on('listresults', function (data) {
        console.log("list results: " + data);
        for (let i = 0; i < data.length; i++) {
            // Make sure it's not us
            if (data[i] !== socket.id) {
                let simplepeer = new SimplePeerWrapper(
                    true, data[i], socket, myStream, myp5.receivedStream, receivedData
                );
                simplepeers.push(simplepeer);
            }
        }
    });


    socket.on('signal', function (to, from, data) {

        console.log("Got a signal from the server: ", to, from, data);

        // to should be us
        // if (to != socket.id) {
        //     console.log("Socket IDs don't match");
        // }

        if (to === socket.id) {
            let found = false;
            for (let i = 0; i < simplepeers.length; i++) {
                if (simplepeers[i].socket_id === from) {
                    console.log("Found right object");
                    simplepeers[i].inputsignal(data);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log("Never found right simplepeer object");
                let simplepeer = new SimplePeerWrapper(
                    false, from, socket, myStream, myp5.receivedStream, receivedData
                );
                simplepeers.push(simplepeer);
                simplepeer.inputsignal(data);
            }
        }

    });
};


function receivedData(theData, simplePeerWrapper) {
    console.log("receivedData: " + theData);
    document.getElementById("data").innerHTML += theData + "<br />";
};

function sendData(data) {
    console.log("Sending: " + data);
    for (let i = 0; i < simplepeers.length; i++) {
        simplepeers[i].sendData(data);
    }
};

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
};

