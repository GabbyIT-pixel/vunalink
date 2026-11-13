# VunaLink model training

Reproducible training for VunaLink's on-device tomato disease model. It is separate
from the Next.js app; nothing here runs in the browser.

## Scope: tomato, 4 classes

| Class id | Label | App behaviour |
|---|---|---|
| 0 | `Tomato___Early_blight` | Diagnosis + guidance |
| 1 | `Tomato___Late_blight` | Diagnosis + guidance |
| 2 | `Tomato___healthy` | "Appears healthy" + monitoring advice |
| 3 | `Tomato___other` | **Ask an agent**: anything the app doesn't diagnose |

"Other" holds everything that isn't one of the three supported tomato classes, so the
model can recognise "not one of the three" instead of forcing a wrong diagnosis. From
v0.4.0 its budget (2x the median supported class) is split into groups
(`other_class.groups` in `class_config.json`):

- half: the 7 other PlantVillage tomato diseases (bacterial spot, leaf mold, Septoria,
  spider mites, target spot, yellow leaf curl, mosaic virus);
- a quarter: potato (early blight, late blight, healthy), which looks very like tomato;
- a quarter: every other PlantVillage crop, found automatically, plus photos without
  leaves (`Background_without_leaves`, when the dataset has it).

v0.3.0 only had the tomato diseases in "other", so it called potato leaves tomato: on
PlantDoc field photos it sent only 59% of potato photos to an agent.
The class keeps the name `Tomato___other` so the app's labels don't change.
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

## Current model: v0.5.0

Trained on PlantVillage (tomato, plus potato, other crops and photos without leaves in
"other"), PlantDoc and the Pakistan field dataset (raw photos only; its augmented copies are
skipped). v0.5.0 and the previous app model (v0.4.0) were scored on the same held-out photos:
1,149 lab photos, 306 PlantDoc and 134 Pakistan field photos, none used for training.
v0.5.0 at its 0.82 threshold, v0.4.0 at 0.95.

| | Lab v0.5.0 | Lab v0.4.0 | Field v0.5.0 | Field v0.4.0 |
|---|---|---|---|---|
| Accuracy | 96.1% | 95.9% | 79.1% | 69.5% |
| Macro F1 | 0.95 | 0.95 | 0.66 | 0.53 |
| Correct diagnoses (supported tomato photos) | 580 of 673 | 544 of 673 | 43 of 129 | 20 of 129 |
| Wrong diagnoses shown | 3 | 3 | 12 | 11 |
| Answers right / photos answered | 99.5% / 51% | 99.5% / 48% | 78.2% / 12.5% | 64.5% / 7.0% |
| Potato sent to an agent | 99% | 98% | 94% | 89% |
| Other crops sent to an agent | 99% | 99% | 98.5% | 98.5% |

Per field dataset (correct diagnoses / wrong ones): PlantDoc 18 / 9 (v0.4.0: 17 / 9),
Pakistan 25 / 3 (v0.4.0: 3 / 2). The gain is mostly on the Pakistan-style photos (picked
leaves on white paper); PlantDoc web photos barely changed. Early blight remains the weakest
class on field photos (recall 0.27 on PlantDoc, 0.48 on Pakistan).

The Pakistan download is about 7,200 images, but most are augmented copies; only about 530
raw photos are used.

The unsure threshold is **0.82**, chosen automatically on the 262 field validation photos
(lowest threshold with at least 80% of answers right). On the field test, 0.90 would cut
wrong answers from 12 to 4 but drop correct ones from 43 to 34; change both
`model_metadata.json` and `lib/ml/model.ts` if the team prefers that.

Comparison files: `artifacts/baseline_v0.4.0_lab_test.json` and
`artifacts/baseline_v0.4.0_field_test.json`.

Field numbers are from PlantDoc (web photos, small test set, same source as the field training
photos), so they are an optimistic proxy for Rwandan farms, not a substitute for local testing.

## Field photos (PlantDoc)

`prepare_field_eval.py` pools all PlantDoc tomato images (its own test folder has only
~69), plus its potato, squash powdery mildew and bell pepper photos as "other", removes duplicates and splits them 60/15/25 into `field/train`, `field/validation`
and `field/test`, stratified by PlantDoc disease. With `--field-dir`, `prepare_dataset.py`
adds field train photos (each repeated `train_repeat` times) and field validation photos
to the training data. `field/test` is never trained on and is the field estimate.
The PlantVillage test split stays lab-only, so lab numbers stay comparable.

The notebook scores the model currently in the app (`public/models`) on the same lab and
field test photos as the new model, so every comparison is like for like. Earlier
baselines on the tomato-only field test: v0.2.0 25.1% accuracy
(`artifacts/baseline_v0.2.0_field_test.json`), v0.3.0 74.9%.

PlantDoc is CC BY 4.0: credit "PlantDoc (Singh et al., 2020)" wherever results are shown.

## Extra field photos (public datasets or your own farm photos)

Real field photos of tomato are what the model is shortest of: v0.4.0 answers only about a
quarter of real tomato field photos correctly and calls some late blight early blight. Any
folder of labelled field photos can be added:

1. Arrange the photos as **one folder per class**. The folder name sets the label: a name
   containing "early blight", "late blight" or "healthy" becomes that class; any other
   folder (other diseases, other crops) becomes "other". Train/test subfolders are fine.
2. Upload it to Kaggle as a dataset (**+ Create → New Dataset**) and attach it to the notebook.
3. Run the notebook. It finds the dataset by itself (or list it in `EXTRA_FIELD_DIRS`) and
   prints which folder went to which class: **check that list before training.**

Each dataset is split on its own (60/15/25), so its test photos are never trained on and
PlantDoc's test photos stay the same; the notebook reports results per dataset. Extra
datasets are repeated once in training (`field_eval.train_repeat`), PlantDoc three times.
Folders with "augment" in the name are skipped, since augmented copies leak between splits.

Public field datasets worth adding (both CC BY 4.0; credit them when you show results):

- [Tomato Leaf Disease Classification Dataset in Pakistan](https://data.mendeley.com/datasets/3mbnb82mxd)
  (used from v0.5.0): about 7,200 images, but mostly augmented copies; about 530 raw
  smartphone photos of picked leaves on white paper. Early blight, late blight, healthy,
  Septoria, leaf mold, yellow leaf curl virus.
- [Tomato Leaf Disease Classification Dataset (Bangladesh)](https://data.mendeley.com/datasets/jttrv2w27r):
  2,995 photos; early blight 524, late blight 112, healthy 380, plus four other problems.

Your own farm photos go in the same way, and are the most valuable: they look like what
Rwandan farmers will photograph.

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
  an agent), routing per "other" group (tomato diseases, potato, other crops, no leaf)
  and per source folder, and a threshold sweep. `evaluate.py` also accepts an `.onnx`
  file, to score the model in the app.

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
