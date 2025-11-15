import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  desktopCapturer,
  session,
  shell,
  systemPreferences,
  protocol,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, ChildProcess } from "node:child_process";
import started from "electron-squirrel-startup";
import ffmpeg from "fluent-ffmpeg";

// Set FFmpeg and FFprobe binary paths with proper resolution
let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

try {
  console.log("[FFmpeg Setup] Is production:", app.isPackaged);

  if (app.isPackaged) {
    // In production, use binaries from the Resources/bin directory
    const resourcesPath = process.resourcesPath;
    ffmpegPath = path.join(resourcesPath, "bin", "ffmpeg");
    ffprobePath = path.join(resourcesPath, "bin", "ffprobe");
    console.log("[FFmpeg Setup] Production mode - using bundled binaries");
  } else {
    // In development, use the npm packages
    const ffmpegStatic = require("ffmpeg-static");
    const ffprobeStatic = require("ffprobe-static");
    ffmpegPath = ffmpegStatic;
    ffprobePath = ffprobeStatic.path;
    console.log("[FFmpeg Setup] Development mode - using npm packages");
  }

  console.log("[FFmpeg Setup] FFmpeg path:", ffmpegPath);
  console.log("[FFmpeg Setup] FFprobe path:", ffprobePath);

  // Verify files exist and set paths
  if (ffmpegPath) {
    const ffmpegExists = fs.existsSync(ffmpegPath);
    console.log("[FFmpeg Setup] FFmpeg exists:", ffmpegExists);
    if (ffmpegExists) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    } else {
      console.error(
        "[FFmpeg Setup] FFmpeg binary not found at path:",
        ffmpegPath,
      );
    }
  } else {
    console.error("[FFmpeg Setup] FFmpeg path is null!");
  }

  if (ffprobePath) {
    const ffprobeExists = fs.existsSync(ffprobePath);
    console.log("[FFmpeg Setup] FFprobe exists:", ffprobeExists);
    if (ffprobeExists) {
      ffmpeg.setFfprobePath(ffprobePath);
    } else {
      console.error(
        "[FFmpeg Setup] FFprobe binary not found at path:",
        ffprobePath,
      );
    }
  } else {
    console.error("[FFmpeg Setup] FFprobe path is null!");
  }
} catch (error) {
  console.error(
    "[FFmpeg Setup] Failed to load ffmpeg-static or ffprobe-static:",
    error,
  );
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Register custom protocol for secure local file access with byte-range support
const registerProtocols = () => {
  protocol.handle("safe-file", async (request) => {
    try {
      const url = request.url.replace("safe-file://", "");
      // Decode each path segment individually (matching the encoding in preload.ts)
      const pathSegments = url.split("/");
      const filePath = pathSegments
        .map((segment) => decodeURIComponent(segment))
        .join("/");

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error("[Protocol] File not found:", filePath);
        return new Response("File not found", { status: 404 });
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const contentType = getContentType(filePath);

      // Check for range header (needed for video seeking)
      const rangeHeader = request.headers.get("range");

      if (rangeHeader) {
        // Parse range header: "bytes=start-end"
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        // Read the specific byte range
        const buffer = Buffer.alloc(chunkSize);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, buffer, 0, chunkSize, start);
        fs.closeSync(fd);

        return new Response(buffer, {
          status: 206, // Partial Content
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": contentType,
          },
        });
      } else {
        // Serve entire file
        const buffer = fs.readFileSync(filePath);

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Length": fileSize.toString(),
            "Accept-Ranges": "bytes",
            "Content-Type": contentType,
          },
        });
      }
    } catch (error) {
      console.error("[Protocol] Error serving file:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
};

// Helper: Get content type from file extension
const getContentType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "application/octet-stream";
};

// Set up Content Security Policy via session headers
// Must be set up before creating windows
const setupCSP = () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDevelopment = process.env.NODE_ENV !== "production";

    // Build CSP based on environment
    const cspDirectives = [
      "default-src 'self' safe-file:",
      isDevelopment
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" // Allow eval in dev for Vite HMR
        : "script-src 'self' 'unsafe-inline'", // No eval in production
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: file: safe-file: blob:",
      "media-src 'self' file: safe-file: blob:",
      "connect-src 'self' ws: wss:",
    ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [cspDirectives.join("; ")],
      },
    });
  });
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Allow file access for local video files and enable file path in drag-and-drop
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      // Enable file path access on File objects (for drag-and-drop)
      enableRemoteModule: false,
      sandbox: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools only in development
  if (process.env.NODE_ENV !== "production") {
    mainWindow.webContents.openDevTools();
  }

  // Prevent navigation when files are dropped
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  // Setup display media request handler for screen recording
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer.getSources({ types: ["screen", "window"] }).then(
        (sources) => {
          // Grant access to the first screen found
          callback({ video: sources[0], audio: "loopback" });
        },
        (error) => {
          console.error("Error getting desktop sources:", error);
          callback({});
        },
      );
    },
    { useSystemPicker: true },
  );
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerProtocols();
  setupCSP();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// ============================================================================
// IPC Handlers
// ============================================================================

// Handler: Open file picker
ipcMain.handle("open-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "webm", "avi", "mkv"] },
    ],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

