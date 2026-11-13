class JetriseAudio {
  constructor(){this.enabled=false;this.volume=.45;this.scene='ops';}
  async toggle(){
    try{
      if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('unsupported');this.ctx=new Context();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);[55,82.41,110].forEach((hz,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=.028/(i+1);o.connect(g);g.connect(this.master);o.start()});}
      this.enabled=!this.enabled;if(this.enabled)await this.ctx.resume();this.updateGain();return this.enabled;
    }catch(e){this.enabled=false;return null;}
  }
  updateGain(){if(this.master)this.master.gain.setTargetAtTime(this.enabled&&this.scene!=='cinema'?this.volume*.42:0,this.ctx.currentTime,.15)}
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.updateGain()}
  setScene(scene){this.scene=scene;this.updateGain()}
  cue(type){if(!this.enabled||!this.ctx||this.scene==='cinema')return;const ctx=this.ctx,now=ctx.currentTime;const tones={click:[440,660],repair:[330,440,660],success:[523.25,659.25,783.99],alert:[220,174.61],launch:[82.41,110,164.81]};(tones[type]||tones.click).forEach((hz,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type==='launch'?'triangle':'sine';o.frequency.setValueAtTime(hz,now+i*.075);g.gain.setValueAtTime(.0001,now);g.gain.setValueAtTime(.13,now+i*.075);g.gain.exponentialRampToValueAtTime(.0001,now+i*.075+(type==='launch'?1.7:.35));o.connect(g);g.connect(this.master);o.start(now+i*.075);o.stop(now+i*.075+2)});if(type==='launch'){const length=ctx.sampleRate*2,buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/length);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(140,now);filter.frequency.exponentialRampToValueAtTime(900,now+1.4);gain.gain.value=.2;source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();}}
}
window.jetriseAudio=new JetriseAudio();
