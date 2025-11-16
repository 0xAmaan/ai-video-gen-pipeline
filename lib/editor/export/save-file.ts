export async function saveBlob(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  if ("showSaveFilePicker" in window) {
    const picker = window.showSaveFilePicker as unknown as (
      options: SaveFilePickerOptions,
    ) => Promise<FileSystemFileHandle>;
    try {
      const handle = await picker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      // Silently fall back to download
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type SaveFilePickerOptions = {
  suggestedName?: string;
};

type FileSystemFileHandle = {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type FileSystemWritableFileStream = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};
