# VunaLink model training

Reproducible training for VunaLink's on-device tomato disease model. It is separate
from the Next.js app; nothing here runs in the browser.

## Scope: tomato, 4 classes

| Class id | Label | App behaviour |
|---|---|---|
| 0 | `Tomato___Early_blight` | Diagnosis + guidance |
| 1 | `Tomato___Late_blight` | Diagnosis + guidance |
| 2 | `Tomato___healthy` | "Appears healthy" + monitoring advice |
| 3 | `Tomato___other` | **Ask an agent**: another tomato problem the app doesn't advise on |

"Other" is sampled evenly from the 7 remaining PlantVillage tomato diseases (bacterial
spot, leaf mold, Septoria, spider mites, target spot, yellow leaf curl, mosaic virus), so
the model can recognise "not one of the three" instead of forcing a wrong diagnosis.
Class ids follow alphabetical folder order, which is what Keras uses.

The app also routes to an agent when the top probability is below the **unsure
threshold**. Confidence is temperature-calibrated on validation data, and the
temperature is folded into the final layer, so the exported model already outputs
calibrated probabilities.

## Training on Kaggle (recommended)

Open `notebooks/kaggle_retrain_tomato.ipynb` on Kaggle with GPU and Internet on, and run
all cells. It finds or downloads PlantVillage and PlantDoc, trains, evaluates on both,
exports ONNX (plus an optional INT8 model) and zips the results. The last cell lists
where each file goes in the app.

Don't `pip install -r ml/requirements.txt` on Kaggle: Kaggle's TensorFlow is already
installed and the pins can change NumPy under it.

## Training locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
python ml/download_plantvillage.py --data-dir ml/data/tfds --output-dir ml/data/plant_village
python ml/prepare_field_eval.py --source-dir path/to/PlantDoc-Dataset --output-dir ml/data/field
python ml/prepare_dataset.py --source-dir ml/data/plant_village --output-dir ml/data/split --field-dir ml/data/field
python ml/train.py --data-dir ml/data/split --output-dir ml/artifacts --version 0.3.0
python ml/evaluate.py --model ml/artifacts/model.keras --data-dir ml/data/field/test --metadata ml/artifacts/model_metadata.json --dataset-name PlantDoc --output ml/artifacts/evaluation_field.json
python ml/export_onnx.py --model ml/artifacts/model.keras --saved-model ml/artifacts/saved_model --output ml/artifacts/vunalink-mobilenet-v2.onnx --check-dir ml/data/split/test
python ml/create_references.py --model ml/artifacts/model.keras --metadata ml/artifacts/model_metadata.json --test-dir ml/data/split/test --output-dir ml/evaluation/references
```

Optional INT8 model for low-end phones (about a quarter of the size; check its accuracy
in the report and test it in the browser before shipping):

```bash
python ml/quantize_onnx.py --model ml/artifacts/vunalink-mobilenet-v2.onnx --output ml/artifacts/vunalink-mobilenet-v2.int8.onnx --calibration-dir ml/data/split/validation --test-dir ml/data/field/test --classes ml/artifacts/model_metadata.json
```

`prepare_dataset.py` and `prepare_field_eval.py` search the source folder recursively
and match class folders by name regardless of underscores and capitals, so the TFDS
export, the original Kaggle PlantVillage copies (including ones already split into
train/val folders, which are pooled and re-split) and PlantDoc all work. Grayscale and
segmented PlantVillage variants are skipped. Don't point them at augmented copies of
PlantVillage: near-duplicate images would leak between train and test.

## Field photos (PlantDoc)

`prepare_field_eval.py` pools all PlantDoc tomato images (its own test folder has only
~69), removes duplicates and splits them 60/15/25 into `field/train`, `field/validation`
and `field/test`, stratified by PlantDoc disease. With `--field-dir`, `prepare_dataset.py`
adds field train photos (each repeated `train_repeat` times) and field validation photos
to the training data. `field/test` is never trained on and is the field estimate.
The PlantVillage test split stays lab-only, so lab numbers stay comparable.

`artifacts/baseline_v0.2.0_field_test.json` is the v0.2.0 model (trained on lab photos
only) scored on the same field test photos: 25.1% accuracy, and 18% of its answers right
at its 0.74 threshold. Newer models should be compared with that.

PlantDoc is CC BY 4.0: credit "PlantDoc (Singh et al., 2020)" wherever results are shown.

## What training does

1. Trains a new head on frozen ImageNet MobileNetV2, with class weights and field-style
   augmentation (flips, rotation, zoom, shifts, brightness, contrast, and saturation
   and blur when the Keras version has them).
2. Fine-tunes the top `fine_tune_layers` layers at a low learning rate (BatchNorm stays frozen).
3. Fits a temperature on the validation split and folds it into the classifier.
4. Picks the lowest threshold (at least `min_threshold`) at which answered validation
   predictions reach `target_answered_accuracy`.
5. Evaluates on the held-out test split.

The saved and exported model is an inference copy with the same weights but no
augmentation layers, so the ONNX file contains no random ops.

All settings are in `class_config.json`.

## Outputs

- `model.keras`, `saved_model/`: trained model (gitignored, large).
- `vunalink-mobilenet-v2.onnx` (+ `.onnx.metadata.json`): the app's model, with a Keras-vs-ONNX parity check on real test images.
- `model_metadata.json`: classes, input format, temperature, unsure threshold, training settings and counts.
- `class_mapping.json`: class id → label → app `diseaseId`.
- `evaluation.json` (PlantVillage test) and `evaluation_field.json` (PlantDoc): accuracy,
  macro precision/recall/F1, per-class metrics, confusion matrix, classes ranked by F1,
  unsure-routing metrics (share answered, answered accuracy, share of "other" routed to
  an agent) and a threshold sweep.

## Shipping a new model to the app

1. Copy `vunalink-mobilenet-v2.onnx`, `class_mapping.json` and `model_metadata.json` to `public/models/`.
2. In `lib/ml/model.ts`, update `version` and `UNSURE_THRESHOLD` to match `model_metadata.json`.
3. Bump `CACHE_NAME` in `public/sw.js` so installed apps fetch the new model.
4. Run `npm test`. It fails if the app's labels, threshold or version don't match `public/models/model_metadata.json`.

## Honest reporting

PlantVillage is curated lab imagery; its metrics are not field accuracy. Report the
PlantDoc numbers as the field estimate, and treat even those as a proxy: PlantDoc photos
are not from Rwanda. The unsure threshold chosen on PlantVillage validation is
optimistic, so check it against the PlantDoc threshold sweep. Representative Rwandan
field photos and an independent evaluation are needed before deployment claims. Check
the PlantDoc licence before redistributing its images.
