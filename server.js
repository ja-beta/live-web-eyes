var https = require('https');
var fs = require('fs'); //using the filesystem module


var credentials = {
	key: fs.readFileSync('/etc/letsencrypt/live/jn2813.itp.io/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/jn2813.itp.io/cert.pem')
};

// Express is a node module for building HTTP servers
var express = require('express');
var app = express();

// Tell Express to look in the "public" folder for any files first
app.use(express.static('public'));

// If the user just goes to the "route" / then run this function
app.get('/', function (req, res) {
	res.send('Hello World!')
});

var httpsServer = https.createServer(credentials, app);

// Default HTTPS Port
httpsServer.listen(4440);

let peers = [];

const { Server } = require('socket.io');
var io = new Server(httpsServer, {});


// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.sockets.on('connection', 

	// We are given a websocket object in our function
	function (socket) {
	
		peers.push({socket: socket});
		console.log("We have a new client: " + socket.id + " peers length: " + peers.length);

		socket.broadcast.emit('newUser', socket.id);
		
		socket.on('list', function() {
			let ids = [];
			for (let i = 0; i < peers.length; i++) {
                if (peers[i].socket.id !== socket.id){
                    ids.push(peers[i].socket.id);
                }
			}
			console.log("ids length: " + ids.length);
			socket.emit('listresults', ids);			
		});
		
		// Relay signals back and forth
		socket.on('signal', (to, from, data) => {
			console.log("SIGNAL", to, data);
			let found = false;
			for (let i = 0; i < peers.length; i++) {
				console.log(peers[i].socket.id, to);
				if (peers[i].socket.id == to) {
					console.log("Found Peer, sending signal");
					peers[i].socket.emit('signal', to, from, data);
					found = true;
					break;
				}				
			}	
			if (!found) {
				console.log("never found peer");
			}
		});

		
		socket.on('disconnect', function() {
			console.log("Client has disconnected " + socket.id);
		    io.emit('peer_disconnect', socket.id);
			for (let i = 0; i < peers.length; i++) {
				if (peers[i].socket.id == socket.id) {
					peers.splice(i,1);
				}
			}			
		});
	}
);

