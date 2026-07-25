"""Minimal AG2 agent protected by TrustLoopGuard."""

from __future__ import annotations

import asyncio
import os

from ag2 import Agent
from ag2.config.openai import OpenAIConfig

from trustloopguard import AsyncClient, SideEffectClass
from trustloopguard.integrations.ag2 import guard_ag2


def lookup_inventory(sku: str) -> str:
    """Return available inventory without changing external state."""
    inventory = {"SKU-123": 8, "SKU-456": 0}
    return f"{sku}: {inventory.get(sku, 0)} units available"


def confirm_order(order_id: str, sku: str, quantity: int) -> str:
    """Simulate confirming an order in an external order API."""
    return f"Order {order_id} confirmed for {quantity} x {sku}"


def build_agent(trustloop: AsyncClient) -> Agent:
    """Build a normal AG2 agent, then attach TrustLoopGuard middleware."""
    agent = Agent(
        "sales-agent",
        prompt=(
            "You are a sales assistant. Check inventory before confirming an "
            "order. Use the provided tools and clearly report the result."
        ),
        config=OpenAIConfig(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        ),
        tools=[lookup_inventory, confirm_order],
    )

    return guard_ag2(
        agent,
        client=trustloop,
        agent_id="cookbook-ag2-sales-agent",
        tool_side_effects={
            "lookup_inventory": SideEffectClass.read,
            "confirm_order": SideEffectClass.api_mutation,
        },
        context={"application": "trustloopguard-cookbook"},
    )


async def main() -> None:
    async with AsyncClient(
        os.getenv("TRUSTLOOPGUARD_BASE_URL", "http://localhost:8080"),
        api_key=os.getenv("TRUSTLOOPGUARD_API_KEY"),
    ) as trustloop:
        agent = build_agent(trustloop)
        reply = await agent.ask(
            "Confirm order ORDER-1001 for 2 units of SKU-123."
        )
        print(reply.body)


if __name__ == "__main__":
    asyncio.run(main())
