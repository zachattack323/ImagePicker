import { useEffect, useRef, useState } from "react";
import { Search, LoaderCircle, X } from "lucide-react";
import { api, type SavedImage } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchImage = SavedImage & { board_title: string; similarity: number };
type Status = { ready: number; pending: number; failed: number };

export function SemanticSearch({
  onOpenBoard,
  libraryVersion,
}: {
  onOpenBoard: (id: number) => void;
  libraryVersion: number;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<SearchImage[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);

  useEffect(() => {
    let mounted = true;
    const update = () =>
      api<Status>("/search/status")
        .then((value) => {
          if (mounted) setStatus(value);
        })
        .catch(() => {});
    void update();
    const timer = window.setInterval(update, 3000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      revision.current++;
    };
  }, []);

  // Discard results after a write so deleted images never remain in the visible list.
  useEffect(() => {
    revision.current++;
    setResults([]);
    setSubmitted("");
    setBusy(false);
    setError("");
  }, [libraryVersion]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    setResults([]);
    setSubmitted(text);
    try {
      const response = await api<{ images: SearchImage[] }>(
        `/search?q=${encodeURIComponent(text)}`,
      );
      if (current === revision.current) setResults(response.images);
    } catch (error) {
      if (current === revision.current) setError((error as Error).message);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  return (
    <section className="search-panel" aria-label="Semantic image search">
      <form onSubmit={search} className="search-form">
        <Search size={19} aria-hidden="true" />
        <Input
          aria-label="Describe an image"
          value={query}
          maxLength={300}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe an image — e.g. a sunset by the water"
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : "Search"}
        </Button>
      </form>
      <p className="search-caption">
        Search the contents of your saved images, across all boards.
        {status && (
          <span>
            {" "}
            {status.ready} searchable
            {status.pending ? ` · ${status.pending} preparing` : ""}
            {status.failed
              ? ` · ${status.failed} couldn't be indexed (open their board to retry)`
              : ""}
          </span>
        )}
      </p>
      {submitted && (
        <div className="search-results">
          <div className="search-results-heading">
            <h2>Results for “{submitted}”</h2>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Close search results"
              onClick={() => {
                revision.current++;
                setSubmitted("");
                setResults([]);
                setBusy(false);
                setError("");
              }}
            >
              <X />
            </Button>
          </div>
          {error ? (
            <p role="alert" className="upload-errors">
              {error}
            </p>
          ) : busy ? (
            <p role="status">Searching images…</p>
          ) : results.length ? (
            <>
              <p className="search-caption">
                Closest visual matches, ordered by relevance. Results may be
                approximate.
              </p>
              <div className="image-grid">
                {results.map((image) => (
                  <button
                    className="board-card"
                    key={image.id}
                    onClick={() => {
                      revision.current++;
                      setSubmitted("");
                      setResults([]);
                      setBusy(false);
                      onOpenBoard(image.board_id);
                    }}
                  >
                    <div className="board-cover">
                      <img
                        src={image.url}
                        alt={image.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="board-copy">
                      <h3>{image.title}</h3>
                    </div>
                    <p>{image.board_title}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>
              No searchable images yet. Upload images to a board and wait for
              indexing, then search again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
