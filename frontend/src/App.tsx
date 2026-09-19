import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Images,
  Plus,
  Trash2,
  LoaderCircle,
  Layers,
} from "lucide-react";
import { api, type Board, type SavedImage } from "./api";
import { UploadDropzone } from "./components/UploadDropzone";
import { SemanticSearch } from "./components/SemanticSearch";

// Remote images can disappear or block embedding; keep the card readable if they fail.
function Photo({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="photo-fallback">
      <Images size={30} />
      <span>Image unavailable</span>
    </div>
  ) : (
    <img
      src={url}
      alt={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default function App() {
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [boards, setBoards] = useState<Board[]>([]);
  const [active, setActive] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    "board" | "image" | "edit" | "delete-board" | "delete-image" | null
  >(null);
  const [editing, setEditing] = useState<SavedImage | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  // Reload from SQLite after a mutation so counts and board contents stay in sync.
  async function refresh(boardId?: number) {
    const [list, detail] = await Promise.all([
      api<Board[]>("/boards"),
      boardId ? api<Board>(`/boards/${boardId}`) : Promise.resolve(null),
    ]);
    setBoards(list);
    setLibraryVersion((value) => value + 1);
    setActive(detail);
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Only poll a board while it has unfinished indexing jobs. The guard prevents
  // a late response from replacing a different board after navigation.
  const activeId = active?.id;
  const hasPending = active?.images?.some(
    (image) => image.index_status === "pending",
  );
  useEffect(() => {
    if (!activeId || !hasPending) return;
    let mounted = true;
    const timer = window.setInterval(() => {
      api<Board>(`/boards/${activeId}`)
        .then((board) => {
          if (mounted)
            setActive((current) =>
              current?.id === activeId ? board : current,
            );
        })
        .catch(() => {});
    }, 2500);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeId, hasPending]);

  // One dialog handles create/edit/delete; reset its fields each time it opens.
  function openDialog(type: typeof dialog, image?: SavedImage) {
    setError("");
    setTitle(image?.title || "");
    setDescription(image?.notes || "");
    setUrl("");
    setEditing(image || null);
    setDialog(type);
  }
  async function visit(board: Pick<Board, "id">) {
    setLoading(true);
    setError("");
    try {
      setActive(await api<Board>(`/boards/${board.id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // Wait for the API before closing the form. Errors leave the entered values intact.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let boardId = active?.id;
      if (dialog === "board") {
        const board = await api<Board>("/boards", "POST", {
          title,
          description,
        });
        boardId = board.id;
      } else if (dialog === "image" && active) {
        await api(`/boards/${active.id}/images`, "POST", {
          title,
          url,
          notes: description,
        });
      } else if (dialog === "edit" && active && editing) {
        await api(`/boards/${active.id}/images/${editing.id}`, "PATCH", {
          title,
          notes: description,
        });
      } else if (dialog === "delete-image" && active && editing) {
        await api(`/boards/${active.id}/images/${editing.id}`, "DELETE");
      } else if (dialog === "delete-board" && active) {
        await api(`/boards/${active.id}`, "DELETE");
        boardId = undefined;
      }
      setDialog(null);
      await refresh(boardId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = boards.reduce((sum, b) => sum + (b.image_count || 0), 0);
  const deleting = dialog === "delete-board" || dialog === "delete-image";
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            <span className="brand-mark">
              <Layers size={18} />
            </span>
            ImageShare
          </a>
          <button
            className="nav-link"
            onClick={() => {
              setActive(null);
              setError("");
            }}
          >
            My boards
          </button>
        </div>
      </header>
      <main>
        <div className="content">
          <SemanticSearch
            libraryVersion={libraryVersion}
            onOpenBoard={(id) => void visit({ id })}
          />
          {error && !dialog && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
              <Button
                variant="ghost"
                onClick={() => {
                  setLoading(true);
                  refresh(active?.id)
                    .then(() => setError(""))
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </Button>
            </Alert>
          )}
          {active ? (
            <>
              <button className="back" onClick={() => setActive(null)}>
                <ArrowLeft size={16} /> All boards
              </button>
              <div className="page-heading">
                <div>
                  <h1>{active.title}</h1>
                  <p>{active.description}</p>
                </div>
                <div className="heading-actions">
                  <Button
                    variant="ghost"
                    aria-label="Delete board"
                    onClick={() => openDialog("delete-board")}
                  >
                    <Trash2 size={18} />
                  </Button>
                  <Button onClick={() => openDialog("image")}>
                    <Plus />
                    Save an image
                  </Button>
                </div>
              </div>
              <UploadDropzone
                key={active.id}
                boardId={active.id}
                onUploaded={async () => {
                  const [list, detail] = await Promise.all([
                    api<Board[]>("/boards"),
                    api<Board>(`/boards/${active.id}`),
                  ]);
                  setBoards(list);
                  setLibraryVersion((value) => value + 1);
                  setActive((current) =>
                    current?.id === active.id ? detail : current,
                  );
                }}
              />
              <div className="section-heading">
                <h2>
                  Images <span>{active.images?.length || 0}</span>
                </h2>
              </div>
              {loading ? (
                <div className="loading">
                  <LoaderCircle
                    className="animate-spin"
                    aria-label="Loading"
                    role="status"
                  />
                </div>
              ) : active.images?.length ? (
                <div className="image-grid">
                  {active.images.map((image) => (
                    <article className="image-card" key={image.id}>
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${image.title}`}
                      >
                        <Photo url={image.url} title={image.title} />
                      </a>
                      <div className="image-copy">
                        <h3>{image.title}</h3>
                        {image.notes && <p>{image.notes}</p>}
                        <div className={`index-status ${image.index_status}`}>
                          {image.index_status === "ready"
                            ? "Searchable"
                            : image.index_status === "pending"
                              ? "Preparing for search…"
                              : "Not searchable"}
                          {image.index_status === "failed" && (
                            <>
                              <p>{image.index_error}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await api(
                                      `/images/${image.id}/reindex`,
                                      "POST",
                                    );
                                    await refresh(active.id);
                                  } catch (error) {
                                    setError((error as Error).message);
                                  }
                                }}
                              >
                                Retry indexing
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="image-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDialog("edit", image)}
                          >
                            Edit details
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${image.title}`}
                            onClick={() => openDialog("delete-image", image)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Images size={24} />
                  </span>
                  <h2>No images yet</h2>
                  <p>Drop images above, choose files, or save an image URL.</p>
                  <Button onClick={() => openDialog("image")}>
                    Save your first image
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>My boards</h1>
                  <p>
                    {boards.length} boards · {total} images
                  </p>
                </div>
                <Button onClick={() => openDialog("board")}>
                  <Plus />
                  Create a board
                </Button>
              </div>
              {loading ? (
                <div className="loading">
                  <LoaderCircle
                    className="animate-spin"
                    aria-label="Loading"
                    role="status"
                  />
                </div>
              ) : (
                <div className="board-grid">
                  {boards.map((board) => (
                    <button
                      className="board-card"
                      key={board.id}
                      onClick={() => visit(board)}
                    >
                      <div className="board-cover">
                        {board.cover ? (
                          <Photo
                            key={board.cover}
                            url={board.cover}
                            title={board.title}
                          />
                        ) : (
                          <div className="cover-placeholder">
                            <Images size={24} />
                            <span>No images</span>
                          </div>
                        )}
                      </div>
                      <div className="board-copy">
                        <h3>{board.title}</h3>
                        <span>
                          {board.image_count}{" "}
                          {board.image_count === 1 ? "image" : "images"}
                        </span>
                      </div>
                      {board.description && <p>{board.description}</p>}
                    </button>
                  ))}
                </div>
              )}
              {!loading && boards.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Layers size={24} />
                  </span>
                  <h2>Create your first board</h2>
                  <p>
                    Organize your images into boards for projects, trips, or
                    anything else.
                  </p>
                  <Button variant="outline" onClick={() => openDialog("board")}>
                    <Plus />
                    New board
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {deleting
                ? "Confirm removal"
                : dialog === "board"
                  ? "Create a board"
                  : dialog === "edit"
                    ? "Edit image details"
                    : "Save an image"}
            </DialogTitle>
            <DialogDescription>
              {deleting
                ? "This action cannot be undone."
                : dialog === "board"
                  ? "Give your board a name and an optional description."
                  : "Add a title and optional notes for this image."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {deleting ? (
              <p className="text-sm">
                {dialog === "delete-board"
                  ? "Delete this board and all its saved images?"
                  : `Remove “${editing?.title}” from this board?`}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">
                    {dialog === "board" ? "Board name" : "Image title"}
                  </Label>
                  <Input
                    id="title"
                    placeholder={
                      dialog === "board" ? "e.g. Travel" : "Image title"
                    }
                    required
                    maxLength={dialog === "board" ? 100 : 150}
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                  />
                </div>
                {dialog === "image" && (
                  <div className="space-y-2">
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      aria-describedby="image-url-help"
                      type="url"
                      required
                      maxLength={2048}
                      placeholder="https://example.com/photo.jpg"
                      value={url}
                      onChange={(e) => setUrl(e.currentTarget.value)}
                    />
                    <p
                      id="image-url-help"
                      className="text-sm text-muted-foreground"
                    >
                      Paste a direct link to an image (http or https).
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    {dialog === "board" ? "Description" : "Notes"}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Optional"
                    value={description}
                    maxLength={dialog === "board" ? 500 : 2000}
                    onChange={(e) => setDescription(e.currentTarget.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
            <Button
              type="submit"
              variant={deleting ? "destructive" : "default"}
              disabled={busy}
            >
              {busy && <LoaderCircle className="animate-spin" />}
              {busy
                ? "Saving…"
                : deleting
                  ? "Remove"
                  : dialog === "board"
                    ? "Create board"
                    : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