// Handler: Save file dialog (for export)
ipcMain.handle("save-file", async (event, defaultPath: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "webm", "avi", "mkv"] },
    ],
  });

  if (result.canceled) return null;
  return result.filePath;
});

// Handler: Get video metadata
ipcMain.handle("get-video-metadata", async (event, filePath: string) => {
  return new Promise((resolve, reject) => {
    console.log("[get-video-metadata] Called with file:", filePath);
    console.log("[get-video-metadata] File exists:", fs.existsSync(filePath));
    console.log("[get-video-metadata] ffprobePath configured:", ffprobePath);

    // For WebM files, we need to probe more thoroughly
    const probeOptions = ["-v", "error", "-show_format", "-show_streams"];

    ffmpeg.ffprobe(filePath, probeOptions, (err, metadata) => {
      if (err) {
        console.error("[get-video-metadata] FFprobe error:", err);
        console.error("[get-video-metadata] Error details:", {
          message: err.message,
          stack: err.stack,
          code: (err as any).code,
        });
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
      );
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      // Parse frame rate (can be "30/1" format)
      let fps = 30; // Default
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
        fps = num / den;
      }

      // Try multiple sources for duration, as WebM files can be tricky
      let duration = 0;

      // First try format duration
      if (metadata.format.duration && metadata.format.duration > 0) {
        duration = metadata.format.duration;
      }
      // Then try stream duration
      else if (videoStream.duration && videoStream.duration > 0) {
        duration = videoStream.duration;
      }
      // Calculate from nb_frames if available
      else if (videoStream.nb_frames && fps > 0) {
        duration = parseInt(videoStream.nb_frames) / fps;
      }

      resolve({
        duration,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps,
        codec: videoStream.codec_name,
      });
    });
  });
});

// Handler: Trim video
ipcMain.handle(
  "trim-video",
  async (event, input: string, output: string, start: number, end: number) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .setStartTime(start)
        .setDuration(end - start)
        .outputOptions("-c copy") // Copy codec for fast trim
        .output(output)
        .on("progress", (progress) => {
          const percent = progress.percent || 0;
          // Send progress updates to renderer
          if (mainWindow) {
            mainWindow.webContents.send("export-progress", percent);
          }
        })
        .on("end", () => {
          resolve(output);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });
  },
);

// Handler: Export multiple clips (concat)
ipcMain.handle(
  "export-multi-clip",
  async (
    event,
    clips: Array<{
      sourceFilePath: string;
      sourceStart: number;
      sourceEnd: number;
    }>,
    outputPath: string,
    options: { mode: "fast" | "reencode"; resolution?: string },
  ) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];

    return new Promise(async (resolve, reject) => {
      try {
        // Create temp directory for intermediate files
        const tempDir = path.join(
          app.getPath("temp"),
          `clipforge-${Date.now()}`,
        );
        fs.mkdirSync(tempDir, { recursive: true });

        // Step 1: Trim all clips individually
        const trimmedClipPaths: string[] = [];

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const trimmedPath = path.join(tempDir, `clip_${i}.mp4`);

          await new Promise((resolveTrim, rejectTrim) => {
            const command = ffmpeg(clip.sourceFilePath)
              .setStartTime(clip.sourceStart)
              .setDuration(clip.sourceEnd - clip.sourceStart);

            // For fast mode, we need to re-encode to ensure compatibility
            // when mixing different formats (MOV + MP4)
            // Use a fast preset to minimize encode time
            if (options.mode === "fast") {
              command
                .outputOptions("-c:v libx264")
                .outputOptions("-preset ultrafast") // Fastest encoding
                .outputOptions("-crf 23")
                .outputOptions("-c:a aac")
                .outputOptions("-b:a 192k")
                .outputOptions("-movflags +faststart");
            } else {
              // Re-encode mode: use better quality settings
              command
                .outputOptions("-c:v libx264")
                .outputOptions("-preset medium")
                .outputOptions("-crf 23")
                .outputOptions("-c:a aac")
                .outputOptions("-b:a 192k")
                .outputOptions("-movflags +faststart");
            }

            command
              .output(trimmedPath)
              .on("progress", (progress) => {
                const clipProgress = (i / clips.length) * 50; // 0-50%
                const totalProgress =
                  clipProgress + (progress.percent || 0) / clips.length / 2;
                if (mainWindow) {
                  mainWindow.webContents.send(
                    "export-progress",
                    totalProgress,
                    `Processing clip ${i + 1}/${clips.length}...`,
                  );
                }
              })
              .on("end", () => {
                trimmedClipPaths.push(trimmedPath);
                resolveTrim(trimmedPath);
              })
              .on("error", rejectTrim)
              .run();
          });
        }

        // Step 2: Create concat file list
        const concatFilePath = path.join(tempDir, "concat.txt");
        const concatContent = trimmedClipPaths
          .map((p) => `file '${p}'`)
          .join("\n");
        fs.writeFileSync(concatFilePath, concatContent);

        // Step 3: Concatenate all clips

        if (mainWindow) {
          mainWindow.webContents.send(
            "export-progress",
            50,
            "Concatenating clips...",
          );
        }

        const command = ffmpeg()
          .input(concatFilePath)
          .inputOptions(["-f concat", "-safe 0"]);

        // Check if we need to scale (re-encode mode with resolution)
        const needsScaling =
          options.mode === "reencode" &&
          options.resolution &&
          options.resolution !== "source";

        if (needsScaling) {
          // Re-encode with scaling
          const resolutionMap: Record<string, string> = {
            "720p": "1280:720",
            "1080p": "1920:1080",
          };
          const scale = resolutionMap[options.resolution!];
          if (scale) {
            command
              .outputOptions("-c:v libx264")
              .outputOptions("-preset medium")
              .outputOptions("-crf 23")
              .outputOptions("-c:a aac")
              .outputOptions("-b:a 192k")
              .outputOptions(`-vf scale=${scale}`)
              .outputOptions("-movflags +faststart");
          }
        } else {
          // All clips are already in the same format, just copy
          command
            .outputOptions("-c copy")
            .outputOptions("-movflags +faststart");
        }

        command
          .output(outputPath)
          .on("progress", (progress) => {
            const percent = 50 + (progress.percent || 0) / 2; // 50-100%
            if (mainWindow) {
              mainWindow.webContents.send(
                "export-progress",
                percent,
                "Finalizing export...",
              );
            }
          })
          .on("end", () => {
            // Clean up temp files
            fs.rmSync(tempDir, { recursive: true, force: true });
            resolve(outputPath);
          })
          .on("error", (err) => {
            console.error("FFmpeg concat error:", err);
            // Clean up temp files
            fs.rmSync(tempDir, { recursive: true, force: true });
            reject(err);
          })
          .run();
      } catch (error) {
        console.error("Export error:", error);
        reject(error);
      }
    });
  },
);

