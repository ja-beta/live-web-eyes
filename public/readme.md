**Current Framework**
Event load -> initCapture -> setupSocket
receivedStream -> p5 instance -> display

**Possible Framework**
Event load -> initCapture -> setupSocket <- receiveData
		    |-------> p5 instance <-------|
							|-> sendData
						  	|-> Display
						


**Key Problems**
1. how to seperate sending and drawing? How to make received data displayed?
By using createCanvas, displaying data on this side. Received data would also be a canvas on top of it. This benefits the optional feature "displaying double side".

2. When to get the p5 instance running?
In the initCapture, and also possibly replace video capture with p5 webcam.

3. How to input the received data to p5 instances?
