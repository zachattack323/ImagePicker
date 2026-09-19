export type SavedImage = {
  id: number;
  board_id: number;
  url: string;
  title: string;
  notes: string;
  index_status: "pending" | "ready" | "failed";
  index_error: string;
};
export type Board = {
  id: number;
  title: string;
  description: string;
  image_count?: number;
  cover?: string;
  images?: SavedImage[];
};
// Vite forwards these relative URLs to Flask; components never need the server address.
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error ||
        "Could not reach ImageShare. Check that the backend is running.",
    );
  }
  // DELETE returns 204 with no body, so calling response.json() would fail.
  return response.status === 204 ? (undefined as T) : response.json();
}

// Let the browser set multipart boundaries; a JSON Content-Type would break files.
export async function uploadImage(
  boardId: number,
  file: File,
): Promise<SavedImage> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`/api/boards/${boardId}/uploads`, {
    method: "POST",
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Upload failed. Try again.");
  return data;
}
