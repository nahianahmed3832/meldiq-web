import { fitWithin } from "./photoQuality";
import { checkUploadSignal } from "./largeUpload";

const MAX_ENCODED_BYTES = 64 * 1024 * 1024;
const VIDEO_BITRATE = 1_800_000;
const AUDIO_BITRATE = 96_000;

export function videoMime(supported: (type: string) => boolean = (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)): string | null {
  return ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp8,opus"].find(supported) ?? null;
}

export function videoDimensions(width: number, height: number): { width: number; height: number } {
  const size = fitWithin(width, height, 1280);
  return { width: Math.max(2, Math.floor(size.width / 2) * 2), height: Math.max(2, Math.floor(size.height / 2) * 2) };
}

/** Re-encode to at most 720p/30fps, retaining audio. Already efficient videos need no further quality loss. */
export async function optimizeVideo(file: File, signal?: AbortSignal, onProgress: (percent: number) => void = () => {}): Promise<File> {
  checkUploadSignal(signal);
  const failure = () => new Error(`"${file.name}" couldn't be optimized here. Select Original file to send it unchanged.`);
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  let audio: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const done = (error?: Error) => {
        clearTimeout(deadline);
        signal?.removeEventListener("abort", aborted);
        video.onloadeddata = null;
        video.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const aborted = () => done(signal?.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"));
      signal?.addEventListener("abort", aborted, { once: true });
      video.onloadeddata = () => done();
      video.onerror = () => done(failure());
      deadline = setTimeout(() => done(failure()), 15_000);
      video.src = url;
      video.load();
    });
    checkUploadSignal(signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) throw failure();
    const dimensions = videoDimensions(video.videoWidth, video.videoHeight);
    if (video.videoWidth <= 1280 && video.videoHeight <= 1280 && (file.size * 8) / duration <= VIDEO_BITRATE + AUDIO_BITRATE) return file;
    const mime = videoMime();
    if (!mime || typeof AudioContext === "undefined" || (duration * (VIDEO_BITRATE + AUDIO_BITRATE)) / 8 > MAX_ENCODED_BYTES) throw failure();
    const canvas = document.createElement("canvas");
    Object.assign(canvas, dimensions);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context || typeof canvas.captureStream !== "function") throw failure();
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream = canvas.captureStream(30);
    audio = new AudioContext();
    const destination = audio.createMediaStreamDestination();
    audio.createMediaElementSource(video).connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track));
    // Route the selected file's audio to the recorder only; no microphone permission or speaker playback.
    await Promise.race([
      audio.resume(),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(failure()), 5000);
      }),
    ]);
    clearTimeout(deadline);
    if (audio.state !== "running") throw failure();
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: AUDIO_BITRATE });
    const chunks: Blob[] = [];
    let bytes = 0;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        clearInterval(timer);
        video.pause();
        if (error) reject(error);
        else resolve();
      };
      cancel = () => finish(signal?.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"));
      signal?.addEventListener("abort", cancel, { once: true });
      recorder!.ondataavailable = ({ data }) => {
        bytes += data.size;
        if (bytes > MAX_ENCODED_BYTES) return finish(failure());
        if (data.size) chunks.push(data);
      };
      recorder!.onerror = () => finish(failure());
      recorder!.onstop = () => finish();
      video.onerror = () => finish(failure());
      video.onended = () => {
        if (recorder?.state === "recording") recorder.stop();
      };
      timer = setInterval(() => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
      }, 1000 / 30);
      deadline = setTimeout(() => finish(failure()), duration * 1000 + 30_000);
      recorder!.start(1000);
      void video.play().catch(() => finish(failure()));
    });
    checkUploadSignal(signal);
    const type = recorder.mimeType.split(";")[0];
    if (!bytes) throw failure();
    // Re-encoding a small/efficient original must never increase transfer size.
    if (bytes >= file.size) return file;
    onProgress(100);
    return new File(chunks, file.name.replace(/\.[^.]+$/, "") + (type === "video/mp4" ? ".mp4" : ".webm"), { type, lastModified: file.lastModified });
  } finally {
    clearTimeout(deadline);
    clearInterval(timer);
    if (cancel) signal?.removeEventListener("abort", cancel);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    video.pause();
    video.removeAttribute("src");
    video.load();
    stream?.getTracks().forEach((track) => track.stop());
    await audio?.close().catch(() => {});
    URL.revokeObjectURL(url);
  }
}
