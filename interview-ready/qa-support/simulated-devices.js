/* Local-browser QA fixture only. Not bundled, no physical media access. */
window.irQaDevices={streams:[],contexts:[],brightness:130};
navigator.mediaDevices.getUserMedia=async function(constraints){
 if(constraints.video){const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');const shade=irQaDevices.brightness;x.fillStyle=`rgb(${shade},${shade},${shade})`;x.fillRect(0,0,1280,720);const s=c.captureStream(30);irQaDevices.streams.push(s);return s;}
 const a=new AudioContext();const d=a.createMediaStreamDestination();const o=a.createOscillator();const g=a.createGain();o.frequency.value=180;g.gain.setValueAtTime(.00001,a.currentTime);g.gain.setValueAtTime(irQaDevices.voiceGain||.10,a.currentTime+2.3);o.connect(g).connect(d);o.start();await a.resume();irQaDevices.contexts.push(a);irQaDevices.streams.push(d.stream);return d.stream;
};
true;
