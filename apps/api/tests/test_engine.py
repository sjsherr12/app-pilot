"""Engine tests against a static fixture app (no LLM, no demo shop needed)."""

import pytest

from apppilot.engine.browser import BrowserSessionManager, StaleRef


@pytest.fixture
async def mgr(tmp_path, mini_app_url):
    actions = []

    async def on_action(session, rec):
        actions.append(rec)

    m = BrowserSessionManager(run_id="run_test", run_dir=tmp_path, app_url=mini_app_url, headless=True, on_action=on_action)
    m.recorded = actions  # type: ignore[attr-defined]
    await m.start()
    yield m
    await m.close()


async def test_snapshot_click_type_and_signals(mgr):
    s = await mgr.get("explore")
    snap = await mgr.navigate(s, "/mini_app.html")
    assert "Mini Shop" in snap.text
    assert 'button "Add Widget to cart"' in snap.text
    assert 'textbox "Search"' in snap.text
    assert "Screenshot id: s0001" in snap.text

    add_ref = next(ref for ref, el in s.last_elements.items() if el["name"] == "Add Widget to cart")
    snap = await mgr.click(s, add_ref)
    assert "Cart (1)" in snap.text
    assert "Added Widget" in snap.text
    assert "boom from mini shop" in snap.text  # console error surfaced in the snapshot

    search_ref = next(ref for ref, el in s.last_elements.items() if el["name"] == "Search")
    snap = await mgr.type_text(s, search_ref, "jacket")
    assert 'value="jacket"' in snap.text

    broken = next(ref for ref, el in s.last_elements.items() if el["name"] == "Broken link")
    snap = await mgr.click(s, broken)
    assert "404" in snap.text  # failed request line

    kinds = [r.kind for r in mgr.recorded]
    assert kinds == ["navigate", "click", "type", "click"]
    assert mgr.recorded[1].role == "button" and mgr.recorded[1].name == "Add Widget to cart"
    assert (mgr.run_dir / "shots" / "s0001.jpg").exists()


async def test_stale_ref_and_origin_guard(mgr):
    s = await mgr.get("explore")
    await mgr.navigate(s, "/mini_app.html")
    with pytest.raises(StaleRef):
        await mgr.click(s, "e999")
    with pytest.raises(ValueError):
        await mgr.navigate(s, "https://example.com/")


async def test_reset_creates_fresh_generation_and_keeps_logs(mgr):
    s1 = await mgr.get("verify")
    await mgr.navigate(s1, "/mini_app.html")
    assert s1.generation == 1 and s1.tracing is True
    s2 = await mgr.reset("verify")
    assert s2.generation == 2 and s2.tenant != s1.tenant
    assert mgr.action_log("verify.g1") is not None and len(mgr.action_log("verify.g1")) == 1
    assert mgr.action_log("verify") == s2.action_log
    assert (mgr.run_dir / "traces" / "verify.g1.zip").exists()


async def test_background_close_keeps_logs_and_parallel_close(mgr):
    a = await mgr.get("explore-1")
    await mgr.navigate(a, "/mini_app.html")
    b = await mgr.get("explore-2")
    await mgr.navigate(b, "/mini_app.html")
    mgr.close_session_in_background("explore-1")
    assert "explore-1" not in mgr.sessions
    await mgr.close()  # awaits the background close, closes explore-2 in parallel
    assert len(mgr.action_log("explore-1.g1")) == 1 and len(mgr.action_log("explore-2.g1")) == 1
    assert (mgr.run_dir / "video" / "explore-1.g1.webm").exists()
    assert (mgr.run_dir / "video" / "explore-2.g1.webm").exists()
