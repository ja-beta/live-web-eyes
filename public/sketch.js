const p = (sketch) => {
    let capture;
    let previousPixels;
    let w = 640;
    let h = 480;
    let thresholdSlider;
    let timeout = 10;
  
    sketch.setup = () => {
      sketch.frameRate(16);
      sketch.createCanvas(w, h);
      capture = sketch.createCapture(
        {
          audio: false,
          video: {
            width: w,
            height: h,
          },
        },
        function () {
          console.log("capture ready.");
        }
      );
      capture.elt.setAttribute("playsinline", "");
      capture.size(w, h);
      capture.hide();
  
      // Create a slider for adjusting threshold
      thresholdSlider = sketch.createSlider(0, 100, 25); // min, max, initial value
      thresholdSlider.position(10, 10);
  
      // Initialize the accumulatedImage
      accumulatedImage = sketch.createImage(w, h);
      accumulatedImage.loadPixels();
      for (let i = 0; i < accumulatedImage.pixels.length; i++) {
        accumulatedImage.pixels[i] = 255; // start with a white background
      }
      accumulatedImage.updatePixels();
  
      setTimeout(resetImage, timeout);
    };
  
    function copyImage(src, dst) {
      var n = src.length;
      if (!dst || dst.length !== n) {
        dst = new src.constructor(n);
      }
      while (n--) {
        dst[n] = src[n];
      }
      return dst;
    }
  
    function resetImage() {
      accumulatedImage.loadPixels();
      for (let i = 0; i < accumulatedImage.pixels.length; i += 4) {
        accumulatedImage.pixels[i] = 220; // Red
        accumulatedImage.pixels[i + 1] = 220; // Green
        accumulatedImage.pixels[i + 2] = 220; // Blue
        accumulatedImage.pixels[i + 3] = 150; // Alpha
      }
      accumulatedImage.updatePixels();
  
      setTimeout(resetImage, timeout);
    }
  
  
    sketch.draw = () => {
      console.log("function draw")
      sketch.background(0);
  
      var total = 0;
      capture.loadPixels();
      
      console.log("capture.pixels.length: ",capture.pixels.length)
      console.log("capture.width: ",capture.width)
      console.log("capture.height: ",capture.height)

      if (capture.pixels.length > 0) {
        if (!previousPixels) {
          // Copy initial pixels to previousPixels array using copyImage
          previousPixels = copyImage(capture.pixels, previousPixels);
        } else {
          var w = capture.width,
            h = capture.height;
          var i = 0;
          var pixels = capture.pixels;
          let thresholdAmount = (thresholdSlider.value() * 255) / 100;
          thresholdAmount *= 3;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              var index = (x + y * w) * 4; // Calculate the index for the pixels array
              let rdiff = Math.abs(capture.pixels[index] - previousPixels[index]);
              let gdiff = Math.abs(
                capture.pixels[index + 1] - previousPixels[index + 1]
              );
              let bdiff = Math.abs(
                capture.pixels[index + 2] - previousPixels[index + 2]
              );
              var diffs = rdiff + gdiff + bdiff;
              if (diffs > thresholdAmount) {
                accumulatedImage.pixels[index] = pixels[index]; // Red channel
                accumulatedImage.pixels[index + 1] = pixels[index + 1]; // Green channel
                accumulatedImage.pixels[index + 2] = pixels[index + 2]; // Blue channel
              } else {
                // accumulatedImage.pixels[index + 3] = 32;
                pixels[index + 3] -= 20;
              }
              // Update previousPixels for the next frame
              previousPixels[index] = capture.pixels[index];
              previousPixels[index + 1] = capture.pixels[index + 1];
              previousPixels[index + 2] = capture.pixels[index + 2];
            }
          }
          accumulatedImage.updatePixels();
          sketch.updatePixels();
          // push();
          // fill(255, 50);
          // rect(0,0,width, height);
          // pop();
          sketch.image(accumulatedImage, 0, 0, w, h);
        }
      }
    };
  };
  
//   let instance = new p5(p);
  