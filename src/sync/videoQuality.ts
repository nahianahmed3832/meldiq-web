import { text as uiText } from "../i18n";
import { fitWithin } from "./photoQuality";
import { checkUploadSignal } from "./largeUpload";
const MAX_ENCODED_BYTES = 64 * 1024 * 1024;
const VIDEO_BITRATE = 1800000;
const AUDIO_BITRATE = 96000;
function videoMime(source: string): string | null {
  const formats = source === "video/webm" ? ["video/webm;codecs=vp8,opus"] : ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];
  return typeof MediaRecorder === "undefined" ? null : (formats.find((type) => MediaRecorder.isTypeSupported(type)) ?? null);
}
export function videoDimensions(
  width: number,
  height: number,
): {
  width: number;
  height: number;
} {
  const size = fitWithin(width, height, 1280);
  return { width: Math.max(2, Math.floor(size.width / 2) * 2), height: Math.max(2, Math.floor(size.height / 2) * 2) };
}
/** Re-encode to at most 720p/30fps, retaining audio. Already efficient videos need no further quality loss. */
export async function optimizeVideo(file: File, signal?: AbortSignal, onProgress: (percent: number) => void = () => {}): Promise<File> {
  checkUploadSignal(signal);
  // Canvas recording runs in real time. Keep long clips and formats that would require container conversion.
  if (file.type !== "video/mp4" && file.type !== "video/webm") return file;
  const failure = () => new Error(uiText("calls.interface.value0_couldn_t_be_optimized_here_select_original_file_to_send_it_8a4d9bf", { value0: file.name }));
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "metadata";
  let audio: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    const waitFor = (event: "loadedmetadata" | "loadeddata", start: () => void) =>
      new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(deadline);
          signal?.removeEventListener("abort", aborted);
          video.removeEventListener(event, ready);
          video.onerror = null;
          if (error) reject(error);
          else resolve();
        };
        const ready = () => finish();
        const aborted = () => finish(new DOMException("Cancelled", "AbortError"));
        signal?.addEventListener("abort", aborted, { once: true });
        video.addEventListener(event, ready, { once: true });
        video.onerror = () => finish(failure());
        deadline = setTimeout(() => finish(failure()), 15000);
        start();
      });
    await waitFor("loadedmetadata", () => {
      video.src = url;
      video.load();
    });
    checkUploadSignal(signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) throw failure();
    const dimensions = videoDimensions(video.videoWidth, video.videoHeight);
    const estimated = (duration * (VIDEO_BITRATE + AUDIO_BITRATE)) / 8;
    if (duration > 30 || estimated >= file.size * 0.85) return file;
    const mime = videoMime(file.type);
    if (!mime || typeof AudioContext === "undefined") return file;
    if (video.readyState < 2)
      await waitFor("loadeddata", () => {
        video.preload = "auto";
      });
    checkUploadSignal(signal);
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
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(deadline);
        signal?.removeEventListener("abort", aborted);
      };
      const aborted = () => {
        done();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      signal?.addEventListener("abort", aborted, { once: true });
      deadline = setTimeout(() => {
        done();
        reject(failure());
      }, 5000);
      void audio!.resume().then(
        () => {
          done();
          resolve();
        },
        (error: unknown) => {
          done();
          reject(error);
        },
      );
    });
    checkUploadSignal(signal);
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
      let lastPercent = -1;
      timer = setInterval(() => {
        if (video.readyState >= 2) context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const percent = Math.min(95, Math.floor((video.currentTime / duration) * 20) * 5);
        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress(percent);
        }
      }, 1000 / 30);
      deadline = setTimeout(() => finish(failure()), duration * 1000 + 30000);
      recorder!.start(1000);
      void video.play().catch(() => finish(failure()));
    });
    checkUploadSignal(signal);
    const type = recorder.mimeType.split(";")[0];
    if (!bytes) throw failure();
    // Re-encoding a small/efficient original must never increase transfer size.
    if (type !== file.type || bytes >= file.size * 0.9) return file;
    onProgress(100);
    return new File(chunks, file.name, { type, lastModified: file.lastModified });
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
