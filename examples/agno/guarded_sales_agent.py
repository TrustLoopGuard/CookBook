"""Minimal Agno agent protected by TrustLoopGuard."""

from __future__ import annotations

import os

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from trustloopguard import Client, SideEffectClass
from trustloopguard.integrations.agno import guard_agno


def lookup_inventory(sku: str) -> str:
    """Return available inventory without changing external state."""
    inventory = {"SKU-123": 8, "SKU-456": 0}
    return f"{sku}: {inventory.get(sku, 0)} units available"


def confirm_order(order_id: str, sku: str, quantity: int) -> str:
    """Simulate confirming an order in an external order API."""
    print("Executing confirm_order after TrustLoopGuard authorization.")
    return f"Order {order_id} confirmed for {quantity} x {sku}"


def build_agent(trustloop: Client) -> Agent:
    """Build a normal Agno agent, then attach TrustLoopGuard hooks."""
    agent = Agent(
        id="cookbook-agno-sales-agent",
        name="sales-agent",
        model=OpenAIChat(
            id=os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        ),
        instructions=[
            "Check inventory before confirming an order.",
            "Use the provided tools and clearly report the result.",
        ],
        tools=[lookup_inventory, confirm_order],
        markdown=True,
    )

    return guard_agno(
        agent,
        client=trustloop,
        agent_id="cookbook-agno-sales-agent",
        tool_side_effects={
            "lookup_inventory": SideEffectClass.read,
            "confirm_order": SideEffectClass.api_mutation,
        },
        approval_timeout_s=300,
        context={"application": "trustloopguard-cookbook"},
    )


def main() -> None:
    with Client(
        os.getenv("TRUSTLOOPGUARD_BASE_URL", "http://localhost:8080"),
        api_key=os.getenv("TRUSTLOOPGUARD_API_KEY"),
    ) as trustloop:
        agent = build_agent(trustloop)
        response = agent.run(
            "Confirm order ORDER-1001 for 2 units of SKU-123.",
            stream=False,
        )
        print(response.content)


if __name__ == "__main__":
    main()
