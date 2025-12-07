// Thumbnail helper: capture a video frame at ~0.1s using HTMLVideoElement + Canvas.
// Mediabunny also provides decoding APIs; for now use DOM to avoid async worker setup.

export const captureVideoThumbnail = async (url: string, width = 160): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0.1;
    video.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      const ratio = video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      canvas.width = width;
      canvas.height = width / ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(undefined);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    video.onerror = () => resolve(undefined);
  });
};
