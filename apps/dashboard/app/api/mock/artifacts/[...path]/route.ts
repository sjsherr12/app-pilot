import { NextResponse } from "next/server";
import { SHOTS } from "@/lib/mock/fixture";
import { renderShot } from "@/lib/mock/shots";

export const dynamic = "force-dynamic";

// Minimal valid (empty) zip archive: end-of-central-directory record only.
const EMPTY_ZIP = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)]);

/** Serves /artifacts/<run>/shots|videos|traces/<file> for the mock run. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const [, kind, file] = path;
  if (!kind || !file || !/^[\w.-]+$/.test(file)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  if (kind === "shots") {
    const shotId = file.replace(/\.\w+$/, "");
    const info = SHOTS[shotId] ?? { scene: "blank" as const, url: "about:blank" };
    return new Response(renderShot(info.scene, info.url), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
    });
  }
  if (kind === "videos") {
    // Static clip rendered at build time into public/mock/.
    return NextResponse.redirect(new URL(`/mock/${file}`, req.url), 307);
  }
  if (kind === "traces") {
    return new Response(EMPTY_ZIP, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  }
  return NextResponse.json({ detail: "Not found" }, { status: 404 });
}