// Handler: Check screen recording permission status
ipcMain.handle("check-screen-recording-permission", async () => {
  try {
    // Check permission status using systemPreferences (macOS only)
    if (process.platform === "darwin") {
      const status = systemPreferences.getMediaAccessStatus("screen");

      return {
        status,
        platform: "darwin",
        granted: status === "granted",
        isDevelopment: process.env.NODE_ENV !== "production",
        executablePath: process.execPath,
      };
    } else {
      // On non-macOS platforms, screen recording doesn't require special permissions
      return {
        status: "not-applicable",
        platform: process.platform,
        granted: true,
        isDevelopment: process.env.NODE_ENV !== "production",
      };
    }
  } catch (error) {
    console.error("[Permission Check] Error checking permission:", error);
    throw error;
  }
});

// Handler: Check camera permission status
ipcMain.handle("check-camera-permission", async () => {
  try {
    if (process.platform === "darwin") {
      const status = systemPreferences.getMediaAccessStatus("camera");
      console.log("[Camera Permission] Status:", status);

      return {
        status: status,
        platform: "darwin",
        granted: status === "granted",
        isDevelopment: process.env.NODE_ENV !== "production",
      };
    } else {
      // On non-macOS platforms, assume granted (browser handles it)
      return {
        status: "not-applicable",
        platform: process.platform,
        granted: true,
        isDevelopment: process.env.NODE_ENV !== "production",
      };
    }
  } catch (error) {
    console.error("[Camera Permission] Error checking permission:", error);
    throw error;
  }
});

// Handler: Request camera permission (macOS)
ipcMain.handle("request-camera-permission", async () => {
  try {
    if (process.platform === "darwin") {
      console.log("[Camera Permission] Requesting access...");
      const granted = await systemPreferences.askForMediaAccess("camera");
      console.log("[Camera Permission] Request result:", granted);

      return {
        granted: granted,
        platform: "darwin",
      };
    } else {
      // On non-macOS, browser will handle permission prompts
      return {
        granted: true,
        platform: process.platform,
      };
    }
  } catch (error) {
    console.error("[Camera Permission] Error requesting permission:", error);
    throw error;
  }
});

// Handler: Get available screen sources for recording
ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 150, height: 150 },
    });

    if (sources.length === 0) {
      throw new Error(
        "PERMISSION_DENIED: No screen sources available. Screen recording permission may be required.",
      );
    }

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith("screen:") ? "screen" : "window",
    }));
  } catch (error) {
    console.error("[Screen Sources] Error:", error);

    // Provide user-friendly error message
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get sources";

    // Always prefix with PERMISSION_DENIED so renderer knows how to handle it
    if (errorMessage.startsWith("PERMISSION_DENIED:")) {
      throw new Error(errorMessage);
    }

    throw new Error(`PERMISSION_DENIED: ${errorMessage}`);
  }
});

// Handler: Save recording to file
ipcMain.handle(
  "save-recording",
  async (event, buffer: ArrayBuffer, filename: string) => {
    try {
      // Use the user's Videos folder for recordings
      const videosPath = app.getPath("videos") || app.getPath("documents");
      const outputPath = path.join(videosPath, filename);

      // Write the buffer to file
      await fs.promises.writeFile(outputPath, Buffer.from(buffer));

      return outputPath;
    } catch (error) {
      console.error("Error saving recording:", error);
      throw error;
    }
  },
);

