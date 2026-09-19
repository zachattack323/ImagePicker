import { useRef, useState } from "react";
import { Upload, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/api";

type Props = { boardId: number; onUploaded: () => Promise<void> };

export function UploadDropzone({ boardId, onUploaded }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function accept(files: File[]) {
    if (locked.current || !files.length) return;
    locked.current = true;
    setErrors([]);
    setMessage("");
    const failures: string[] = [];
    let saved = 0;
    // Upload sequentially so large drops don't overwhelm Flask or the model queue.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      try {
        if (file.size > 15 * 1024 * 1024)
          throw new Error("Must be smaller than 15 MB.");
        await uploadImage(boardId, file);
        saved++;
      } catch (error) {
        failures.push(`${file.name}: ${(error as Error).message}`);
      }
    }
    try {
      await onUploaded();
    } catch {
      failures.push(
        "Uploads finished, but the board could not refresh. Reload the page.",
      );
    }
    setMessage(
      saved
        ? `${saved} ${saved === 1 ? "image saved" : "images saved"}. Search status is shown on each image.`
        : "No images uploaded.",
    );
    setErrors(failures);
    setProgress("");
    locked.current = false;
    if (input.current) input.current.value = "";
  }

  return (
    <section
      className={`upload-zone ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!locked.current) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void accept(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="upload-row">
        {progress ? (
          <LoaderCircle className="animate-spin" size={22} />
        ) : (
          <Upload size={22} />
        )}
        <div>
          <strong>Drop images into this board</strong>
          <p>JPEG, PNG, WebP, or GIF · Up to 15 MB each</p>
        </div>
        <Button
          variant="outline"
          disabled={!!progress}
          onClick={() => input.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={input}
          className="sr-only"
          aria-label="Upload images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(event) =>
            void accept(Array.from(event.target.files || []))
          }
        />
      </div>
      <p className="upload-status" role="status">
        {progress || message}
      </p>
      {!!errors.length && (
        <ul role="alert" className="upload-errors">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
