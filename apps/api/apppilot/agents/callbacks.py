"""LangChain callback handler that turns agent activity into dashboard events with agent attribution and cost."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler

from apppilot.config import estimate_cost
from apppilot.runs.context import RunContext

log = logging.getLogger(__name__)
KNOWN_AGENTS = {"supervisor", "explorer", "verifier", "test_writer"}


def _normalize_agent(name: Any) -> str:
    n = str(name or "").strip().lower().replace("-", "_")
    return n if n in KNOWN_AGENTS else (n or "system")


class AgentTraceCallback(AsyncCallbackHandler):
    def __init__(self, ctx: RunContext):
        super().__init__()
        self.ctx = ctx
        self.agent_by_run: dict[str, str] = {}
        self.tool_names: dict[str, str] = {}
        self._password = ctx.run.credentials.password if ctx.run.credentials else None

    # ------------------------------------------------------------ attribution
    def _agent(self, parent_run_id: UUID | None) -> str:
        if parent_run_id is None:
            return "supervisor"
        return self.agent_by_run.get(str(parent_run_id), "supervisor")

    def _inherit(self, run_id: UUID, parent_run_id: UUID | None) -> str:
        agent = self._agent(parent_run_id)
        self.agent_by_run[str(run_id)] = agent
        return agent

    def _redact(self, value: Any, depth: int = 0) -> Any:
        if isinstance(value, str):
            if self._password and self._password in value:
                value = value.replace(self._password, "***")
            return value if len(value) <= 2000 else value[:2000] + f"… [{len(value)} chars]"
        if isinstance(value, dict) and depth < 4:
            return {k: ("***" if "password" in str(k).lower() else self._redact(v, depth + 1)) for k, v in value.items()}
        if isinstance(value, list) and depth < 4:
            return [self._redact(v, depth + 1) for v in value[:50]]
        return value

    # ------------------------------------------------------------ chains / models
    async def on_chain_start(self, serialized, inputs, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        self._inherit(run_id, parent_run_id)

    async def on_chat_model_start(self, serialized, messages, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        self._inherit(run_id, parent_run_id)

    async def on_llm_start(self, serialized, prompts, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        self._inherit(run_id, parent_run_id)

    async def on_llm_end(self, response, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        agent = self.agent_by_run.get(str(run_id)) or self._agent(parent_run_id)
        input_tokens = output_tokens = cache_read = cache_write = 0
        model = ""
        for gens in getattr(response, "generations", []) or []:
            for g in gens:
                msg = getattr(g, "message", None)
                usage = getattr(msg, "usage_metadata", None) or {}
                input_tokens += int(usage.get("input_tokens", 0) or 0)
                output_tokens += int(usage.get("output_tokens", 0) or 0)
                details = usage.get("input_token_details") or {}
                cache_read += int(details.get("cache_read", 0) or 0)
                cache_write += int(details.get("cache_creation", 0) or 0)
                meta = getattr(msg, "response_metadata", None) or {}
                model = model or str(meta.get("model") or meta.get("model_name") or "")
        if not (input_tokens or output_tokens):
            return
        cost = estimate_cost(model, input_tokens, output_tokens, cache_read, cache_write)
        run = self.ctx.run
        run.tokens_in += input_tokens
        run.tokens_out += output_tokens
        run.cost_usd = round(run.cost_usd + cost, 6)
        self.ctx.cumulative_cost_usd = run.cost_usd
        try:
            self.ctx.save_run()
        except Exception:
            log.exception("save_run after usage failed")
        self.ctx.bus.emit(
            "llm.usage",
            {
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_read_tokens": cache_read,
                "cost_usd": round(cost, 6),
                "cumulative_cost_usd": run.cost_usd,
            },
            agent=agent,
        )

    # ------------------------------------------------------------ tools
    async def on_tool_start(self, serialized, input_str, *, run_id, parent_run_id=None, inputs=None, **kwargs):  # type: ignore[override]
        name = str((serialized or {}).get("name") or "tool")
        self.tool_names[str(run_id)] = name
        caller = self._agent(parent_run_id)
        args: dict[str, Any] = inputs if isinstance(inputs, dict) else {"input": input_str}
        if name == "task":
            sub = _normalize_agent(args.get("subagent_type"))
            self.agent_by_run[str(run_id)] = sub
            self.ctx.bus.emit(
                "agent.start", {"agent": sub, "description": str(args.get("description", ""))[:1500]}, agent=sub
            )
        else:
            self.agent_by_run[str(run_id)] = caller
        if name == "write_todos" and isinstance(args.get("todos"), list):
            self.ctx.bus.emit("todo.update", {"todos": args["todos"]}, agent=caller)
        self.ctx.bus.emit("tool.start", {"tool": name, "args": self._redact(args), "call_id": str(run_id)}, agent=caller)

    async def on_tool_end(self, output, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        name = self.tool_names.pop(str(run_id), "tool")
        caller = self._agent(parent_run_id)
        content = getattr(output, "content", output)
        update = getattr(output, "update", None)  # langgraph Command returned by task/write_todos
        if isinstance(update, dict):
            msgs = update.get("messages")
            if isinstance(msgs, list) and msgs:
                content = getattr(msgs[-1], "content", msgs[-1])
            elif "todos" in update:
                content = f"{len(update['todos'])} todos updated"
        if isinstance(content, list):
            content = " ".join(str(b.get("text", "[image]")) if isinstance(b, dict) else str(b) for b in content)
        preview = self._redact(str(content))
        preview = preview if len(preview) <= 800 else preview[:800] + "…"
        self.ctx.bus.emit("tool.end", {"tool": name, "call_id": str(run_id), "result_preview": preview}, agent=caller)
        if name == "task":
            sub = self.agent_by_run.get(str(run_id), "system")
            self.ctx.bus.emit("agent.end", {"agent": sub, "summary": preview}, agent=sub)

    async def on_tool_error(self, error, *, run_id, parent_run_id=None, **kwargs):  # type: ignore[override]
        name = self.tool_names.pop(str(run_id), "tool")
        caller = self._agent(parent_run_id)
        self.ctx.bus.emit(
            "tool.end",
            {"tool": name, "call_id": str(run_id), "result_preview": "", "error": str(error)[:800]},
            agent=caller,
        )
        if name == "task":
            sub = self.agent_by_run.get(str(run_id), "system")
            self.ctx.bus.emit("agent.end", {"agent": sub, "summary": f"failed: {str(error)[:300]}"}, agent=sub)