// Handler: Convert WebM to MOV using FFmpeg
ipcMain.handle("convert-webm-to-mov", async (event, webmPath: string) => {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("FFmpeg not available for conversion"));
      return;
    }

    const movPath = webmPath.replace(/\.webm$/, ".mov");

    console.log("[FFmpeg] Converting WebM to MOV:", webmPath, "->", movPath);

    ffmpeg(webmPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-movflags", "+faststart"])
      .output(movPath)
      .on("end", () => {
        console.log("[FFmpeg] Conversion complete:", movPath);
        // Delete the original webm file
        fs.promises.unlink(webmPath).catch((err) => {
          console.warn("[FFmpeg] Could not delete temp webm:", err);
        });
        resolve(movPath);
      })
      .on("error", (err) => {
        console.error("[FFmpeg] Conversion error:", err);
        reject(err);
      })
      .run();
  });
});

// Handler: Overlay webcam on screen recording (PiP in bottom-right)
ipcMain.handle(
  "overlay-webcam-on-screen",
  async (
    event,
    screenPath: string,
    webcamPath: string,
    offsetSeconds: number = 0,
  ) => {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) {
        reject(new Error("FFmpeg not available for overlay"));
        return;
      }

      const outputPath = screenPath.replace(/\.mov$/, "_with_webcam.mov");

      console.log("[FFmpeg] 🎬 Overlaying webcam on screen:");
      console.log(`[FFmpeg]   Screen: ${screenPath}`);
      console.log(`[FFmpeg]   Webcam: ${webcamPath}`);
      console.log(`[FFmpeg]   Output: ${outputPath}`);
      console.log(`[FFmpeg]   Offset: ${offsetSeconds.toFixed(3)}s`);

      // Fix framerate mismatch between screen (60fps) and webcam (30fps)
      console.log("[FFmpeg] 🔧 Fixing framerate mismatch and syncing streams");

      const command = ffmpeg(screenPath)
        .input(webcamPath)
        .complexFilter([
          // Scale webcam and set to 60fps to match screen
          "[1:v]scale=320:240,fps=60[pip]",
          "[0:v][pip]overlay=W-w-20:H-h-20",
        ])
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-movflags",
          "+faststart",
          // Ensure we use the shortest stream duration to avoid black frames
          "-shortest",
        ])
        .output(outputPath);

      let ffmpegStderr = "";

      command
        .on("start", (commandLine) => {
          console.log("[FFmpeg] 🚀 Spawned FFmpeg command:");
          console.log(`[FFmpeg] ${commandLine}`);
          console.log(
            `[FFmpeg] 🔍 WATCH THE COMMAND ABOVE - Check the filter_complex parameter!`,
          );
        })
        .on("stderr", (stderrLine) => {
          ffmpegStderr += stderrLine + "\n";
          // Log every line to see what FFmpeg is actually doing
          console.log(`[FFmpeg stderr] ${stderrLine}`);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(
              `[FFmpeg] ⏳ Progress: ${progress.percent.toFixed(1)}%`,
            );
          }
        })
        .on("end", () => {
          console.log("[FFmpeg] ✅ Overlay complete:", outputPath);
          console.log("[FFmpeg] 📋 Full FFmpeg stderr output:");
          console.log(ffmpegStderr);
          // Delete temp webcam file
          fs.promises.unlink(webcamPath).catch((err) => {
            console.warn("[FFmpeg] ⚠️  Could not delete temp webcam:", err);
          });
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("[FFmpeg] ❌ Overlay error:", err);
          console.error("[FFmpeg] 📋 FFmpeg stderr before error:");
          console.error(ffmpegStderr);
          reject(err);
        })
        .run();
    });
  },
);

// screencapture recording process reference
let screencaptureRecordingProcess: ChildProcess | null = null;

// Helper: Parse FFmpeg exit codes and provide meaningful error messages
const parseFFmpegExitCode = (
  code: number | null,
  errorOutput: string,
): string => {
  // Check for specific error patterns in output
  if (errorOutput.includes("denied") || errorOutput.includes("permission")) {
    return "FFmpeg recording failed: Screen recording permission denied. Please grant permission in System Settings > Privacy & Security > Screen Recording.";
  }

  if (
    errorOutput.includes("Unsupported pixel format") ||
    errorOutput.includes("Incompatible pixel format")
  ) {
    return "FFmpeg recording failed: Incompatible pixel format. This is a configuration error.";
  }

  if (
    errorOutput.includes("No such device") ||
    errorOutput.includes("device not found")
  ) {
    return "FFmpeg recording failed: Display or audio device not found.";
  }

  if (errorOutput.includes("Input/output error")) {
    return "FFmpeg recording failed: I/O error accessing the display or audio device.";
  }

  // Generic exit code messages
  if (code === null) {
    return `FFmpeg recording failed to start within timeout. Error: ${errorOutput.slice(-300)}`;
  }

  if (code === 1) {
    return `FFmpeg recording failed with error code 1 (general error). Check permissions and device availability. Error: ${errorOutput.slice(-300)}`;
  }

  if (code === 255) {
    return `FFmpeg recording failed with error code 255. This usually indicates a configuration or compatibility issue. Error: ${errorOutput.slice(-300)}`;
  }

  return `FFmpeg recording failed with exit code ${code}. Error: ${errorOutput.slice(-300)}`;
};

