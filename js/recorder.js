import { setAudioSessionType } from "./audio-engine.js?v=a7b90eee";

const MIME_TYPES = [ "audio/webm;codecs=opus", "audio/mp4" ];

export function isRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export function startRecording({maxSeconds: maxSeconds, onStart: onStart}) {
  let stopRequested = false;
  let recorder = null;
  const stop = () => {
    stopRequested = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };
  const done = (async () => {
    setAudioSessionType("play-and-record");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (error) {
      setAudioSessionType("playback");
      throw error;
    }
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("ended", stop);
      track.addEventListener("mute", stop);
    }
    const release = () => {
      for (const track of stream.getTracks()) track.stop();
      setAudioSessionType("playback");
    };
    if (stopRequested) {
      release();
      return null;
    }
    const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? {
      mimeType: mimeType
    } : undefined);
    const chunks = [];
    return new Promise((resolve, reject) => {
      let startedAt = 0;
      let limitTimer = 0;
      recorder.addEventListener("start", () => {
        startedAt = performance.now();
        limitTimer = setTimeout(stop, maxSeconds * 1e3);
        onStart?.();
      });
      recorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        clearTimeout(limitTimer);
        release();
        const type = recorder.mimeType || mimeType || "";
        const elapsed = startedAt ? performance.now() - startedAt : 0;
        resolve({
          blob: new Blob(chunks, {
            type: type
          }),
          mimeType: type,
          durationMs: Math.min(elapsed, maxSeconds * 1e3)
        });
      });
      recorder.addEventListener("error", event => {
        clearTimeout(limitTimer);
        release();
        reject(event.error || new Error("錄音失敗"));
      });
      recorder.start();
    });
  })();
  return {
    stop: stop,
    done: done
  };
}
