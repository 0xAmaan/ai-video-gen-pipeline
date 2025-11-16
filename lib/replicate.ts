type ReplicateFileObject = {
  url?: string | (() => string);
};

const hasUrl = (value: unknown): value is ReplicateFileObject => {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    (typeof (value as ReplicateFileObject).url === "string" ||
      typeof (value as ReplicateFileObject).url === "function")
  );
};

/**
 * Normalize Replicate responses (string, array, or FileOutput objects) into a direct URL.
 */
export function extractReplicateUrl(
  output: unknown,
  context: string,
): string {
  if (!output) {
    throw new Error(`Replicate output for ${context} was empty.`);
  }

  // Plain string URL
  if (typeof output === "string") {
    return output;
  }

  // FileOutput object with url() method or string url property
  if (hasUrl(output)) {
    const url = output.url;
    if (typeof url === "function") {
      return url();
    }
    if (typeof url === "string") {
      return url;
    }
  }

  // Array of outputs – return first valid entry
  if (Array.isArray(output) && output.length > 0) {
    for (const item of output) {
      try {
        return extractReplicateUrl(item, context);
      } catch {
        continue;
      }
    }
  }

  throw new Error(
    `Unable to extract Replicate URL for ${context}. Output: ${JSON.stringify(output)}`,
  );
}
