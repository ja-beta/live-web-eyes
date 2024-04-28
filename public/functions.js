// // A wrapper for simplepeer as we need a bit more than it provides
// class SimplePeerWrapper {

//     constructor(initiator, socket_id, socket, stream, streamCallback, dataCallback) {
//         this.simplepeer = new SimplePeer({
//             initiator: initiator,
//             trickle: false,
//             config: {
//                 iceServers: [
//                     { urls: 'stun:stun.l.google.com:19302' },
//                     { urls: 'stun:stun2.l.google.com:19302' }]
//             },
//         });

//         // Their socket id, our unique id for them
//         this.socket_id = socket_id;

//         // Socket.io Socket
//         this.socket = socket;

//         // Our video stream - need getters and setters for this
//         this.stream = stream;

//         // Callback for when we get a stream from a peer
//         this.streamCallback = streamCallback;

//         // Callback for when we get data form a peer
//         this.dataCallback = dataCallback;

//         // simplepeer generates signals which need to be sent across socket
//         this.simplepeer.on('signal', data => {
//             this.socket.emit('signal', this.socket_id, this.socket.id, data);
//         });

//         // When we have a connection, send our stream
//         this.simplepeer.on('connect', () => {
//             console.log('CONNECT')
//             console.log(this.simplepeer);
//             //p.send('whatever' + Math.random())

//             // Let's give them our stream
//             this.simplepeer.addStream(stream);
//             console.log("Send our stream");
//         });

//         // Stream coming in to us
//         this.simplepeer.on('stream', stream => {
//             console.log('Incoming Stream');
//             streamCallback(stream, this);
//         });

//         this.simplepeer.on('close', () => {
//             console.log('Got close event');
//             // Should probably remove from the array of simplepeers
//         });

//         this.simplepeer.on('error', (err) => {
//             console.log(err);
//         });

//         // Handle Data
//         this.simplepeer.on('data', data => {
//             console.log("Got Data: " + data);
//             dataCallback(data, this);
//         });
//     }

//     inputsignal(sig) {
//         this.simplepeer.signal(sig);
//     }

//     // Handle Data
//     sendData(data) {
//         this.simplepeer.send(data);
//     }
// }
