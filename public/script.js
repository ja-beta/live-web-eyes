let simplepeers = [];
let socket;
let myStream;


let isReceiving;
let isDetecting;
let savedTrace;
let eyeCenterPointAnchor;

let videoElements = {};
let myp5
let w;
let h;

window.addEventListener('load', function () {
    initCapture();
})


async function initCapture() {
    console.log("init capture");

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const secondVideoDeviceId = videoDevices[1].deviceId;
    const constraints = {
        video: {
            deviceId: secondVideoDeviceId,
            audio: false,
            width: 1920,
            height: 1080
        }
    };

    let video = document.getElementById('myVideo');
    // console.log("video width: ", video.videoWidth, "video height: ", video.videoHeight);
    // video.style.width = "1920px";
    // video.style.height = "1080px";
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        w = stream.getVideoTracks()[0].getSettings().width;
        console.log(stream.getVideoTracks()[0].getSettings().width);
        h = stream.getVideoTracks()[0].getSettings().height;
        console.log("getUserMedia length: " + navigator.mediaDevices.enumerateDevices);

        myStream = stream;
        initp5();
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
    let timeout = 200;
    let sliderInitial = 3;

    // let w = 320; //320
    // let h = 240; // 240

    let faceapis = new Map(); // Stores FaceAPI instances keyed by socket ID
    let detections = new Map(); // Stores detections keyed by socket ID
    let scale;

    let currentCenterX = 0;
    let currentCenterY = 0;
    let currentZoom = 1;
    let zoomAmount = 2;
    let lerpSpeed = 0.75;
    let globalMask;
    let whiteMask;

    // let myCanvas = document.querySelector('canvas');
    // myCanvas.willReadFrequently = true;

    sketch.setup = () => {
        // sketch.frameRate(12);
        // sketch.pixelDensity(1);
        let canvas = sketch.createCanvas(w, h);
        canvas.elt.willReadFrequently = true;
        console.log("canvas: ", canvas.elt.willReadFrequently);

        globalMask = sketch.createGraphics(w, h);
        globalMask.elt.willReadFrequently = true;
        console.log("globalMask: ", globalMask.elt.willReadFrequently);


        whiteMask = sketch.createGraphics(w, h);
        whiteMask.elt.willReadFrequently = true;
        console.log("whiteMask: ", whiteMask.elt.willReadFrequently);


        whiteMask.background(255)
        // console.log(w, h);
        // sketch.background(255,50);

        scale = Math.min(sketch.width / w, sketch.height / h);
        // console.log("scale: ", scale);
        thresholdSlider = sketch.createSlider(0, 100, sliderInitial);
        thresholdSlider.position(10, 10);

        accumulatedImage = sketch.createImage(w, h);
        // accumulatedImage = sketch.createImage(capture.width, capture.height);
        accumulatedImage.loadPixels();
        for (let i = 0; i < accumulatedImage.pixels.length; i++) {
            accumulatedImage.pixels[i] = 255;
            // console.log("accumulatedImage length: ", accumulatedImage.pixels.length);
        }
        accumulatedImage.updatePixels();

        setTimeout(sketch.resetImage, timeout);
    };

    sketch.initiateFaceApi = () => {
        for (let socketId in videoElements) {


            const options = {
                withLandmarks: true,
                withDescriptors: false,
            };
            let faceapi = ml5.faceApi(videoElements[socketId], options, sketch.modelReady(socketId));
            faceapis.set(socketId, faceapi);
        }
    }

    sketch.modelReady = (socketId) => {
        return function () {
            console.log(`Model loaded for source ${socketId}`);
            faceapis.get(socketId).detect(sketch.gotResults(socketId));
        }
    };

    sketch.gotResults = (socketId) => {
        return function (err, result) {
            if (err) {
                console.log(err);
                return;
            }
            // console.log("Got Results!")
            detections.set(socketId, result);
            faceapis.get(socketId).detect(sketch.gotResults(socketId)); // Continue detecting faces
        }
    };

    sketch.getEyeBoundingBoxes = (socketId) => {
        /*
        detectionsArray is an array, each element is each person detected
        */
        // Get the array of detections for the specified socketId
        let detectionsArray = detections.get(socketId);


        if (detectionsArray && detectionsArray.length > 0) {
            // Get the first detection in the array
            let detection = detectionsArray[0];


            // console.log("detectionsArray", detectionsArray)
            // console.log("detection", detection)
            // console.log("videoElements[socketId]",videoElements[socketId])

            const scaleX = sketch.width / videoElements[socketId].width;
            const scaleY = sketch.height / videoElements[socketId].height;

            const box = detection.detection.box;
            box.x *= scaleX;
            box.y *= scaleY;
            box.width *= scaleX;
            box.height *= scaleY;

            const landmarks = detection.landmarks;
            landmarks.positions.forEach(position => {
                position.x *= scaleX;
                position.y *= scaleY;
            });

            // console.log("landmarks",landmarks)
            // console.log("scaleX",scaleX)
            // console.log("scaleY",scaleY)


            if (detection && detection.parts && 'leftEye' in detection.parts && 'rightEye' in detection.parts) {

                let leftEye = detection.parts.leftEye;
                let rightEye = detection.parts.rightEye;


                let minX = Math.min(...leftEye.map(point => point.x)) * scaleX;
                let minY = Math.min(...leftEye.map(point => point.y)) * scaleY;
                let maxX = Math.max(...leftEye.map(point => point.x)) * scaleX;
                let maxY = Math.max(...leftEye.map(point => point.y)) * scaleY;
                let rminX = Math.min(...rightEye.map(point => point.x)) * scaleX;
                let rminY = Math.min(...rightEye.map(point => point.y)) * scaleY;
                let rmaxX = Math.max(...rightEye.map(point => point.x)) * scaleX;
                let rmaxY = Math.max(...rightEye.map(point => point.y)) * scaleY;

                // Return the bounding box as an array
                return [[minX, minY, maxX, maxY], [rminX, rminY, rmaxX, rmaxY]];
            } else {
                console.error('Unable to access leftEye for detection:', detection);
                return null;
            }
        } else {
            // console.log('No detections found for socketId:', socketId);
            return null;
        }
    };
    /*NOW TESTING*/sketch.getMultipleEyeBoundingBoxes = (socketId) => {
        let centerPointsArray = [];
        let detectionsArray = detections.get(socketId);
        let isThereAnyEyesDetected = false
        let minXofCenterPoints = w;
        let minYofCenterPoints = h;
        let maxXofCenterPoints = 0;
        let maxYofCenterPoints = 0;
        let midXofCenterPoints = 0;
        let midYofCenterPoints = 0;
        let grandDistance;
        if (detectionsArray && detectionsArray.length > 0) {
            // Get the first detection in the array
            // let detection = detectionsArray[0];

            detectionsArray.forEach(detection => {

                const scaleX = sketch.width / videoElements[socketId].width;
                const scaleY = sketch.height / videoElements[socketId].height;
                const box = detection.detection.box;
                box.x *= scaleX;
                box.y *= scaleY;
                box.width *= scaleX;
                box.height *= scaleY;

                const landmarks = detection.landmarks;
                landmarks.positions.forEach(position => {
                    position.x *= scaleX;
                    position.y *= scaleY;
                });

                if (detection && detection.parts && 'leftEye' in detection.parts && 'rightEye' in detection.parts) {
                    isThereAnyEyesDetected = true
                    let leftEye = detection.parts.leftEye;
                    let rightEye = detection.parts.rightEye;


                    let minX = Math.min(...leftEye.map(point => point.x)) * scaleX;
                    let minY = Math.min(...leftEye.map(point => point.y)) * scaleY;
                    let rmaxX = Math.max(...rightEye.map(point => point.x)) * scaleX;
                    let rmaxY = Math.max(...rightEye.map(point => point.y)) * scaleY;
                    let midX = (minX + rmaxX) / 2
                    let midY = (minY + rmaxY) / 2
                    let midPoint = sketch.createVector(midX, midY)
                    centerPointsArray.push(midPoint)
                    // sketch.circle(midX,midY,10)
                }
            })
            if (isThereAnyEyesDetected) {
                // centerPointsArray.forEach(midPoint => {
                // if (midPoint[0] < minXofCenterPoints) minXofCenterPoints = midPoint[0]
                // if (midPoint[0] > maxXofCenterPoints) maxXofCenterPoints = midPoint[0]
                // if (midPoint[1] < minYofCenterPoints) minYofCenterPoints = midPoint[1]
                // if (midPoint[1] > maxYofCenterPoints) maxYofCenterPoints = midPoint[1]

                // })

                minXofCenterPoints = Math.min(...centerPointsArray.map(point => point.x));
                minYofCenterPoints = Math.min(...centerPointsArray.map(point => point.y));
                maxXofCenterPoints = Math.max(...centerPointsArray.map(point => point.x));
                maxYofCenterPoints = Math.max(...centerPointsArray.map(point => point.y));

                midXofCenterPoints = (minXofCenterPoints + maxXofCenterPoints) / 2
                midYofCenterPoints = (minYofCenterPoints + maxYofCenterPoints) / 2
                grandDistance = sketch.dist(minXofCenterPoints, minYofCenterPoints, maxXofCenterPoints, maxXofCenterPoints) / 2
                grandDistance = Math.max((maxXofCenterPoints - minXofCenterPoints), (maxYofCenterPoints - minYofCenterPoints))*zoomAmount
                // grandDistance = maxXofCenterPoints - minXofCenterPoints;

                if (centerPointsArray.length == 1) {
                    return [midXofCenterPoints, midYofCenterPoints, 700]
                } else {
                    return [midXofCenterPoints, midYofCenterPoints, grandDistance]
                }
            } else {
                return null
            }

        } else {
            // console.log('No detections found for socketId:', socketId);
            return null;
        }
    };
    sketch.drawMask = (socketId) => {
        let detectionsArray = detections.get(socketId);
        if (detectionsArray && detectionsArray.length > 0) {
            // let detection = detectionsArray[0]; //moved everything inside the forEach loop

            detectionsArray.forEach(detection => {
                const scaleX = sketch.width / videoElements[socketId].width;
                const scaleY = sketch.height / videoElements[socketId].height;

                // Adjust landmark scaling
                const landmarks = detection.landmarks;
                landmarks.positions.forEach(position => {
                    position.x *= scaleX;
                    position.y *= scaleY;
                });

                if (detection && detection.parts && 'leftEye' in detection.parts && 'rightEye' in detection.parts) {

                    globalMask.background(255); // Set background to white

                    globalMask.fill(0);

                    // Draw and fill eye polygons
                    ['leftEye', 'rightEye'].forEach(eye => {
                        if (detection.parts[eye] && detection.parts[eye].length > 5) {
                            let centerEyePoint = sketch.createVector((detection.parts[eye][0].x + detection.parts[eye][3].x) / 2, (detection.parts[eye][0].y + detection.parts[eye][3].y) / 2)

                            globalMask.beginShape();

                            detection.parts[eye].forEach(point => {
                                let pointLerped = sketch.createVector(point.x, point.y)
                                pointLerped.lerp(centerEyePoint, -0.9)
                                globalMask.curveVertex(pointLerped.x * scaleX, pointLerped.y * scaleY);
                                // globalMaskmask.curveVertex(point.x * scaleX, point.y * scaleY);
                            });
                            globalMask.endShape(sketch.CLOSE);
                        } else {
                            console.log("wrong with lerping")
                        }
                    });

                    // Apply Gaussian blur to the mask
                    sketch.push();
                    globalMask.filter(sketch.BLUR, 4);  // Adjust the radius to control the softness
                    sketch.pop();

                    // Use the mask to filter the original image
                    // sketch.image(videoElements[socketId], 0, 0);
                    // sketch.blendMode(sketch.DARKEST);
                    // sketch.image(globalMask, 0, 0);
                    // sketch.blendMode(sketch.BLEND);

                    // return globalMask;  
                    return true
                } else {
                    console.error('Unable to access eyes for detection:', detection);
                    return false;
                }
            });


        } else if (detectionsArray) {
            // console.log('detectionsArray exists, but no detections found for socketId:', socketId);
            return false;
        } else {
            // console.log('No detections found for socketId:', socketId);
            return false;
        }
    };
    /*NOWTESTING*/sketch.drawMultipleEyesMask = (socketId) => {
        let detectionsArray = detections.get(socketId);
        let isThereAnyEyesDetected = false
        if (detectionsArray && detectionsArray.length > 0) {
            globalMask.background(255);
            globalMask.fill(0);
            const scaleX = sketch.width / videoElements[socketId].width;
            const scaleY = sketch.height / videoElements[socketId].height;

            // let detection = detectionsArray[0];// should be in a for loop

            detectionsArray.forEach(detection => {
                const landmarks = detection.landmarks;
                landmarks.positions.forEach(position => {
                    position.x *= scaleX;
                    position.y *= scaleY;
                });

                if (detection && detection.parts && 'leftEye' in detection.parts && 'rightEye' in detection.parts) {
                    isThereAnyEyesDetected = true;
                    ['leftEye', 'rightEye'].forEach(eye => {
                        if (detection.parts[eye] && detection.parts[eye].length > 5) {
                            let centerEyePoint = sketch.createVector((detection.parts[eye][0].x + detection.parts[eye][3].x) / 2, (detection.parts[eye][0].y + detection.parts[eye][3].y) / 2)

                            globalMask.beginShape();

                            detection.parts[eye].forEach(point => {
                                let pointLerped = sketch.createVector(point.x, point.y)
                                pointLerped.lerp(centerEyePoint, -0.9)
                                globalMask.curveVertex(pointLerped.x * scaleX, pointLerped.y * scaleY);
                                // globalMaskmask.curveVertex(point.x * scaleX, point.y * scaleY);
                            });
                            globalMask.endShape(sketch.CLOSE);
                        } else {
                            console.log("wrong with lerping")
                        }
                    });

                    sketch.push();
                    globalMask.filter(sketch.BLUR, 4);  // Adjust the radius to control the softness
                    sketch.pop();
                }
            })

            return isThereAnyEyesDetected
        } else if (detectionsArray) {
            return false;
        } else {
            return false;
        }
    };

    /*NOTINUSE*/sketch.getEyeBoundingTestBoxes = (id) => {
        let allEyeBoundingBoxes; // Stores bounding boxes for each socket

        let finalEyeBoundingBoxes;
        detections.forEach((detection, socketId) => {

            //added scale stuff
            // Scale the box coordinates to the full screen size
            const scaleX = sketch.width / videoElements[socketId].videoWidth;
            const scaleY = sketch.height / videoElements[socketId].videoHeight;
            const box = detection.box;
            box.x *= scaleX;
            box.y *= scaleY;
            box.width *= scaleX;
            box.height *= scaleY;

            // Scale the landmark coordinates to the full screen size
            const landmarks = detection.landmarks;
            landmarks.positions.forEach(position => {
                position.x *= scaleX;
                position.y *= scaleY;
            });

            //end of added scale stuff

            let eyeBoundingBoxes = [];
            // console.log("This is socket Id: ", socketId);
            // console.log("This is detection: ", detection);
            if (detection.length == 0) return
            // console.log("This is parts: ", detection[0].parts);
            const leftEye = detection[0].parts.leftEye;
            const rightEye = detection[0].parts.rightEye;
            // Calculate and store bounding boxes for both eyes
            eyeBoundingBoxes.push(sketch.calculateBoundingBox(leftEye));
            eyeBoundingBoxes.push(sketch.calculateBoundingBox(rightEye));
            if (id == socketId) allEyeBoundingBoxes = finalEyeBoundingBoxes
        });
        return allEyeBoundingBoxes;
    };


    /*NOTINUSE*/sketch.calculateBoundingBox = (eye) => {
        const x1 = Math.min(eye.map(p => p._x));
        const y1 = Math.min(eye.map(p => p._y));
        const x2 = Math.max(eye.map(p => p._x));
        const y2 = Math.max(eye.map(p => p._y));

        const width = (x2 - x1) * scale;
        const height = (y2 - y1) * scale;
        const centerX = (x1 + x2) / 2 * scale; // Scale the x coordinate
        const centerY = (y1 + y2) / 2 * scale; // Scale the y coordinate

        // Adjust position to keep the box centered around the eye
        var newX = centerX - width / 2;
        var newY = centerY - height / 2;

        // Return scaled and centered bounding box as an object
        // console.log("newX: " + newX + " newY: " + newY + " width: " + width + " height: " + height);
        return { x: newX, y: newY, width: width, height: height };
    };


    sketch.draw = () => {
        sketch.background(255);

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
            if (socketId !== socket.id && detections.size > 0) {
                let capture = videoElements[socketId];
                // console.log("capture.width: ", capture.width, "capture.height: ", capture.height);
                capture.loadPixels();

                //added - NEW
                // accumulatedImage.pixels = sketch.copyImage(capture.pixels, accumulatedImage.pixels);
                // accumulatedImage.updatePixels();
                // end of NEW

                let eyeBoxes = [];
                // console.log("detections: ", detections);
                // console.log("detections.has(socketId): ",detections.has(socketId));
                if (detections.has(socketId)) {

                    eyeBoxes = sketch.getMultipleEyeBoundingBoxes(socketId)
                    // if (eyeBoxes) {
                    //     let targetCenterX = eyeBoxes[0]
                    //     let targetCenterY = eyeBoxes[1]
                    //     let targetZoom = eyeBoxes[2] * zoomAmount;
                    //     sketch.text(targetZoom,targetCenterX,targetCenterY)
                    //     sketch.fill(255, 0, 0)
                    //     sketch.circle(targetCenterX, targetCenterY, targetZoom)
                    //     sketch.fill(0, 255, 0)
                    //     sketch.circle(targetCenterX, targetCenterY, 30)
                    // }
                    if (eyeBoxes) {
                        let targetCenterX = eyeBoxes[0]
                        let targetCenterY = eyeBoxes[1]
                        // let targetZoom = eyeBoxes[2] * zoomAmount;
                        let targetZoom = eyeBoxes[2];
                        // sketch.circle(targetCenterX,targetCenterY,30)

                        currentCenterX = sketch.lerp(currentCenterX, targetCenterX, lerpSpeed);
                        currentCenterY = sketch.lerp(currentCenterY, targetCenterY, lerpSpeed);
                        currentZoom = sketch.lerp(currentZoom, targetZoom, lerpSpeed);
                    }
                }

                if (capture.pixels.length > 0) {
                    if (!previousPixels) {
                        // Copy initial pixels to previousPixels array using copyImage
                        previousPixels = sketch.copyImage(capture.pixels, previousPixels);
                    } else {
                        var cw = capture.width,
                            ch = capture.height;
                        var pixels = capture.pixels;
                        // sketch.loadPixels();
                        accumulatedImage.loadPixels();
                        let thresholdAmount = (thresholdSlider.value() * 255) / 100;
                        thresholdAmount *= 3;

                        // let coord = sketch.getPixelCoordinates(index, cw)

                        // console.log("coord.x: ", coord.x,"  " + "coord.y: + " + coord.y, "  in inside boxes: " + isInsideBoxes)
                        let isAnyInsideBoxes = false

                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                var index = (x + y * w) * 4; // Calculate the index for the pixels array
                                // let isInsideBoxes = sketch.isPixelInBoundingBoxes(x, y, eyeBoxes)
                                let isInsideBoxes = true;
                                let rdiff = Math.abs(pixels[index] - previousPixels[index]);
                                let gdiff = Math.abs(
                                    pixels[index + 1] - previousPixels[index + 1]
                                );
                                let bdiff = Math.abs(
                                    pixels[index + 2] - previousPixels[index + 2]
                                );
                                var diffs = rdiff + gdiff + bdiff;
                                if (diffs > thresholdAmount) {
                                    if (isInsideBoxes) {
                                        isAnyInsideBoxes = true
                                        accumulatedImage.pixels[index] = pixels[index]; // Red channel
                                        accumulatedImage.pixels[index + 1] = pixels[index + 1]; // Green channel
                                        accumulatedImage.pixels[index + 2] = pixels[index + 2]; // Blue channel}
                                        // console.log("is inside!")

                                    } else {
                                    }
                                    // Update previousPixels for the next frame
                                    previousPixels[index] = pixels[index];
                                    previousPixels[index + 1] = pixels[index + 1];
                                    previousPixels[index + 2] = pixels[index + 2];
                                }
                            }
                        }

                        // console.log("isAnyInsideBoxes?", isAnyInsideBoxes);
                        accumulatedImage.updatePixels();
                        // console.log("accumulatedImage.pixels.length end draw: ", accumulatedImage.pixels.length); // 3686400 /4 = 921600, 921600 / 1280 = 720
                        // sketch.updatePixels();


                        // sketch.image(accumulatedImage, 0, 0, w, h);
                        sketch.image(accumulatedImage, 0, 0, w, h, currentCenterX - currentZoom / 2, currentCenterY - (currentZoom / 2) / w * h, currentZoom, currentZoom);

                        let displayMask = sketch.drawMultipleEyesMask(socketId)
                        let scaleMask = 1;
                        if (displayMask) {
                            sketch.blendMode(sketch.LIGHTEST);
                            // sketch.image(globalMask, 0, 0, w * scaleMask, h * scaleMask);
                            sketch.image(globalMask, 0, 0, w * scaleMask, h * scaleMask,
                                (currentCenterX - currentZoom / 2), (currentCenterY - (currentZoom / 2) / w * h), currentZoom * scaleMask, currentZoom * scaleMask);
                            sketch.blendMode(sketch.BLEND);
                        } else {
                            sketch.image(whiteMask, 0, 0, w, h)
                        }

                        // let mask = sketch.drawMask(socketId)
                        // let scaleMask = 1;
                        // if (mask) {
                        //     sketch.blendMode(sketch.LIGHTEST);
                        //     sketch.image(mask, 0, 0, w * scaleMask, h * scaleMask,
                        //         (currentCenterX - currentZoom / 2), (currentCenterY - currentZoom / 2), currentZoom * scaleMask, currentZoom * scaleMask);
                        //     sketch.blendMode(sketch.BLEND);
                        // } else {

                        //     sketch.image(whiteMask, 0, 0, w, h)
                        // }

                        // sketch.push();
                        // sketch.tint(255, 64);
                        // sketch.image(capture, 0, 0, w, h);
                        // sketch.pop();


                    }

                }

                // console.log('eyeBoxes:', eyeBoxes);
                // if (eyeBoxes && eyeBoxes[0]) {

                //     sketch.circle(eyeBoxes[0][0], eyeBoxes[0][1], 30);
                //     sketch.text(`Left Eye: (${eyeBoxes[0][0]}, ${eyeBoxes[0][1]})`, eyeBoxes[0][0], eyeBoxes[0][1]);
                // } else {
                //     sketch.circle(sketch.width / 2, sketch.height / 2, 30);
                // }

            }
        };
    };


    sketch.isPixelInBoundingBoxes = (x, y, boxes) => {
        // console.log("boxes: " + boxes);
        if (boxes == undefined) {
            // console.log("not inside")
            return false
        }

        let scaledX = x * scale;
        let scaledY = y * scale;

        for (let box of boxes) {
            if (scaledX >= box[0] && scaledX < box[2] && scaledY >= box[1] && scaledY < box[3]) {
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
            console.log("receivedStream->simplePeerWrapper.socket_id !== socket.id")
            let domElement = document.createElement("VIDEO");
            domElement.className = "domVideo";
            domElement.srcObject = stream;
            document.body.appendChild(domElement);
            domElement.width = w;
            domElement.height = h;

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


                sketch.initiateFaceApi();

                let video = document.getElementById('myVideo');
                console.log("video width: ", video.videoWidth, "video height: ", video.videoHeight);
            });


            // videoElements[simplePeerWrapper.socket_id] = videoEl;
        }

    };

};

function initp5() {
    myp5 = new p5(s, 'p5sketch');

}

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

