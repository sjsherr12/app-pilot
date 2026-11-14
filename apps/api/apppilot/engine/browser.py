"""Deterministic browser engine: isolated Playwright sessions, ref-based observation, action log, evidence.

One BrowserSessionManager per run. Each logical session (e.g. "explore", "verify") owns one
BrowserContext at a time; `reset()` closes it (saving video and trace) and opens a brand new
context with a fresh server-side tenant, which is what makes verification independent.
"""

from __future__ import annotations

import asyncio
import base64
import inspect
import logging
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable
from urllib.parse import urljoin, urlsplit

import httpx
from playwright.async_api import (
    Browser,
    BrowserContext,
    Dialog,
    Page,
    Playwright,
    Request,
    Response,
    Route,
    async_playwright,
)
from playwright.async_api import TimeoutError as PWTimeout

from apppilot.models import ActionRecord, ResetHook, now_iso

log = logging.getLogger(__name__)

SNAPSHOT_JS = Path(__file__).with_name("snapshot.js").read_text()
VIEWPORT = {"width": 1280, "height": 800}
REF_RE = re.compile(r"e\d+")


class BudgetExhausted(Exception):
    pass


class StaleRef(Exception):
    pass


def origin_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}".lower()


async def _maybe_await(result: Any) -> Any:
    if inspect.isawaitable(result):
        return await result
    return result


@dataclass
class Session:
    id: str
    generation: int
    tenant: str
    context: BrowserContext
    page: Page
    video_dir: Path
    tracing: bool
    action_log: list[ActionRecord] = field(default_factory=list)
    console_errors: list[dict[str, Any]] = field(default_factory=list)
    failed_requests: list[dict[str, Any]] = field(default_factory=list)
    dialogs: list[str] = field(default_factory=list)
    reported_console: int = 0
    reported_requests: int = 0
    actions: int = 0
    last_elements: dict[str, dict[str, Any]] = field(default_factory=dict)
    reset_hook_status: int | None = None

    @property
    def ref(self) -> str:
        return f"{self.id}-{self.generation}"


@dataclass
class Snapshot:
    text: str
    shot_id: str
    url: str
    title: str


OnAction = Callable[[Session, ActionRecord], Any]
OnSessionClosed = Callable[[str, str | None, str | None], Any]


