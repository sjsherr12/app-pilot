"""LangChain tools exposing one browser session to an agent. All tools are async and never raise:
errors come back as 'ERROR: ...' strings so the model can recover."""

from __future__ import annotations

from typing import Literal

from langchain.tools import tool

from apppilot.engine.browser import BudgetExhausted, StaleRef
from apppilot.engine.scope import current_session
from apppilot.runs.context import RunContext


def make_browser_tools(ctx: RunContext, session_id: str) -> list:
    mgr = ctx.browser

    def sid() -> str:
        # Set per subagent invocation by SessionScopeMiddleware; falls back to the bound default.
        return current_session.get() or session_id

    async def session():
        return await mgr.get(sid())

    async def act(fn, *args):
        async with mgr.lock_for(sid()):
            s = await session()
            return (await fn(s, *args)).text

    def fail(e: BaseException) -> str:
        if isinstance(e, (BudgetExhausted, StaleRef, ValueError)):
            return f"ERROR: {e}"
        return f"ERROR: {type(e).__name__}: {str(e)[:400]}"

    @tool
    async def navigate(url: str) -> str:
        """Open a URL inside the target app (an absolute URL on the app's origin, or a path such as /cart)
        and return a snapshot of the resulting page."""
        try:
            return await act(mgr.navigate, url)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def snapshot() -> str:
        """Observe the current page without acting: URL, headings, status messages, every interactive element
        with its ref (e.g. [e12] button "Add to cart"), visible text, and any new console errors or failed
        requests since the last observation. Refs are regenerated on every snapshot and action."""
        try:
            return await act(mgr.snapshot)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def click(ref: str) -> str:
        """Click the element with the given ref from the latest snapshot (for example "e12").
        Returns a fresh snapshot of the page after the click."""
        try:
            return await act(mgr.click, ref)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def type_text(ref: str, text: str, submit: bool = False) -> str:
        """Clear the input/textarea with the given ref and type text into it. Set submit=true to press Enter
        afterwards (submits most forms). Returns a fresh snapshot."""
        try:
            return await act(mgr.type_text, ref, text, submit)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def select_option(ref: str, value: str) -> str:
        """Choose an option in the <select> with the given ref, by option value or visible label."""
        try:
            return await act(mgr.select_option, ref, value)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def press_key(key: str) -> str:
        """Press a keyboard key on the page, e.g. "Enter", "Escape", "Tab", "ArrowDown"."""
        try:
            return await act(mgr.press, key)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def scroll(direction: Literal["down", "up"] = "down") -> str:
        """Scroll the page down or up by about one screen and return a fresh snapshot."""
        try:
            return await act(mgr.scroll, direction)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def go_back() -> str:
        """Navigate back in browser history."""
        try:
            return await act(mgr.go_back)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def reload_page() -> str:
        """Reload the current page. Use this to check whether data persisted (web equivalent of restarting the app)."""
        try:
            return await act(mgr.reload)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def read_text(target: str) -> str:
        """Read the exact text of one element for deterministic comparison (totals, labels, messages).
        `target` is a ref from the latest snapshot (e.g. "e7") or a Playwright selector such as
        "text=Subtotal", "#total", or "role=cell >> nth=2"."""
        try:
            async with mgr.lock_for(sid()):
                s = await session()
                return await mgr.read_text(s, target)
        except Exception as e:  # noqa: BLE001
            return fail(e)

    @tool
    async def take_screenshot() -> list[dict]:
        """Capture a screenshot of the current viewport and return it as an image so you can judge visual
        layout. The text snapshot is usually enough; use this when text alone is ambiguous."""
        try:
            async with mgr.lock_for(sid()):
                s = await session()
                shot_id, b64 = await mgr.screenshot_b64(s)
            if not b64:
                return [{"type": "text", "text": f"ERROR: screenshot {shot_id} could not be captured"}]
            return [
                {"type": "text", "text": f"Screenshot {shot_id} of {s.page.url}"},
                {"type": "image", "base64": b64, "mime_type": "image/jpeg"},
            ]
        except Exception as e:  # noqa: BLE001
            return [{"type": "text", "text": fail(e)}]

    @tool
    async def get_console_errors() -> str:
        """List all browser console errors and uncaught exceptions recorded in this session so far."""
        s = await session()
        if not s.console_errors:
            return "No console errors recorded in this session."
        return "\n".join(f"{e['ts']} {e['url']}: {e['text']}" for e in s.console_errors[-30:])

    @tool
    async def get_network_failures() -> str:
        """List failed network requests and HTTP responses with status >= 400 recorded in this session so far."""
        s = await session()
        if not s.failed_requests:
            return "No failed requests recorded in this session."
        return "\n".join(
            f"{f['ts']} {f['method']} {f['url']} -> {f['status'] or f['failure']}" for f in s.failed_requests[-30:]
        )

    @tool
    async def reset_environment() -> str:
        """Discard this browser session (cookies, storage, history) and start a brand new one against a freshly
        reset server-side tenant. Call this first when you must reproduce something from a clean state."""
        try:
            async with mgr.lock_for(sid()):
                s = await mgr.reset(sid())
                snap = await mgr.navigate(s, "/")
            hook = s.reset_hook_status
            hook_msg = (
                f"server reset hook returned HTTP {hook}" if hook else "no server reset hook responded (browser state is fresh; server data may persist)"
            )
            return f"Environment reset: new browser context, tenant '{s.tenant}', {hook_msg}.\n{snap.text}"
        except Exception as e:  # noqa: BLE001
            return fail(e)

    return [
        navigate,
        snapshot,
        click,
        type_text,
        select_option,
        press_key,
        scroll,
        go_back,
        reload_page,
        read_text,
        take_screenshot,
        get_console_errors,
        get_network_failures,
        reset_environment,
    ]
