"""
run_pipeline.py — End-to-end ML pipeline orchestrator.
Bantay-Dagitab: Residential Energy Anomaly Detection
Usage: python run_pipeline.py [options]
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent


def run_stage(name: str, command: str) -> bool:
    """Run a single pipeline stage. Returns True if successful."""
    print(f"\n{'=' * 60}")
    print(f"STAGE: {name}")
    print(f"{'=' * 60}")
    print(f"  $ {command}")
    print(f"  Started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    result = subprocess.run(
        command,
        shell=True,
        cwd=str(PROJECT_ROOT),
    )

    if result.returncode != 0:
        print(f"  FAILED with exit code {result.returncode}")
        return False

    print(f"  Completed at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"  DONE")
    return True


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Bantay-Dagitab ML Pipeline Orchestrator"
    )
    parser.add_argument("--mode", choices=["train", "inference", "monitoring", "full"], default="full",
                        help="Pipeline mode: train, inference, monitoring, or full (all)")
    parser.add_argument("--skip-ingestion", action="store_true", help="Skip ingestion stage")
    parser.add_argument("--skip-preprocessing", action="store_true", help="Skip preprocessing stage")
    parser.add_argument("--skip-features", action="store_true", help="Skip feature engineering stage")
    parser.add_argument("--skip-training", action="store_true", help="Skip model training stage")
    parser.add_argument("--skip-evaluation", action="store_true", help="Skip evaluation stage")
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    stages = []

    # Training pipeline
    if args.mode in ("train", "full"):
        if not args.skip_ingestion:
            stages.append(("Ingestion", "python -m src.ingestion.run consolidate"))
        if not args.skip_preprocessing:
            stages.append(("Preprocessing", "python -m src.preprocessing.run"))
        if not args.skip_features:
            stages.append(("Feature Engineering", "python -m src.features.run --advanced-lite"))
        if not args.skip_training:
            stages.append(("Model Training", "python -m src.models.run"))
        if not args.skip_evaluation:
            stages.append(("Evaluation", "python -m src.evaluation.run"))

    # Inference
    if args.mode in ("inference", "full"):
        stages.append(("Inference Worker", "python -m src.inference.run worker"))

    # Monitoring
    if args.mode in ("monitoring", "full"):
        stages.append(("Monitoring Report", "python scripts/run_monitoring_report.py"))

    if not stages:
        print("No stages to run.")
        return

    print("=" * 60)
    print("BANTAY-DAGITAB ML PIPELINE")
    print(f"Mode: {args.mode}")
    print(f"Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Stages: {' → '.join(name for name, _ in stages)}")
    print("=" * 60)

    for name, command in stages:
        success = run_stage(name, command)
        if not success:
            print(f"\nPipeline aborted at stage: {name}")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print(f"Finished: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)


if __name__ == "__main__":
    main()