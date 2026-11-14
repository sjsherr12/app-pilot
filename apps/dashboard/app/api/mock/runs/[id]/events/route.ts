import { ensurePlayback, getRecord, materialize, REPLAY_SPACING_MS, sleep } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/**
 * SSE stream mirroring GET /api/runs/{id}/events: events already "persisted"
 * are replayed quickly, then live events follow at ~300ms spacing. The stream
 * closes once the run reaches a terminal status.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = getRecord(id);
  if (!rec) {
    return new Response(JSON.stringify({ detail: `Run ${id} not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  ensurePlayback(rec);
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stop = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", stop);
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(": connected\n\n");
      let index = 0;
      while (!closed) {
        // Re-materialize every iteration: a Stop request replaces the tail of
        // the event list with a synthetic run.status=stopped event.
        const m = materialize(rec);
        const events = m.events;
        if (index >= events.length) break;
        const ev = events[index];
        if (rec.realistic) {
          // Finished run: replay persisted events quickly.
          await sleep(REPLAY_SPACING_MS);
          if (closed) break;
          send(`data: ${JSON.stringify(ev)}\n\n`);
          index += 1;
          continue;
        }
        const due = (rec.playbackStartedAt ?? 0) + index * m.spacingMs;
        const wait = due - Date.now();
        if (wait > 0) {
          await sleep(Math.min(wait, 1000));
          continue; // loop back so the event is re-read after waking
        }
        send(`data: ${JSON.stringify(ev)}\n\n`);
        index += 1;
      }
      stop();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
