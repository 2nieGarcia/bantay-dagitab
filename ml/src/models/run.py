from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FEATURES_DIR = PROJECT_ROOT / "data" / "features"
REPORTS_DIR = PROJECT_ROOT / "output" / "reports"
PREDICTIONS_DIR = PROJECT_ROOT / "output" / "predictions"


@dataclass
class MetricRow:
    device_id: str
    model: str
    fold_count: int
    mae: float
    rmse: float
    mape: float


def ensure_dirs() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def load_device_frames(device_dir: Path) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    for parquet_path in sorted(device_dir.glob("*.parquet")):
        df = pd.read_parquet(parquet_path)
        if df.empty:
            continue
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    full = pd.concat(frames, ignore_index=True)
    return full.sort_values("timestamp").reset_index(drop=True)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[float, float, float]:
    if len(y_true) == 0:
        return float("nan"), float("nan"), float("nan")

    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    if y_true.shape != y_pred.shape:
        return float("nan"), float("nan"), float("nan")

    mask = np.isfinite(y_true) & np.isfinite(y_pred)
    if not mask.any():
        return float("nan"), float("nan"), float("nan")

    y_true = y_true[mask]
    y_pred = y_pred[mask]

    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    with np.errstate(divide="ignore", invalid="ignore"):
        mape_vals = np.abs((y_true - y_pred) / y_true)
        mape_vals = np.where(np.isfinite(mape_vals), mape_vals, np.nan)
    mape = float(np.nanmean(np.clip(mape_vals, 0, 1.0)) * 100.0)
    return mae, rmse, mape


def build_folds(dates: List[pd.Timestamp], val_days: int = 7, test_days: int = 14) -> List[Tuple[pd.Timestamp, pd.Timestamp, pd.Timestamp, pd.Timestamp]]:
    if len(dates) < (val_days + test_days + 7):
        return []

    folds: List[Tuple[pd.Timestamp, pd.Timestamp, pd.Timestamp, pd.Timestamp]] = []
    last_train_idx = len(dates) - test_days - 1
    min_train_idx = max(6, 29) if len(dates) >= (val_days + test_days + 30) else 6

    fold_end = min_train_idx
    while fold_end < last_train_idx:
        train_end = dates[fold_end]
        val_start_idx = fold_end + 1
        val_end_idx = min(val_start_idx + val_days - 1, last_train_idx)
        if val_start_idx > val_end_idx:
            break
        folds.append((dates[0], train_end, dates[val_start_idx], dates[val_end_idx]))
        fold_end = val_end_idx

    return folds


def subset_by_date(df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    mask = (df["date"] >= start) & (df["date"] <= end)
    return df.loc[mask].copy()


def persistence_predict(full: pd.DataFrame, val_idx: Iterable[int]) -> np.ndarray:
    preds = full["avg_wattage"].shift(1).iloc[list(val_idx)].to_numpy()
    return preds


def median_predict(train_df: pd.DataFrame, val_df: pd.DataFrame) -> np.ndarray:
    slot = train_df["timestamp"].dt.hour * 60 + train_df["timestamp"].dt.minute
    medians = train_df.groupby(slot)["avg_wattage"].median().to_dict()
    global_median = float(train_df["avg_wattage"].median())

    val_slot = val_df["timestamp"].dt.hour * 60 + val_df["timestamp"].dt.minute
    preds = val_slot.map(medians).fillna(global_median).to_numpy()
    return preds


def ses_predict(train_series: np.ndarray, val_series: np.ndarray, alpha: float = 0.3) -> np.ndarray:
    if len(train_series) == 0:
        return np.array([])

    level = train_series[0]
    for y in train_series[1:]:
        level = alpha * y + (1 - alpha) * level

    preds = []
    for y in val_series:
        preds.append(level)
        level = alpha * y + (1 - alpha) * level

    return np.array(preds)


def holt_winters_predict(train_series: np.ndarray, val_len: int) -> Optional[np.ndarray]:
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
    except ImportError:
        return None

    if len(train_series) < 192:
        return None

    try:
        model = ExponentialSmoothing(
            train_series,
            trend="add",
            seasonal="add",
            seasonal_periods=96,
        ).fit(optimized=True)
        preds = model.forecast(val_len)
        return np.asarray(preds)
    except Exception:
        return None


def lightgbm_predict(train_df: pd.DataFrame, val_df: pd.DataFrame, feature_cols: List[str]) -> Optional[np.ndarray]:
    try:
        import lightgbm as lgb
    except ImportError:
        return None

    train_df = train_df.dropna(subset=feature_cols + ["avg_wattage"]).copy()
    val_df = val_df.dropna(subset=feature_cols + ["avg_wattage"]).copy()
    if train_df.empty or val_df.empty:
        return None

    model = lgb.LGBMRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.05,
        random_state=42,
    )
    model.fit(
        train_df[feature_cols],
        train_df["avg_wattage"],
        eval_set=[(val_df[feature_cols], val_df["avg_wattage"])],
        eval_metric="l1",
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )
    preds = model.predict(val_df[feature_cols])
    return np.asarray(preds)


