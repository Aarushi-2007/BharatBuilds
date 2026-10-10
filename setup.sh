#!/usr/bin/env bash
# One-time setup for macOS / Linux:  bash setup.sh
set -e
cd "$(dirname "$0")"

echo "==> Checking Python"
python3 -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ is required"; print("Python", sys.version.split()[0], "OK")'

if [[ "$OSTYPE" == darwin* ]]; then
  if command -v brew >/dev/null 2>&1; then
    echo "==> Installing libomp (needed by XGBoost on macOS)"
    brew list libomp >/dev/null 2>&1 || brew install libomp
  else
    echo "!! Homebrew not found. Install it from https://brew.sh, then run: brew install libomp"
  fi
fi

echo "==> Creating virtual environment in .venv"
python3 -m venv .venv
source .venv/bin/activate

echo "==> Installing packages"
pip install --upgrade pip
pip install -r ml/requirements.txt

echo "==> Checking imports"
python -c "import pandas, numpy, sklearn, xgboost, scipy, joblib, matplotlib; print('All packages OK | xgboost', xgboost.__version__, '| scikit-learn', sklearn.__version__)"

echo ""
echo "Done. Next: open this folder in VS Code (code .) and run ml/Weather_Aware_Demand_Forecasting.ipynb"
