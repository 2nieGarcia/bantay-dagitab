# src/deployment/run.py
"""
Deployment module entry point.

Usage:
    # Run the inference worker once (cron mode)
    python -m src.deployment.run worker

    # Save a model
    python -m src.deployment.run save-model --model-type lightgbm --model-path models/deployed/model.joblib
"""

from __future__ import annotations

import argparse
from pathlib import Path

from src.deployment.inference_worker import main as worker_main
from src.deployment.model_serializer import main as serializer_main


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def build_arg_parser() -> argparse.ArgumentParser:
    """Build top-level deployment CLI."""
    parser = argparse.ArgumentParser(
        description="Model deployment — inference worker and model management"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    worker_cmd = sub.add_parser("worker", help="Run the inference worker")
    worker_cmd.add_argument(
        "--config",
        type=str,
        default=str(PROJECT_ROOT / "config" / "deployment.yaml"),
        help="Path to deployment.yaml",
    )
    worker_cmd.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )

    save_cmd = sub.add_parser("save-model", help="Save a model artifact")
    save_cmd.add_argument("--model-type", required=True)
    save_cmd.add_argument("--model-path", required=True)

    return parser


def main() -> None:
    """Route to appropriate subcommand."""
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.command == "worker":
        # Pass through to inference worker main
        import sys
        sys.argv = [
            "inference_worker",
            "--config", args.config,
            "--log-level", args.log_level,
        ]
        worker_main()

    elif args.command == "save-model":
        print("Use src.deployment.model_serializer.save_model() programmatically.")
        print(f"Target: {args.model_path}")


if __name__ == "__main__":
    main()