class BrowserSessionManager:
    def __init__(
        self,
        *,
        run_id: str,
        run_dir: Path,
        app_url: str,
        reset_hook: ResetHook | None = None,
        headless: bool = True,
        max_actions: int = 150,
        on_action: OnAction | None = None,
        on_session_closed: OnSessionClosed | None = None,
    ):
        self.run_id = run_id
        self.run_dir = run_dir
        self.app_url = app_url.rstrip("/")
        self.origin = origin_of(self.app_url)
        self.reset_hook = reset_hook or ResetHook()
        self.headless = headless
        self.max_actions = max_actions
        self.on_action = on_action
        self.on_session_closed = on_session_closed
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self.sessions: dict[str, Session] = {}
        self._generations: dict[str, int] = {}
        self._shot_seq = 0
        self._lock = asyncio.Lock()
        for sub in ("shots", "video", "traces"):
            (run_dir / sub).mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ lifecycle
    async def start(self) -> None:
        if self._browser:
            return
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=self.headless)

    async def close(self) -> None:
        for sid in list(self.sessions):
            try:
                await self.close_session(sid)
            except Exception:  # noqa: BLE001
                log.exception("closing session %s", sid)
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._pw:
            await self._pw.stop()
            self._pw = None

    async def get(self, session_id: str) -> Session:
        async with self._lock:
            s = self.sessions.get(session_id)
            if s is None:
                s = await self._open(session_id)
            return s

    async def reset(self, session_id: str) -> Session:
        async with self._lock:
            await self.close_session(session_id)
            return await self._open(session_id)

    async def _open(self, session_id: str) -> Session:
        await self.start()
        assert self._browser
        gen = self._generations.get(session_id, 0) + 1
        self._generations[session_id] = gen
        tenant = f"{self.run_id}-{session_id}-{gen}"
        video_dir = self.run_dir / "video" / f"{session_id}-{gen}"
        video_dir.mkdir(parents=True, exist_ok=True)
        context = await self._browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=str(video_dir),
            record_video_size=VIEWPORT,
            ignore_https_errors=True,
        )
        await context.add_cookies(
            [{"name": self.reset_hook.tenant_cookie, "value": tenant, "url": self.app_url + "/"}]
        )
        await context.route("**/*", self._guard)
        tracing = session_id.startswith("verify")
        if tracing:
            await context.tracing.start(screenshots=True, snapshots=True, sources=False)
        page = await context.new_page()
        session = Session(
            id=session_id, generation=gen, tenant=tenant, context=context, page=page, video_dir=video_dir, tracing=tracing
        )
        self._wire(session, page)
        context.on("page", lambda p: self._adopt_page(session, p))
        self.sessions[session_id] = session
        session.reset_hook_status = await self._call_reset_hook(tenant)
        return session

    async def _call_reset_hook(self, tenant: str) -> int | None:
        url = self.reset_hook.reset_url_template.format(app_url=self.app_url, tenant=tenant)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(url)
                return r.status_code
        except Exception as e:  # noqa: BLE001
            log.warning("reset hook %s failed: %s", url, e)
            return None

    async def close_session(self, session_id: str) -> None:
        s = self.sessions.pop(session_id, None)
        if s is None:
            return
        trace_rel: str | None = None
        if s.tracing:
            try:
                path = self.run_dir / "traces" / f"{s.ref}.zip"
                await s.context.tracing.stop(path=str(path))
                trace_rel = f"traces/{s.ref}.zip"
            except Exception:  # noqa: BLE001
                log.exception("tracing.stop failed")
        videos = [p.video for p in s.context.pages if p.video]
        try:
            await s.context.close()
        except Exception:  # noqa: BLE001
            log.exception("context.close failed")
        video_rel: str | None = None
        for v in videos:
            try:
                p = Path(await v.path())
                if p.exists() and video_rel is None:
                    dest = self.run_dir / "video" / f"{s.ref}.webm"
                    p.replace(dest)
                    video_rel = f"video/{s.ref}.webm"
            except Exception:  # noqa: BLE001
                log.exception("video path failed")
        shutil.rmtree(s.video_dir, ignore_errors=True)
        if self.on_session_closed:
            await _maybe_await(self.on_session_closed(s.ref, video_rel, trace_rel))

    # ------------------------------------------------------------------ wiring
    async def _guard(self, route: Route, request: Request) -> None:
        url = request.url
        if request.resource_type == "document" and not url.startswith(("about:", "data:", "blob:")):
            if origin_of(url) != self.origin:
                await route.abort("blockedbyclient")
                return
        await route.continue_()

    def _wire(self, session: Session, page: Page) -> None:
        def on_console(msg):  # type: ignore[no-untyped-def]
            if msg.type in ("error",):
                session.console_errors.append({"ts": now_iso(), "text": msg.text[:500], "url": page.url})

        def on_pageerror(exc):  # type: ignore[no-untyped-def]
            session.console_errors.append({"ts": now_iso(), "text": f"Uncaught exception: {str(exc)[:500]}", "url": page.url})

        def on_requestfailed(req: Request):  # type: ignore[no-untyped-def]
            failure = req.failure or ""
            if "blockedbyclient" in str(failure).lower():
                return
            session.failed_requests.append(
                {"ts": now_iso(), "method": req.method, "url": req.url[:300], "status": None, "failure": str(failure)[:200]}
            )

        def on_response(resp: Response):  # type: ignore[no-untyped-def]
            if resp.status >= 400:
                session.failed_requests.append(
                    {"ts": now_iso(), "method": resp.request.method, "url": resp.url[:300], "status": resp.status, "failure": None}
                )

        async def on_dialog(dialog: Dialog):  # type: ignore[no-untyped-def]
            session.dialogs.append(f"{dialog.type}: {dialog.message}")
            try:
                await dialog.accept()
            except Exception:  # noqa: BLE001
                pass

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)
        page.on("requestfailed", on_requestfailed)
        page.on("response", on_response)
        page.on("dialog", lambda d: asyncio.ensure_future(on_dialog(d)))

    def _adopt_page(self, session: Session, page: Page) -> None:
        session.page = page
        self._wire(session, page)

    # ------------------------------------------------------------------ observation
    async def _screenshot(self, session: Session) -> str:
        self._shot_seq += 1
        shot_id = f"s{self._shot_seq:04d}"
        path = self.run_dir / "shots" / f"{shot_id}.jpg"
        try:
            await session.page.screenshot(path=str(path), type="jpeg", quality=70, timeout=10000)
        except Exception as e:  # noqa: BLE001
            log.warning("screenshot failed: %s", e)
        return shot_id

    async def screenshot_b64(self, session: Session) -> tuple[str, str]:
        shot_id = await self._screenshot(session)
        path = self.run_dir / "shots" / f"{shot_id}.jpg"
        data = path.read_bytes() if path.exists() else b""
        return shot_id, base64.b64encode(data).decode()

    async def _evaluate_snapshot(self, session: Session, max_text: int) -> dict[str, Any]:
        page = session.page
        for attempt in range(3):
            try:
                return await page.evaluate(SNAPSHOT_JS, max_text)
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    raise
                log.debug("snapshot eval retry (%s)", e)
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=5000)
                except PWTimeout:
                    pass
                await page.wait_for_timeout(300)
        raise RuntimeError("unreachable")

    async def snapshot(self, session: Session, *, note: str = "", max_text: int = 4000) -> Snapshot:
        data = await self._evaluate_snapshot(session, max_text)
        shot_id = await self._screenshot(session)
        session.last_elements = {el["ref"]: el for el in data.get("elements", [])}
        text = self._format(session, data, shot_id, note)
        return Snapshot(text=text, shot_id=shot_id, url=data.get("url", session.page.url), title=data.get("title", ""))

    def new_console_errors(self, session: Session) -> list[dict[str, Any]]:
        items = session.console_errors[session.reported_console :]
        session.reported_console = len(session.console_errors)
        return items

    def new_failed_requests(self, session: Session) -> list[dict[str, Any]]:
        items = session.failed_requests[session.reported_requests :]
        session.reported_requests = len(session.failed_requests)
        return items

    def _format(self, session: Session, data: dict[str, Any], shot_id: str, note: str) -> str:
        lines: list[str] = []
        if note:
            lines.append(f"Action result: {note}")
        lines.append(f"URL: {data.get('url')}")
        lines.append(f"Title: {data.get('title')}")
        if data.get("headings"):
            lines.append("Headings: " + " | ".join(data["headings"]))
        if data.get("alerts"):
            lines.append("Status/alert messages: " + " | ".join(data["alerts"]))
        if session.dialogs:
            lines.append("Dialogs auto-accepted: " + " | ".join(session.dialogs[-3:]))
            session.dialogs.clear()
        lines.append("Interactive elements (use the ref in brackets):")
        for el in data.get("elements", []):
            extra = []
            if "value" in el:
                extra.append(f'value="{el["value"]}"')
            if "checked" in el:
                extra.append(f"checked={str(el['checked']).lower()}")
            if el.get("options"):
                extra.append("options=" + "/".join(str(o) for o in el["options"][:8]))
            if el.get("disabled"):
                extra.append("disabled")
            if el.get("href"):
                extra.append(f"href={el['href']}")
            lines.append(f'[{el["ref"]}] {el["role"]} "{el["name"]}"' + (" " + " ".join(extra) if extra else ""))
        lines.append("Visible text:")
        lines.append(data.get("text", ""))
        errs = self.new_console_errors(session)
        if errs:
            lines.append("New console errors: " + " || ".join(e["text"] for e in errs[-5:]))
        fails = self.new_failed_requests(session)
        if fails:
            lines.append(
                "New failed requests: "
                + " || ".join(f"{f['method']} {f['url']} -> {f['status'] or f['failure']}" for f in fails[-5:])
            )
        lines.append(f"Screenshot id: {shot_id}")
        return "\n".join(lines)

    # ------------------------------------------------------------------ actions
    def _check_budget(self, session: Session) -> None:
        session.actions += 1
        if session.actions > self.max_actions:
            raise BudgetExhausted(
                f"Action budget ({self.max_actions}) exhausted for session '{session.id}'. "
                "Stop interacting, summarize what you learned, and return."
            )

    async def _settle(self, page: Page) -> None:
        try:
            await page.wait_for_load_state("load", timeout=8000)
        except PWTimeout:
            pass
        try:
            await page.wait_for_load_state("networkidle", timeout=2500)
        except PWTimeout:
            pass

    def _locator(self, session: Session, ref: str):
        ref = ref.strip()
        if not REF_RE.fullmatch(ref):
            raise StaleRef(f"'{ref}' is not an element ref. Refs look like e12 and come from the latest snapshot.")
        return session.page.locator(f'[data-apx-ref="{ref}"]')

    async def _resolve(self, session: Session, ref: str):
        loc = self._locator(session, ref)
        if await loc.count() != 1:
            raise StaleRef(
                f"{ref} is not on the current page (refs are regenerated after every action). "
                "Call snapshot and use a fresh ref."
            )
        return loc

    async def _record(
        self,
        session: Session,
        kind: str,
        *,
        ref: str | None = None,
        text: str | None = None,
        value: str | None = None,
        url_before: str,
        shot_id: str | None,
    ) -> ActionRecord:
        el = session.last_elements_before.get(ref, {}) if ref else {}
        rec = ActionRecord(
            kind=kind,
            ref=ref,
            role=el.get("role"),
            name=el.get("name"),
            href=el.get("href"),
            text=text,
            value=value,
            url_before=url_before,
            url_after=session.page.url,
            shot_id=shot_id,
        )
        session.action_log.append(rec)
        if self.on_action:
            await _maybe_await(self.on_action(session, rec))
        return rec

    def _remember_elements(self, session: Session) -> None:
        # Keep the element map from before the action so the log describes what was clicked.
        session.last_elements_before = dict(session.last_elements)  # type: ignore[attr-defined]

    async def navigate(self, session: Session, url: str) -> Snapshot:
        self._check_budget(session)
        target = urljoin(self.app_url + "/", url.strip())
        if origin_of(target) != self.origin:
            raise ValueError(f"Navigation blocked: {target} is outside the target app origin {self.origin}.")
        self._remember_elements(session)
        before = session.page.url
        await session.page.goto(target, wait_until="load", timeout=20000)
        await self._settle(session.page)
        snap = await self.snapshot(session, note=f"Navigated to {target}")
        await self._record(session, "navigate", text=target, url_before=before, shot_id=snap.shot_id)
        return snap

    async def click(self, session: Session, ref: str) -> Snapshot:
        self._check_budget(session)
        loc = await self._resolve(session, ref)
        self._remember_elements(session)
        el = session.last_elements.get(ref, {})
        before = session.page.url
        await loc.scroll_into_view_if_needed(timeout=5000)
        await loc.click(timeout=8000)
        await self._settle(session.page)
        snap = await self.snapshot(session, note=f'Clicked {el.get("role", "element")} "{el.get("name", "")}"')
        await self._record(session, "click", ref=ref, url_before=before, shot_id=snap.shot_id)
        return snap

    async def type_text(self, session: Session, ref: str, text: str, submit: bool = False) -> Snapshot:
        self._check_budget(session)
        loc = await self._resolve(session, ref)
        self._remember_elements(session)
        el = session.last_elements.get(ref, {})
        before = session.page.url
        await loc.scroll_into_view_if_needed(timeout=5000)
        await loc.fill(text, timeout=8000)
        if submit:
            await loc.press("Enter", timeout=5000)
        await self._settle(session.page)
        shown = "(secret)" if el.get("role") == "textbox" and "password" in (el.get("name", "").lower()) else text
        snap = await self.snapshot(
            session, note=f'Typed "{shown}" into {el.get("role", "field")} "{el.get("name", "")}"' + (" and pressed Enter" if submit else "")
        )
        await self._record(session, "type", ref=ref, text=text, url_before=before, shot_id=snap.shot_id)
        if submit:
            await self._record(session, "press", text="Enter", url_before=before, shot_id=snap.shot_id)
        return snap

    async def select_option(self, session: Session, ref: str, value: str) -> Snapshot:
        self._check_budget(session)
        loc = await self._resolve(session, ref)
        self._remember_elements(session)
        el = session.last_elements.get(ref, {})
        before = session.page.url
        try:
            await loc.select_option(value=value, timeout=5000)
        except Exception:  # noqa: BLE001
            await loc.select_option(label=value, timeout=5000)
        await self._settle(session.page)
        snap = await self.snapshot(session, note=f'Selected "{value}" in "{el.get("name", "")}"')
        await self._record(session, "select", ref=ref, value=value, url_before=before, shot_id=snap.shot_id)
        return snap

    async def press(self, session: Session, key: str) -> Snapshot:
        self._check_budget(session)
        self._remember_elements(session)
        before = session.page.url
        await session.page.keyboard.press(key)
        await self._settle(session.page)
        snap = await self.snapshot(session, note=f"Pressed {key}")
        await self._record(session, "press", text=key, url_before=before, shot_id=snap.shot_id)
        return snap

    async def scroll(self, session: Session, direction: str = "down") -> Snapshot:
        self._check_budget(session)
        self._remember_elements(session)
        before = session.page.url
        await session.page.mouse.wheel(0, -700 if direction == "up" else 700)
        await session.page.wait_for_timeout(300)
        snap = await self.snapshot(session, note=f"Scrolled {direction}")
        await self._record(session, "scroll", text=direction, url_before=before, shot_id=snap.shot_id)
        return snap

    async def go_back(self, session: Session) -> Snapshot:
        self._check_budget(session)
        self._remember_elements(session)
        before = session.page.url
        await session.page.go_back(wait_until="load", timeout=15000)
        await self._settle(session.page)
        snap = await self.snapshot(session, note="Went back")
        await self._record(session, "back", url_before=before, shot_id=snap.shot_id)
        return snap

    async def reload(self, session: Session) -> Snapshot:
        self._check_budget(session)
        self._remember_elements(session)
        before = session.page.url
        await session.page.reload(wait_until="load", timeout=20000)
        await self._settle(session.page)
        snap = await self.snapshot(session, note="Reloaded the page")
        await self._record(session, "reload", url_before=before, shot_id=snap.shot_id)
        return snap

    async def read_text(self, session: Session, target: str) -> str:
        target = target.strip()
        loc = self._locator(session, target) if REF_RE.fullmatch(target) else session.page.locator(target)
        n = await loc.count()
        if n == 0:
            raise StaleRef(f"Nothing matched '{target}'. Use a ref from the latest snapshot or a valid Playwright selector.")
        texts = []
        for i in range(min(n, 5)):
            texts.append((await loc.nth(i).inner_text(timeout=5000)).strip())
        return "\n---\n".join(texts) + (f"\n({n} matches, showing 5)" if n > 5 else "")