// Handler: List available audio devices for debugging
ipcMain.handle("list-audio-devices", async () => {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("FFmpeg not available"));
      return;
    }

    console.log("[Audio Devices] Listing available audio devices...");

    // List AVFoundation devices
    const listProcess = spawn(ffmpegPath, [
      "-f",
      "avfoundation",
      "-list_devices",
      "true",
      "-i",
      "",
    ]);

    let stderrOutput = "";

    listProcess.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    listProcess.on("close", () => {
      console.log("[Audio Devices] Available devices:");
      console.log(stderrOutput);
      resolve(stderrOutput);
    });

    listProcess.on("error", (error) => {
      console.error("[Audio Devices] Error listing devices:", error);
      reject(error);
    });
  });
});

// Handler: Get available displays for screencapture
ipcMain.handle("get-avfoundation-displays", async () => {
  return new Promise((resolve, reject) => {
    // screencapture doesn't have a built-in list command, so we'll query system displays
    // Using system_profiler to get display information
    const process = spawn("system_profiler", ["SPDisplaysDataType", "-json"]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        console.error("[screencapture] Error listing displays:", stderr);
        // Fallback to default displays
        const defaultDisplays = [
          { id: "1", name: "Main Display", type: "screen" },
          { id: "2", name: "Display 2", type: "screen" },
        ];
        resolve(defaultDisplays);
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const displays: Array<{ id: string; name: string; type: string }> = [];

        // Parse display information
        if (data.SPDisplaysDataType && Array.isArray(data.SPDisplaysDataType)) {
          data.SPDisplaysDataType.forEach((gpu: any, gpuIndex: number) => {
            if (gpu.spdisplays_ndrvs && Array.isArray(gpu.spdisplays_ndrvs)) {
              gpu.spdisplays_ndrvs.forEach(
                (display: any, displayIndex: number) => {
                  const displayNumber = displays.length + 1;
                  displays.push({
                    id: displayNumber.toString(),
                    name: display._name || `Display ${displayNumber}`,
                    type: "screen",
                  });
                },
              );
            }
          });
        }

        if (displays.length === 0) {
          // If no displays found, provide defaults
          displays.push({ id: "1", name: "Main Display", type: "screen" });
        }

        resolve(displays);
      } catch (error) {
        console.error("[screencapture] Error parsing display data:", error);
        // Fallback to default
        resolve([{ id: "1", name: "Main Display", type: "screen" }]);
      }
    });

    process.on("error", (error) => {
      console.error("[screencapture] Error listing displays:", error);
      reject(error);
    });
  });
});

// Audio recording process reference
let audioRecordingProcess: ChildProcess | null = null;
let tempAudioPath: string | null = null;

// Helper: Attempt to start screencapture recording
const attemptRecording = (
  displayId: string,
  outputPath: string,
  withAudio: boolean,
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    // screencapture command for video recording (NO audio - we'll handle that separately)
    const args = [
      "-v", // Video recording mode (continuous until killed)
      "-x", // Do not play sounds (prevents interactive prompt blocking)
      "-D", // Specify display
      displayId,
      outputPath,
    ];

    screencaptureRecordingProcess = spawn("screencapture", args);

    let started = false;
    let errorOutput = "";

    screencaptureRecordingProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      errorOutput += output;
    });

    screencaptureRecordingProcess.on("error", (error) => {
      console.error("[screencapture] Process error:", error);
      screencaptureRecordingProcess = null;
      if (!started) {
        reject(error);
      }
    });

    screencaptureRecordingProcess.on("close", (code) => {
      if (code !== 0 && code !== null) {
        const errorMessage = `screencapture failed with exit code ${code}. ${errorOutput ? "Error: " + errorOutput : ""}`;
        console.error(`[screencapture] ${errorMessage}`);
      }

      screencaptureRecordingProcess = null;

      // If process exits before recording started, reject
      if (!started && code !== 0) {
        reject(new Error(errorOutput || "screencapture failed to start"));
      }
    });

    // If audio is requested, start separate audio recording with ffmpeg
    let shouldRecordAudio = !!(withAudio && ffmpegPath);

    if (shouldRecordAudio) {
      // Check microphone permission on macOS
      if (process.platform === "darwin") {
        const micStatus = systemPreferences.getMediaAccessStatus("microphone");
        console.log("[Audio] Microphone permission status:", micStatus);

        if (micStatus !== "granted") {
          console.log("[Audio] Requesting microphone permission...");
          const granted =
            await systemPreferences.askForMediaAccess("microphone");
          console.log("[Audio] Microphone permission granted:", granted);

          if (!granted) {
            console.error(
              "[Audio] Microphone permission denied - will record without audio",
            );
            shouldRecordAudio = false; // Disable audio recording but continue with video
          }
        }
      }
    }

    if (shouldRecordAudio && ffmpegPath) {
      const audioDir = path.dirname(outputPath);
      const audioFilename = `temp_audio_${Date.now()}.wav`;
      tempAudioPath = path.join(audioDir, audioFilename);

      console.log(
        "[Audio] Starting microphone capture with ffmpeg:",
        tempAudioPath,
      );
      console.log("[Audio] FFmpeg path:", ffmpegPath);
      console.log("[Audio] Is packaged:", app.isPackaged);

      // Use ffmpeg to capture audio from default microphone
      // -f avfoundation: use AVFoundation (macOS)
      // -i ":0": audio device 0 (default microphone)
      const ffmpegArgs = [
        "-f",
        "avfoundation",
        "-i",
        ":0", // ":0" means audio device 0 (default microphone)
        "-acodec",
        "pcm_s16le", // Uncompressed audio for later merging
        "-y", // Overwrite if exists
        tempAudioPath,
      ];

      console.log("[Audio] FFmpeg command:", ffmpegPath, ffmpegArgs.join(" "));

      audioRecordingProcess = spawn(ffmpegPath, ffmpegArgs);

      let stderrOutput = "";

      audioRecordingProcess.stdout?.on("data", (data) => {
        console.log("[Audio] FFmpeg stdout:", data.toString());
      });

      audioRecordingProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        stderrOutput += output;
        console.log("[Audio] FFmpeg stderr:", output);
      });

      audioRecordingProcess.on("error", (error) => {
        console.error("[Audio] FFmpeg process error:", error);
        audioRecordingProcess = null;
      });

      audioRecordingProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          console.error(
            "[Audio] FFmpeg audio recording exited with code:",
            code,
          );
          console.error("[Audio] Full stderr output:", stderrOutput);
        }
      });
    }

    // screencapture doesn't create the file until recording stops
    // We validate by checking if the process is still running
    setTimeout(() => {
      // Check if the process is still running (not exited with error)
      if (
        screencaptureRecordingProcess &&
        !screencaptureRecordingProcess.killed
      ) {
        started = true;
        resolve(outputPath); // Return the output path
      } else {
        reject(new Error("Recording process failed to start or exited early"));
      }
    }, 1000); // Check after 1 second
  });
};

