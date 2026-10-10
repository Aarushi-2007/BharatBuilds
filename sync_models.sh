#!/usr/bin/env bash
# After re-running the notebooks: copy the freshly trained files into backend/
# and pin the exact package versions they were trained with.   Usage: bash sync_models.sh
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

for f in model.pkl model_dayahead.pkl feature_config.json; do
  [ -f "ml/$f" ] || { echo "ml/$f not found - run Notebook 1 first"; exit 1; }
  cp "ml/$f" backend/models/
  echo "copied ml/$f -> backend/models/"
done
for f in peak_optimizer.py plan_example.json; do
  [ -f "ml/$f" ] && cp "ml/$f" backend/ && echo "copied ml/$f -> backend/"
done

pip freeze | grep -iE "^(pandas|numpy|scikit-learn|xgboost|scipy|joblib)==" > backend/requirements.txt
echo ""
echo "backend/requirements.txt (exact versions your models were trained with):"
cat backend/requirements.txt