def lstm_predict(
    full: pd.DataFrame,
    train_mask: np.ndarray,
    val_mask: np.ndarray,
    seq_len: int = 168,
    epochs: int = 3,
) -> Optional[np.ndarray]:
    try:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, TensorDataset
    except ImportError:
        return None

    series = full["avg_wattage"].to_numpy(dtype=np.float32)
    if len(series) <= seq_len:
        return None

    targets = []
    sequences = []
    val_indices = []

    for idx in range(seq_len, len(series)):
        sequences.append(series[idx - seq_len : idx])
        targets.append(series[idx])
        val_indices.append(idx)

    sequences = np.stack(sequences)
    targets = np.array(targets)
    val_indices = np.array(val_indices)

    train_sel = train_mask[val_indices]
    val_sel = val_mask[val_indices]

    if not train_sel.any() or not val_sel.any():
        return None

    X_train = torch.from_numpy(sequences[train_sel]).unsqueeze(-1)
    y_train = torch.from_numpy(targets[train_sel]).unsqueeze(-1)
    X_val = torch.from_numpy(sequences[val_sel]).unsqueeze(-1)

    train_loader = DataLoader(TensorDataset(X_train, y_train), batch_size=64, shuffle=True)

    class SimpleLSTM(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.lstm = nn.LSTM(input_size=1, hidden_size=32, batch_first=True, dropout=0.2)
            self.fc = nn.Linear(32, 1)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            out, _ = self.lstm(x)
            return self.fc(out[:, -1, :])

    device = torch.device("cpu")
    model = SimpleLSTM().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()

    model.train()
    for _ in range(epochs):
        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(device)
            batch_y = batch_y.to(device)
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = loss_fn(preds, batch_y)
            loss.backward()
            optimizer.step()

    model.eval()
    with torch.no_grad():
        preds = model(X_val.to(device)).cpu().numpy().reshape(-1)

    return preds

def evaluate_device(
    device_id: str,
    df: pd.DataFrame,
    predictions_dir: Optional[Path] = None,
) -> List[MetricRow]:
    
    df = df.copy()
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["date"] = df["timestamp"].dt.normalize()

    unique_dates = sorted(df["date"].unique())
    if len(unique_dates) >= 21:
        test_start = unique_dates[-14]
        val_start = unique_dates[-21]
        df["split"] = "train"
        df.loc[df["date"] >= val_start, "split"] = "val"
        df.loc[df["date"] >= test_start, "split"] = "test"
    else:
        df["split"] = "train"
        
    folds = build_folds(unique_dates)
    if not folds:
        return []

    feature_cols = [
        col
        for col in df.columns
        if col
        not in {
            "timestamp",
            "avg_wattage",
            "device_id",
            "user_account_id",
            "data_quality_flag",
            "date",
            "split",
        }
    ]

    metrics: Dict[str, List[Tuple[float, float, float]]] = {
        "persistence": [],
        "median": [],
        "ses": [],
        "holt_winters": [],
        "lightgbm": [],
        "lstm": [],
    }

    # Collect prediction dataframes per model
    all_pred_dfs: Dict[str, List[pd.DataFrame]] = {
        "persistence": [],
        "median": [],
        "ses": [],
        "holt_winters": [],
        "lightgbm": [],
        "lstm": [],
    }

    for train_start, train_end, val_start, val_end in folds:
        train_df = subset_by_date(df, train_start, train_end)
        val_df = subset_by_date(df, val_start, val_end)
        if train_df.empty or val_df.empty:
            continue

        train_df_clean = train_df.dropna(subset=["avg_wattage"]).copy()
        val_df_clean = val_df.dropna(subset=["avg_wattage"]).copy()
        if train_df_clean.empty or val_df_clean.empty:
            continue

        train_series = train_df_clean["avg_wattage"].to_numpy(dtype=float)
        val_series = val_df_clean["avg_wattage"].to_numpy(dtype=float)

        val_idx = val_df_clean.index

        # --- PERSISTENCE ---
        persistence_preds = persistence_predict(df, val_idx)
        mae, rmse, mape = compute_metrics(val_series, persistence_preds)
        metrics["persistence"].append((mae, rmse, mape))
        preds_valid = persistence_preds[np.isfinite(persistence_preds)]
        idx_valid = val_idx[:len(preds_valid)]
        if len(preds_valid) > 0:
            all_pred_dfs["persistence"].append(pd.DataFrame({
                "timestamp": df.loc[idx_valid, "timestamp"].values,
                "device_id": device_id,
                "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                "predicted_wattage": preds_valid,
                "split": df.loc[idx_valid, "split"].values,
            }))

        # --- MEDIAN ---
        median_preds = median_predict(train_df_clean, val_df_clean)
        mae, rmse, mape = compute_metrics(val_series, median_preds)
        metrics["median"].append((mae, rmse, mape))
        preds_valid = median_preds[np.isfinite(median_preds)]
        idx_valid = val_idx[:len(preds_valid)]
        if len(preds_valid) > 0:
            all_pred_dfs["median"].append(pd.DataFrame({
                "timestamp": df.loc[idx_valid, "timestamp"].values,
                "device_id": device_id,
                "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                "predicted_wattage": preds_valid,
                "split": df.loc[idx_valid, "split"].values,
            }))

        # --- SES ---
        ses_preds = ses_predict(train_series, val_series)
        mae, rmse, mape = compute_metrics(val_series, ses_preds)
        metrics["ses"].append((mae, rmse, mape))
        preds_valid = ses_preds[np.isfinite(ses_preds)]
        idx_valid = val_idx[:len(preds_valid)]
        if len(preds_valid) > 0:
            all_pred_dfs["ses"].append(pd.DataFrame({
                "timestamp": df.loc[idx_valid, "timestamp"].values,
                "device_id": device_id,
                "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                "predicted_wattage": preds_valid,
                "split": df.loc[idx_valid, "split"].values,
            }))

        # --- HOLT-WINTERS ---
        hw_preds = holt_winters_predict(train_series, len(val_series))
        if hw_preds is not None:
            mae, rmse, mape = compute_metrics(val_series, hw_preds)
            metrics["holt_winters"].append((mae, rmse, mape))
            preds_valid = hw_preds[np.isfinite(hw_preds)]
            idx_valid = val_idx[:len(preds_valid)]
            if len(preds_valid) > 0:
                all_pred_dfs["holt_winters"].append(pd.DataFrame({
                    "timestamp": df.loc[idx_valid, "timestamp"].values,
                    "device_id": device_id,
                    "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                    "predicted_wattage": preds_valid,
                    "split": df.loc[idx_valid, "split"].values,
                }))

        # --- LIGHTGBM ---
        lgb_preds = lightgbm_predict(train_df, val_df, feature_cols)
        if lgb_preds is not None:
            lgb_val_df = val_df.dropna(subset=feature_cols + ["avg_wattage"])
            lgb_val_target = lgb_val_df["avg_wattage"].to_numpy()
            mae, rmse, mape = compute_metrics(lgb_val_target, lgb_preds)
            metrics["lightgbm"].append((mae, rmse, mape))
            preds_valid = lgb_preds[np.isfinite(lgb_preds)]
            lgb_idx = lgb_val_df.index[:len(preds_valid)]
            if len(preds_valid) > 0:
                all_pred_dfs["lightgbm"].append(pd.DataFrame({
                    "timestamp": df.loc[lgb_idx, "timestamp"].values,
                    "device_id": device_id,
                    "avg_wattage": df.loc[lgb_idx, "avg_wattage"].values,
                    "predicted_wattage": preds_valid,
                    "split": df.loc[lgb_idx, "split"].values,
                }))

        # --- LSTM ---
        train_mask = (df["date"] >= train_start) & (df["date"] <= train_end)
        val_mask = (df["date"] >= val_start) & (df["date"] <= val_end)
        lstm_preds = lstm_predict(df, train_mask.to_numpy(), val_mask.to_numpy())
        if lstm_preds is not None:
            val_targets = df.loc[val_mask, "avg_wattage"].to_numpy(dtype=float)
            val_targets = val_targets[-len(lstm_preds):]
            mae, rmse, mape = compute_metrics(val_targets, lstm_preds)
            metrics["lstm"].append((mae, rmse, mape))
            preds_valid = lstm_preds[np.isfinite(lstm_preds)]
            lstm_val_df = df.loc[val_mask]
            lstm_idx = lstm_val_df.index[-len(preds_valid):]
            if len(preds_valid) > 0:
                all_pred_dfs["lstm"].append(pd.DataFrame({
                    "timestamp": df.loc[lstm_idx, "timestamp"].values,
                    "device_id": device_id,
                    "avg_wattage": df.loc[lstm_idx, "avg_wattage"].values,
                    "predicted_wattage": preds_valid,
                    "split": df.loc[lstm_idx, "split"].values,
                }))

    # --- GENERATE TEST SET PREDICTIONS ---
    test_df = df[df["split"] == "test"]
    if len(test_df) > 0:
        train_all_df = df[df["split"] != "test"]
        
        if len(train_all_df) > 0:
            train_all_clean = train_all_df.dropna(subset=["avg_wattage"])
            test_clean = test_df.dropna(subset=["avg_wattage"])
            
            if len(train_all_clean) > 0 and len(test_clean) > 0:
                train_all_series = train_all_clean["avg_wattage"].to_numpy(dtype=float)
                test_series = test_clean["avg_wattage"].to_numpy(dtype=float)
                test_idx = test_clean.index
                
                # Persistence on test
                test_persistence = df["avg_wattage"].shift(1).iloc[test_idx].to_numpy()
                preds_valid = test_persistence[np.isfinite(test_persistence)]
                idx_valid = test_idx[:len(preds_valid)]
                if len(preds_valid) > 0:
                    all_pred_dfs["persistence"].append(pd.DataFrame({
                        "timestamp": df.loc[idx_valid, "timestamp"].values,
                        "device_id": device_id,
                        "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                        "predicted_wattage": preds_valid,
                        "split": "test",
                    }))
                
                # Median on test
                test_median = median_predict(train_all_clean, test_clean)
                preds_valid = test_median[np.isfinite(test_median)]
                idx_valid = test_idx[:len(preds_valid)]
                if len(preds_valid) > 0:
                    all_pred_dfs["median"].append(pd.DataFrame({
                        "timestamp": df.loc[idx_valid, "timestamp"].values,
                        "device_id": device_id,
                        "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                        "predicted_wattage": preds_valid,
                        "split": "test",
                    }))
                
                # SES on test
                test_ses = ses_predict(train_all_series, test_series)
                preds_valid = test_ses[np.isfinite(test_ses)]
                idx_valid = test_idx[:len(preds_valid)]
                if len(preds_valid) > 0:
                    all_pred_dfs["ses"].append(pd.DataFrame({
                        "timestamp": df.loc[idx_valid, "timestamp"].values,
                        "device_id": device_id,
                        "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                        "predicted_wattage": preds_valid,
                        "split": "test",
                    }))
                
                # Holt-Winters on test
                test_hw = holt_winters_predict(train_all_series, len(test_series))
                if test_hw is not None:
                    preds_valid = test_hw[np.isfinite(test_hw)]
                    idx_valid = test_idx[:len(preds_valid)]
                    if len(preds_valid) > 0:
                        all_pred_dfs["holt_winters"].append(pd.DataFrame({
                            "timestamp": df.loc[idx_valid, "timestamp"].values,
                            "device_id": device_id,
                            "avg_wattage": df.loc[idx_valid, "avg_wattage"].values,
                            "predicted_wattage": preds_valid,
                            "split": "test",
                        }))
                
                # LightGBM on test
                test_lgb = lightgbm_predict(train_all_df, test_df, feature_cols)
                if test_lgb is not None:
                    lgb_test_df = test_df.dropna(subset=feature_cols + ["avg_wattage"])
                    lgb_test_target = lgb_test_df["avg_wattage"].to_numpy()
                    preds_valid = test_lgb[np.isfinite(test_lgb)]
                    lgb_test_idx = lgb_test_df.index[:len(preds_valid)]
                    if len(preds_valid) > 0:
                        all_pred_dfs["lightgbm"].append(pd.DataFrame({
                            "timestamp": df.loc[lgb_test_idx, "timestamp"].values,
                            "device_id": device_id,
                            "avg_wattage": df.loc[lgb_test_idx, "avg_wattage"].values,
                            "predicted_wattage": preds_valid,
                            "split": "test",
                        }))
                
                # LSTM on test
                train_mask_all = df["split"] != "test"
                test_mask_all = df["split"] == "test"
                test_lstm = lstm_predict(df, train_mask_all.to_numpy(), test_mask_all.to_numpy())
                if test_lstm is not None:
                    preds_valid = test_lstm[np.isfinite(test_lstm)]
                    lstm_test_df = df.loc[test_mask_all]
                    lstm_test_idx = lstm_test_df.index[-len(preds_valid):]
                    if len(preds_valid) > 0:
                        all_pred_dfs["lstm"].append(pd.DataFrame({
                            "timestamp": df.loc[lstm_test_idx, "timestamp"].values,
                            "device_id": device_id,
                            "avg_wattage": df.loc[lstm_test_idx, "avg_wattage"].values,
                            "predicted_wattage": preds_valid,
                            "split": "test",
                        }))

    # --- SAVE PREDICTIONS FOR EVALUATION STAGE ---
    if predictions_dir is not None:
        for model_name, fold_dfs in all_pred_dfs.items():
            if not fold_dfs:
                continue

            out_df = pd.concat(fold_dfs, ignore_index=True)
            out_df = out_df.sort_values("timestamp").reset_index(drop=True)

            model_dir = predictions_dir / model_name
            model_dir.mkdir(parents=True, exist_ok=True)
            out_path = model_dir / f"{device_id}.parquet"
            out_df.to_parquet(out_path, index=False, compression="snappy")

    # --- COMPUTE METRIC ROWS ---
    rows: List[MetricRow] = []
    for model_name, values in metrics.items():
        if not values:
            continue
        arr = np.array(values)
        rows.append(
            MetricRow(
                device_id=device_id,
                model=model_name,
                fold_count=len(values),
                mae=float(np.mean(arr[:, 0])),
                rmse=float(np.mean(arr[:, 1])),
                mape=float(np.mean(arr[:, 2])),
            )
        )

    return rows


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Baseline model training component")
    parser.add_argument(
        "--source-dir",
        default=str(FEATURES_DIR),
        help="Directory containing per-device feature parquet files",
    )
    return parser


def save_predictions(
    device_id: str,
    model_name: str,
    df: pd.DataFrame,
    predictions: np.ndarray,
    split: str,
    output_dir: Path,
) -> Path:
    """
    Save model predictions for evaluation stage consumption.

    Args:
        device_id: Device identifier.
        model_name: Name of the model.
        df: Full device dataframe with timestamp and avg_wattage columns.
        predictions: Array of predicted values.
        split: Data split label ('train', 'val', or 'test').
        output_dir: Root directory for prediction outputs.

    Returns:
        Path to the saved parquet file.
    """
    model_dir = output_dir / model_name
    model_dir.mkdir(parents=True, exist_ok=True)
    
    split_mask = df["split"] == split if "split" in df.columns else pd.Series([False] * len(df))
    split_df = df.loc[split_mask].copy()
    
    if len(split_df) == 0 or len(predictions) == 0:
        return model_dir / f"{device_id}.parquet"
    
    # Align lengths
    n = min(len(split_df), len(predictions))
    
    out_df = pd.DataFrame({
        "timestamp": split_df["timestamp"].values[:n],
        "device_id": device_id,
        "avg_wattage": split_df["avg_wattage"].values[:n],
        "predicted_wattage": predictions[:n],
        "split": split,
    })
    
    out_path = model_dir / f"{device_id}.parquet"
    out_df.to_parquet(out_path, index=False, compression="snappy")
    return out_path


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    device_dirs = [p for p in sorted(source_dir.iterdir()) if p.is_dir()]
    if not device_dirs:
        print("No device folders found.")
        return

    ensure_dirs()

    all_rows: List[MetricRow] = []
    for device_dir in device_dirs:
        df = load_device_frames(device_dir)
        if df.empty:
            continue
        device_id = device_dir.name
        all_rows.extend(evaluate_device(device_id, df, PREDICTIONS_DIR))

    if not all_rows:
        print("No metrics generated.")
        return

    stamp = now_stamp()
    json_path = REPORTS_DIR / f"training_metrics_{stamp}.json"
    csv_path = REPORTS_DIR / f"training_metrics_{stamp}.csv"

    json_path.write_text(json.dumps([asdict(row) for row in all_rows], indent=2))

    pd.DataFrame([asdict(row) for row in all_rows]).to_csv(csv_path, index=False)

    print(f"Wrote {json_path}")
    print(f"Wrote {csv_path}")


if __name__ == "__main__":
    main()