// Handler: Start screencapture recording
ipcMain.handle(
  "start-ffmpeg-recording",
  async (event, displayId: string, filename: string) => {
    if (screencaptureRecordingProcess) {
      throw new Error("Recording already in progress");
    }

    // Generate output path in main process (has access to app.getPath)
    const videosPath = app.getPath("videos") || app.getPath("documents");
    const outputPath = path.join(videosPath, filename);

    // Start recording with microphone audio
    try {
      const recordingPath = await attemptRecording(displayId, outputPath, true);
      return recordingPath; // Returns .mov path
    } catch (error: any) {
      console.error(
        "[screencapture] Failed to start recording:",
        error.message,
      );
      throw error;
    }
  },
);

// Handler: Stop screencapture recording
ipcMain.handle("stop-ffmpeg-recording", async () => {
  return new Promise(async (resolve) => {
    if (!screencaptureRecordingProcess) {
      resolve(false);
      return;
    }

    const videoPath = tempAudioPath
      ? tempAudioPath.replace(/temp_audio_\d+\.wav$/, "temp_video.mov")
      : null;

    // Step 1: Stop audio recording first (if running)
    if (audioRecordingProcess && tempAudioPath) {
      console.log("[Audio] Stopping audio recording...");
      audioRecordingProcess.stdin?.write("q"); // Tell ffmpeg to quit gracefully
      audioRecordingProcess.kill("SIGINT");

      // Wait for audio process to finish
      await new Promise<void>((resolveAudio) => {
        const timeout = setTimeout(() => {
          if (audioRecordingProcess) {
            audioRecordingProcess.kill("SIGKILL");
          }
          resolveAudio();
        }, 2000);

        audioRecordingProcess?.on("close", () => {
          clearTimeout(timeout);
          audioRecordingProcess = null;
          console.log("[Audio] Audio recording stopped");
          resolveAudio();
        });
      });
    }

    // Step 2: Stop video recording
    console.log("[Video] Stopping video recording...");
    screencaptureRecordingProcess.kill("SIGINT");

    // Wait for video process to exit
    await new Promise<void>((resolveVideo) => {
      const timeout = setTimeout(() => {
        if (screencaptureRecordingProcess) {
          screencaptureRecordingProcess.kill("SIGKILL");
        }
        screencaptureRecordingProcess = null;
        resolveVideo();
      }, 3000);

      screencaptureRecordingProcess?.on("close", () => {
        clearTimeout(timeout);
        screencaptureRecordingProcess = null;
        console.log("[Video] Video recording stopped");
        resolveVideo();
      });
    });

    // Step 3: If we have audio, merge it with video
    if (tempAudioPath && ffmpegPath) {
      try {
        // The video file path was returned from attemptRecording
        // We need to find it - it should be the last .mov file in the Videos folder
        const videosPath = app.getPath("videos") || app.getPath("documents");
        const files = fs.readdirSync(videosPath);
        const movFiles = files
          .filter((f) => f.endsWith(".mov") && f.startsWith("recording_"))
          .sort()
          .reverse();

        if (movFiles.length > 0) {
          const videoPath = path.join(videosPath, movFiles[0]);
          const mergedPath = videoPath.replace(".mov", "_with_audio.mov");

          console.log("[Merge] Merging video and audio...");
          console.log("[Merge] Video:", videoPath);
          console.log("[Merge] Audio:", tempAudioPath);
          console.log("[Merge] Output:", mergedPath);

          // Merge video and audio
          await new Promise<void>((resolveMerge, rejectMerge) => {
            const mergeProcess = spawn(ffmpegPath!, [
              "-i",
              videoPath, // Video input
              "-i",
              tempAudioPath!, // Audio input
              "-c:v",
              "copy", // Copy video stream (no re-encoding)
              "-c:a",
              "aac", // Encode audio to AAC
              "-b:a",
              "128k", // Audio bitrate
              "-shortest", // Stop when shortest stream ends
              "-y", // Overwrite output
              mergedPath,
            ]);

            let errorOutput = "";

            mergeProcess.stderr?.on("data", (data) => {
              errorOutput += data.toString();
            });

            mergeProcess.on("error", (error) => {
              console.error("[Merge] Error:", error);
              rejectMerge(error);
            });

            mergeProcess.on("close", (code) => {
              if (code === 0) {
                console.log("[Merge] Successfully merged video and audio");

                // Delete original video (without audio) and temp audio
                fs.unlink(videoPath, (err) => {
                  if (err)
                    console.error(
                      "[Merge] Error deleting original video:",
                      err,
                    );
                });
                fs.unlink(tempAudioPath!, (err) => {
                  if (err)
                    console.error("[Merge] Error deleting temp audio:", err);
                });

                // Rename merged file to original name
                fs.rename(mergedPath, videoPath, (err) => {
                  if (err) {
                    console.error("[Merge] Error renaming merged file:", err);
                    resolveMerge();
                  } else {
                    console.log("[Merge] Merged file renamed to:", videoPath);
                    resolveMerge();
                  }
                });
              } else {
                console.error("[Merge] FFmpeg merge failed with code:", code);
                console.error("[Merge] Error output:", errorOutput);
                rejectMerge(new Error(`Merge failed: ${errorOutput}`));
              }
            });
          });
        }
      } catch (error) {
        console.error("[Merge] Failed to merge audio:", error);
        // Continue anyway - video without audio is better than nothing
      }

      tempAudioPath = null; // Reset
    }

    resolve(true);
  });
});

