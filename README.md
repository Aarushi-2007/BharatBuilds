# ⚡ Peak-Grid — Weather-Aware Electricity Demand Forecasting & Peak Management

ML + optimisation core for an electricity-authority web app: forecast demand from history + weather, detect upcoming peaks, and plan load-shifting to keep demand under the grid limit.

```
peak-grid/
├── setup.sh                 ← run once: creates .venv and installs everything
├── sync_models.sh           ← after retraining: copies new models into backend/
├── ml/
│   ├── Weather_Aware_Demand_Forecasting.ipynb   ← Notebook 1: trains the forecasting models
│   ├── Peak_Shaving_Optimizer.ipynb             ← Notebook 2: the load-shifting optimiser
│   ├── study1_hourly.csv                        ← hourly demand (Grid-Sentinel / NLDC)
│   ├── era5_weather_india_hourly.csv            ← hourly ERA5 weather, 11 Indian cities
│   └── requirements.txt
├── backend/
│   ├── models/  (model.pkl, model_dayahead.pkl, feature_config.json)
│   ├── peak_optimizer.py    ← import this in your FastAPI app
│   ├── plan_example.json    ← example API response
│   └── requirements.txt     ← exact versions the models were trained with
└── frontend/                ← your dashboard goes here
```

---

## 1. One-time setup

### macOS / Linux
```bash
cd peak-grid
bash setup.sh
code .
```
(`setup.sh` installs `libomp` via Homebrew on macOS — XGBoost needs it — then creates `.venv` and installs the packages.)

### Windows (PowerShell)
```powershell
cd peak-grid
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r ml\requirements.txt
code .
```
On Windows, also select the interpreter manually in VS Code (step 2) — the preset path in `.vscode/settings.json` is the macOS/Linux one.

## 2. In VS Code
1. Install the recommended extensions when VS Code asks (**Python** and **Jupyter**).
2. `Cmd/Ctrl + Shift + P` → **Python: Select Interpreter** → choose `.venv`.
3. Open a notebook → **Select Kernel** (top right) → choose `.venv`.

## 3. Run the notebooks (in this order)
1. `ml/Weather_Aware_Demand_Forecasting.ipynb` → **Run All** (~5–10 min). Saves `model.pkl`, `model_dayahead.pkl`, `feature_config.json` into `ml/`.
2. `ml/Peak_Shaving_Optimizer.ipynb` → **Run All** (~2 min). Uses the files from step 1; writes `peak_optimizer.py` and `plan_example.json` into `ml/`.
3. Copy the fresh files into the backend and pin package versions:
   ```bash
   bash sync_models.sh
   ```

> **Why retrain locally?** `backend/models/` already contains working models, but a `.pkl` should be loaded with the **same XGBoost / scikit-learn versions that trained it**. Retraining in your own `.venv` (steps 1–3) guarantees your backend and the models match. The notebooks already show the outputs from the original run, so you can read them before running anything.

Every new terminal: `source .venv/bin/activate` (macOS/Linux) or `.venv\Scripts\activate` (Windows). VS Code's built-in terminal does this automatically once the interpreter is selected.

---

## Key results (test year May 2023 → Apr 2024, never seen in training)

| Model | MAE | RMSE | R² |
|---|---|---|---|
| Next-hour XGBoost (predicts change) | 748 MW | 1,025 MW | 0.9908 |
| Day-ahead XGBoost (predicts change) | 1,663 MW | 2,334 MW | 0.9522 |

- Weather cuts day-ahead error by ~31% (60% on the highest-demand hours).
- Optimiser (10% flexible load, max 3 h shift, 2,000 MW safety margin), applied to actual demand: **~47% less energy above the grid limit**, yearly maximum 80.8 → 78.1 GW.
- Assumptions: share of flexible load (not in the data), ERA5 observed weather stands in for a weather forecast, peak threshold is a statistical stand-in for real grid capacity.

## Data sources & licences
- Demand: [Grid-Sentinel / India Power Grid — NLDC Daily PSP Reports](https://github.com/HalcyonVector/Grid-Sentinel) (CC BY-SA 4.0), originally from NLDC / Grid-India.
- Weather: ERA5 reanalysis (Copernicus Climate Change Service), retrieved via the Open-Meteo historical API.
