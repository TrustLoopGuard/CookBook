"""Regression tests for the Agno approval cookbook contract."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMPLE_PATH = REPO_ROOT / "examples" / "agno" / "guarded_sales_agent.py"
POLICY_PATH = REPO_ROOT / "examples" / "agno" / "confirm-order-approval.yaml"


class AgnoCookbookContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = EXAMPLE_PATH.read_text()
        self.tree = ast.parse(self.source)

    def test_example_never_self_approves_or_resumes_agno(self) -> None:
        imported_modules = {
            node.module
            for node in ast.walk(self.tree)
            if isinstance(node, ast.ImportFrom) and node.module is not None
        }
        called_attributes = {
            node.func.attr
            for node in ast.walk(self.tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        }

        self.assertNotIn("agno.approval", imported_modules)
        self.assertNotIn("confirm", called_attributes)
        self.assertNotIn("continue_run", called_attributes)

    def test_example_has_a_human_sized_approval_window(self) -> None:
        guard_calls = [
            node
            for node in ast.walk(self.tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "guard_agno"
        ]
        self.assertEqual(len(guard_calls), 1)
        timeout = next(
            (
                keyword.value.value
                for keyword in guard_calls[0].keywords
                if keyword.arg == "approval_timeout_s"
                and isinstance(keyword.value, ast.Constant)
            ),
            None,
        )
        self.assertEqual(timeout, 300)

    def test_shipped_policy_requires_approval_for_confirm_order(self) -> None:
        policy = POLICY_PATH.read_text()

        self.assertIn("family: approval", policy)
        self.assertIn("tools: [confirm_order]", policy)
        self.assertIn("side_effects: [api_mutation]", policy)
        self.assertIn("approver_roles: [owner, admin]", policy)
        self.assertIn("action: require_approval", policy)


if __name__ == "__main__":
    unittest.main()
