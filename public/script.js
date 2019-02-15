/*************************
 * Consts for everyone!
 ************************/
let keyWhitelist = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87];

let TEMPERATURE = getTemperature();




const heldButtonToVisualData = new Map();

// Which notes the pedal is sustaining.
let sustaining = false
let sustainingNotes = [];
// new try
// Mousedown/up events are weird because you can mouse down in one element and mouse up
// in another, so you're going to lose that original element and never mouse it up.
let mouseDownButton = null;

// socket io reference
let socket;

const player = new Player();
const genie = new mm.PianoGenie(CONSTANTS.GENIE_CHECKPOINT);
const painter = new FloatyNotes();
const piano = new Piano();


initEverything();

/*************************
 * Basic UI bits
 ************************/
function initEverything() {
  genie.initialize().then(() => {
    socket = io.connect('localhost:3000');

    console.log('🧞‍♀️ ready!')
    //playBtn.textContent = 'Play';
    //playBtn.removeAttribute('disabled');
    //playBtn.classList.remove('loading');

    showMainScreen();

  });

  // Start the drawing loop.
  onWindowResize();
  window.requestAnimationFrame(() => painter.drawLoop());

  // Event listeners.
  //window.addEventListener('resize', onWindowResize);
  //window.addEventListener('orientationchange', onWindowResize);
  window.addEventListener('hashchange', () => TEMPERATURE = getTemperature());
}

function maxKey(data){
  keyWhitelist = data.key;
  console.log(keyWhitelist);
}

function maxNote(data){
let p = data.pitch;
let v = data.vel;

// i just copied the onKeyUp / Down routines:
if (v <= 0){
  if (p === 32) {  // sustain pedal
    sustaining = false;
    // Release everything.

    sustainingNotes.forEach((note) => player.playNoteUp(note));
    sustainingNotes = [];
  } else {
    const button = p;
    if (button != null) {
      buttonUp(button);
    }
  }

}

else {
  // Keydown fires continuously and we don't want that.

  if (p === 32) {  // sustain pedal
    sustaining = true;
  } else if (p === 48) { // 0
    console.log('🧞‍♀️ resetting!');
    genie.resetState();
  } else {
    const button = p;
    //console.log(button)
    if (button != null) {
      buttonDown(button, true);
    }
  }


}
}



function showMainScreen() {

  //add event listener for incoming max notes
  socket.on('maxnote', maxNote);
  socket.on('maxkey', maxKey);
  socket.on('maxtemperature', maxTemperature);

  document.querySelector('.splash').hidden = true;
  document.querySelector('.loaded').hidden = false;

  document.addEventListener('keydown',onKeyDown);

  controls.addEventListener('touchstart', (event) => doTouchStart(event), {passive: true});
  controls.addEventListener('touchend', (event) => doTouchEnd(event), {passive: true});

  const hasTouchEvents = ('ontouchstart' in window);
  if (!hasTouchEvents) {
    controls.addEventListener('mousedown', (event) => doTouchStart(event));
    controls.addEventListener('mouseup', (event) => doTouchEnd(event));
  }

  controls.addEventListener('mouseover', (event) => doTouchMove(event, true));
  controls.addEventListener('mouseout', (event) => doTouchMove(event, false));
  controls.addEventListener('touchenter', (event) => doTouchMove(event, true));
  controls.addEventListener('touchleave', (event) => doTouchMove(event, false));
  canvas.addEventListener('mouseenter', () => mouseDownButton = null);

  radioMidiYes.addEventListener('click', () => {
    player.usingMidiOut = true;
    midiOutBox.hidden = false;
  });
  radioMidiNo.addEventListener('click', () => {
    player.usingMidiOut = false;
    midiOutBox.hidden = true;
  });

  // Figure out if WebMidi works.
  if (navigator.requestMIDIAccess) {
    midiNotSupported.hidden = true;
    midiSupported.hidden = false;
    navigator.requestMIDIAccess()
      .then(
          (midi) => player.midiReady(midi),
          (err) => console.log('Something went wrong', err));
  } else {
    midiNotSupported.hidden = false;
    midiSupported.hidden = true;
  }

  document.addEventListener('keyup', onKeyUp);

  // Slow to start up, so do a fake prediction to warm up the model.
  const note = genie.nextFromKeyWhitelist(0, keyWhitelist, TEMPERATURE);
	
  genie.resetState();
}

// Here touch means either touch or mouse.
function doTouchStart(event) {
  event.preventDefault();
  mouseDownButton = event.target;
  buttonDown(event.target.dataset.id, true);
}
function doTouchEnd(event) {
  event.preventDefault();
  if (mouseDownButton && mouseDownButton !== event.target) {
    buttonUp(mouseDownButton.dataset.id);
  }
  mouseDownButton = null;
  buttonUp(event.target.dataset.id);
}
function doTouchMove(event, down) {
   // If we're already holding a button down, start holding this one too.
  if (!mouseDownButton)
    return;

  if (down)
    buttonDown(event.target.dataset.id, true);
  else
    buttonUp(event.target.dataset.id, true);
}