// Handler: Convert MOV to MP4 using FFmpeg
ipcMain.handle("convert-mov-to-mp4", async (event, movPath: string) => {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("FFmpeg not available for conversion"));
      return;
    }

    // Generate MP4 output path
    const mp4Path = movPath.replace(/\.mov$/, ".mp4");

    // FFmpeg conversion command
    // -c:v copy = copy video stream without re-encoding (fast)
    // -c:a copy = copy audio stream without re-encoding (fast)
    // -movflags faststart = optimize for web playback (moov atom at start)
    const args = [
      "-i",
      movPath,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-movflags",
      "faststart", // Optimize for web streaming
      "-y", // Overwrite output file
      mp4Path,
    ];

    const conversionProcess = spawn(ffmpegPath, args);

    let errorOutput = "";

    conversionProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      errorOutput += output;
      // FFmpeg outputs progress to stderr, which is normal
      if (output.includes("Error") || output.includes("failed")) {
        console.error("[FFmpeg Convert stderr]", output);
      }
    });

    conversionProcess.on("error", (error) => {
      console.error("[FFmpeg Convert] Process error:", error);
      reject(error);
    });

    conversionProcess.on("close", (code) => {
      if (code === 0) {
        // Verify the output file exists
        if (fs.existsSync(mp4Path)) {
          // Delete the original MOV file to save space
          try {
            fs.unlinkSync(movPath);
          } catch (deleteError) {
            console.error("Failed to delete MOV file:", deleteError);
          }

          resolve(mp4Path);
        } else {
          reject(new Error("Conversion completed but output file not found"));
        }
      } else {
        const errorMessage = `FFmpeg conversion failed with exit code ${code}. ${errorOutput}`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    });
  });
});

// Handler: Open system settings for screen recording permissions
ipcMain.handle("open-system-settings", async () => {
  try {
    // Open macOS System Settings to Screen Recording permissions
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    );
  } catch (error) {
    console.error("Error opening system settings:", error);
    throw error;
  }
});

// Handler: Generate video thumbnail
ipcMain.handle("generate-thumbnail", async (event, videoPath: string) => {
  return new Promise((resolve, reject) => {
    // Create thumbnails directory if it doesn't exist
    const thumbsDir = path.join(app.getPath("temp"), "clipforge-thumbs");
    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }

    const thumbnailPath = path.join(thumbsDir, `thumb_${Date.now()}.png`);

    ffmpeg(videoPath)
      .seekInput(1) // Seek to 1 second
      .frames(1) // Extract 1 frame
      .size("320x?") // Width 320, maintain aspect ratio
      .output(thumbnailPath)
      .on("end", () => {
        resolve(thumbnailPath);
      })
      .on("error", (err) => {
        console.error("Thumbnail generation error:", err);
        reject(err);
      })
      .run();
  });
});

/**
 * Generate a consistent hash from a file path for thumbnail caching
 * This ensures thumbnails are reused for the same video file
 */
const getFileHash = (filePath: string): string => {
  return Buffer.from(filePath)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 40);
};

// Handler: Generate multiple thumbnails for timeline clip preview
ipcMain.handle(
  "generate-clip-thumbnails",
  async (
    event,
    videoPath: string,
    clipId: string,
    sourceStart: number,
    sourceEnd: number,
    frameInterval: number = 1.0,
  ) => {
    try {
      // Create thumbnails directory if it doesn't exist
      const thumbsDir = path.join(app.getPath("temp"), "clipforge-thumbs");
      if (!fs.existsSync(thumbsDir)) {
        fs.mkdirSync(thumbsDir, { recursive: true });
      }

      // Calculate timestamps for frame extraction
      const timestamps: number[] = [];
      for (let time = sourceStart; time < sourceEnd; time += frameInterval) {
        timestamps.push(time);
      }
      // Always include the last frame (but clamp to 0.1s before end to avoid edge cases)
      const lastFrameTime = Math.max(sourceStart, sourceEnd - 0.1);
      if (
        timestamps.length === 0 ||
        timestamps[timestamps.length - 1] < lastFrameTime - 0.5
      ) {
        timestamps.push(lastFrameTime);
      }

      // Generate file hash for consistent caching across clip instances
      const fileHash = getFileHash(videoPath);

      // Generate thumbnails for each timestamp
      const thumbnails: Array<{ timestamp: number; path: string }> = [];

      for (const timestamp of timestamps) {
        const thumbnailPath = path.join(
          thumbsDir,
          `clip_${fileHash}_frame_${timestamp.toFixed(2)}.png`,
        );

        // Check if thumbnail already exists (caching)
        if (fs.existsSync(thumbnailPath)) {
          thumbnails.push({ timestamp, path: thumbnailPath });
          continue;
        }

        // Generate new thumbnail
        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp) // Seek to specific timestamp
            .frames(1) // Extract 1 frame
            .size("160x?") // Width 160px, maintain aspect ratio (smaller for performance)
            .output(thumbnailPath)
            .on("end", () => {
              thumbnails.push({ timestamp, path: thumbnailPath });
              resolve();
            })
            .on("error", (err) => {
              console.error(
                `Thumbnail generation error at ${timestamp}s:`,
                err,
              );
              reject(err);
            })
            .run();
        });
      }

      return thumbnails;
    } catch (error) {
      console.error("Error generating clip thumbnails:", error);
      return []; // Return empty array on error (graceful fallback)
    }
  },
);

// Handler: Clean up clip thumbnails
ipcMain.handle("cleanup-clip-thumbnails", async (event, videoPath: string) => {
  try {
    const thumbsDir = path.join(app.getPath("temp"), "clipforge-thumbs");
    if (!fs.existsSync(thumbsDir)) {
      return true;
    }

    // Generate file hash to find thumbnails for this video file
    const fileHash = getFileHash(videoPath);

    // Find all thumbnails for this video file
    const files = await fs.promises.readdir(thumbsDir);
    const clipThumbs = files.filter((file) =>
      file.startsWith(`clip_${fileHash}_`),
    );

    // Delete each thumbnail
    for (const file of clipThumbs) {
      const filePath = path.join(thumbsDir, file);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.error(`Failed to delete thumbnail ${file}:`, err);
      }
    }

    return true;
  } catch (error) {
    console.error("Error cleaning up clip thumbnails:", error);
    return false;
  }
});

// Handler: Get file size
ipcMain.handle("get-file-size", async (event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error("Error getting file size:", error);
    throw error;
  }
});

// Handler: Save media library
ipcMain.handle("save-media-library", async (event, items: any[]) => {
  try {
    const userDataPath = app.getPath("userData");
    const libraryPath = path.join(userDataPath, "media-library.json");

    await fs.promises.writeFile(
      libraryPath,
      JSON.stringify(items, null, 2),
      "utf-8",
    );

    return true;
  } catch (error) {
    console.error("Error saving media library:", error);
    throw error;
  }
});

// Handler: Load media library
ipcMain.handle("load-media-library", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const libraryPath = path.join(userDataPath, "media-library.json");

    // Check if file exists
    if (!fs.existsSync(libraryPath)) {
      return [];
    }

    const data = await fs.promises.readFile(libraryPath, "utf-8");

    // Handle empty file or corrupted JSON
    if (!data || data.trim() === "") {
      console.warn(
        "Media library file is empty, initializing with empty array",
      );
      await fs.promises.writeFile(libraryPath, "[]", "utf-8");
      return [];
    }

    let items;
    try {
      items = JSON.parse(data);
    } catch (parseError) {
      console.error("Corrupted media library file, resetting to empty array");
      await fs.promises.writeFile(libraryPath, "[]", "utf-8");
      return [];
    }

    // Validate that files still exist
    const validItems = [];
    for (const item of items) {
      if (fs.existsSync(item.filePath)) {
        validItems.push(item);
      }
    }

    // Clean up the saved library if any files were skipped
    if (validItems.length < items.length) {
      await fs.promises.writeFile(
        libraryPath,
        JSON.stringify(validItems, null, 2),
        "utf-8",
      );
    }

    return validItems;
  } catch (error) {
    console.error("Error loading media library:", error);
    return [];
  }
});

// Delete a file from disk
ipcMain.handle("delete-file", async (event, filePath: string) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }

    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
});