/*************************
 * Button actions
 ************************/
function buttonDown(button, fromKeyDown) {
  // If we're already holding this button down, nothing new to do.
  if (heldButtonToVisualData.has(button)) {
    return;
  }

  const el = document.getElementById(`btn${button}`);
  if (!el)
    return;
  el.setAttribute('active', true);

  const note = genie.nextFromKeyWhitelist(button, keyWhitelist, TEMPERATURE);
  //window.max.outlet('temperature '+TEMPERATURE);
  const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + note;

  // Hear it.
  player.playNoteDown(pitch);

  // See it.
  const rect = piano.highlightNote(note, button);

  if (!rect) {
    debugger;
  }
  // Float it.
  const noteToPaint = painter.addNote(button, rect.getAttribute('x'), rect.getAttribute('width'));
  heldButtonToVisualData.set(button, {rect:rect, note:note, noteToPaint:noteToPaint});
}

function buttonUp(button) {
  const el = document.getElementById(`btn${button}`);
  if (!el)
    return;
  el.removeAttribute('active');

  const thing = heldButtonToVisualData.get(button);
  if (thing) {
    // Don't see it.
    piano.clearNote(thing.rect);

    // Stop holding it down.
    painter.stopNote(thing.noteToPaint);

    // Maybe stop hearing it.
    const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note;
    if (!sustaining) {
      player.playNoteUp(pitch);
    } else {
      sustainingNotes.push(CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note);
    }
  }
  heldButtonToVisualData.delete(button);
}

/*************************
 * Events
 ************************/
function onKeyDown(event) {

  // Keydown fires continuously and we don't want that.
  if (event.repeat) {
    return;
  }
  if (event.keyCode === 32) {  // sustain pedal
    sustaining = true;
  } else if (event.keyCode === 48) { // 0
    console.log('🧞‍♀️ resetting!');
    genie.resetState();
  } else {
    const button = getButtonFromKeyCode(event.keyCode);
    //console.log(button)
    if (button != null) {
      buttonDown(button, true);
    }
  }
}

function onKeyUp(event) {
  if (event.keyCode === 32) {  // sustain pedal
    sustaining = false;
    // Release everything.

    sustainingNotes.forEach((note) => player.playNoteUp(note));
    sustainingNotes = [];
  } else {
    const button = getButtonFromKeyCode(event.keyCode);
    if (button != null) {
      buttonUp(button);
    }
  }
}


function onWindowResize() {
  const bonusNotes = CONSTANTS.OCTAVES > 6 ? 4 : 0;  // starts on an A, ends on a C.
  const totalNotes = CONSTANTS.NOTES_PER_OCTAVE * CONSTANTS.OCTAVES + bonusNotes;
  const totalWhiteNotes = CONSTANTS.WHITE_NOTES_PER_OCTAVE * CONSTANTS.OCTAVES + (bonusNotes - 1);

  /*keyWhitelist = Array(totalNotes).fill().map((x,i) => {
    if (CONSTANTS.OCTAVES > 6) return i;
    // Starting 3 semitones up on small screens (on a C), and a whole octave up.
    return i + 3 + CONSTANTS.NOTES_PER_OCTAVE;
  });*/


  piano.resize(totalWhiteNotes);
  painter.resize(piano.config.whiteNoteHeight);
  piano.draw();
}


/*************************
 * Utils and helpers
 ************************/
const keyToButtonMap = [65,83,68,70,74,75,76,186];
function getButtonFromKeyCode(keyCode) {
  let button = keyCode - 49;
  if (button >= 0 && button < CONSTANTS.NUM_BUTTONS) {
    return button;
  } else if (keyCode === 59) {
    // In Firefox ; has a different keycode. No, I'm not kidding.
    return 7;
  } else {
    button = keyToButtonMap.indexOf(keyCode);
    if (button >= 0 && button < CONSTANTS.NUM_BUTTONS) {
      return button;
    }
  }
  return null;
}

function getTemperature() {
  const hash = parseFloat(parseHashParameters()['temperature']) || 0.25;
  const newTemp = Math.min(1, hash);
  console.log('🧞‍♀️ temperature = ', newTemp);
  return newTemp;
}

function parseHashParameters() {
  const hash = window.location.hash.substring(1);
  const params = {}
  hash.split('&').map(hk => {
    let temp = hk.split('=');
    params[temp[0]] = temp[1]
  });
  return params;
}


function maxTemperature(data){
  temp = data.temp;
  // in case you want to communicate straight into max:
  //window.max.outlet('temperature '+temp);
  TEMPERATURE = temp;
}
