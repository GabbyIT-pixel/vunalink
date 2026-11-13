# VunaLink

VunaLink is a mobile-first Progressive Web App for Rwandan smallholder farmers. A farmer photographs a tomato leaf, a disease model runs on the phone, and the app gives simple guidance in Kinyarwanda or English, without sending the photo to a server. When the model is unsure, or the photo shows a problem it doesn't cover, the app gives no diagnosis and tells the farmer to ask an extension agent.

## Features

- Camera capture and image upload for JPG, PNG, and WebP files.
- On-device tomato disease classification: early blight, late blight, healthy, or "other".
- "Ask an extension agent" result instead of a guess for low-confidence photos, other tomato problems, and non-tomato photos.
- Results and guidance in Kinyarwanda and English, switchable on the result screen.
- Offline agricultural recommendations from a bundled knowledge base.
- Diagnosis history stored privately on the device.
- Installable PWA with a service worker and local ONNX Runtime Web assets.
- Optional LLM boundary exists in `lib/ai/`, but no LLM is installed or required.

## Architecture

```text
User → Next.js PWA → image validation and resize → MobileNetV2 ONNX
     → local ONNX Runtime Web / WebAssembly inference → calibrated class probabilities
     → unsure rule (top class "other", or confidence below the threshold → ask an agent)
     → local recommendation knowledge base → Kinyarwanda / English result and guidance
```

The model only predicts disease classes. Recommendations are separate from inference and do not require a language model.

## Offline architecture

The service worker (`public/sw.js`) precaches the core routes, manifest, model, and ONNX Runtime Web assets during installation. Successful same-origin application responses are also cached for later navigation. External requests are not handled by the service worker. Bump `CACHE_NAME` in `public/sw.js` whenever the model changes, so installed apps fetch the new one.

Diagnosis records are stored in an IndexedDB database named `vunalink`, in the `diagnoses` object store. Records contain prediction metadata only; original crop images are not persisted. History can be viewed and cleared offline. Model session state is held in memory and the model itself is loaded from `public/models/`.

Install the app or visit required routes once while online so service-worker caching can complete. Browser support and storage quotas vary by device.

## Machine-learning model

The browser model is `public/models/vunalink-mobilenet-v2.onnx`, version `0.5.0` (8.9 MB). It is a MobileNetV2 classifier fine-tuned on PlantVillage images (tomato, plus potato and other crops as "other") and two field-photo datasets (PlantDoc and a Pakistan smartphone dataset), and executed with `onnxruntime-web`.

- Input: `224 × 224 × 3`, RGB, `float32`, NHWC.
- Output: four `float32` temperature-calibrated softmax probabilities.
- Classes (in output order): tomato early blight, tomato late blight, tomato healthy, and "other": anything the app doesn't diagnose (the seven other PlantVillage tomato diseases, potato, other crops, photos without leaves). "Other" has no treatment guidance; it always routes to an agent. The class is still named `Tomato___other`.
- Unsure rule: if the top class is "other", or its probability is below **0.82**, the app shows "Ask an extension agent" instead of a diagnosis. The threshold is in `lib/ml/model.ts` and must match `public/models/model_metadata.json`; a test checks this.
- Browser preprocessing: resize to 224 × 224, read RGB pixels, and pass raw values in NHWC order. The MobileNetV2 formula `(pixel / 127.5) - 1` is embedded in the graph and must not be applied again.
- Runtime: ONNX Runtime Web using local WebAssembly assets.
- Metadata and mapping: `public/models/model_metadata.json` and `public/models/class_mapping.json`.

### Results

v0.5.0 and the previous model (v0.4.0) scored on the same held-out photos, never used for training (v0.5.0 at its 0.82 threshold, v0.4.0 at 0.95):

| | Lab (PlantVillage, 1,149) | Field: PlantDoc (306) | Field: Pakistan (134) |
|---|---|---|---|
| Accuracy | 96.1% (v0.4.0: 95.9%) | 81.0% (v0.4.0: 74.8%) | 74.6% (v0.4.0: 57.5%) |
| Correct diagnoses on supported tomato photos | 580 of 673 (544) | 18 of 66 (17) | 25 of 63 (3) |
| Wrong diagnoses shown | 3 (3) | 9 (9) | 3 (2) |
| Potato sent to an agent | 99% (98%) | 94% (89%) | none in this set |

On field photos overall, v0.5.0 gives more than twice the correct diagnoses (43 against 20) with about the same number of wrong ones (12 against 11); when it does answer, it is right 78% of the time. Most real tomato field photos still get "Ask an extension agent". Field photos are from PlantDoc (web photos; CC BY 4.0, Singh et al., 2020) and a Pakistan smartphone dataset (picked leaves on white paper; CC BY 4.0), not Rwandan farms, so they are a proxy. Independent validation on Rwandan farm photos is still required. Full details are in [`ml/README.md`](ml/README.md) and `ml/artifacts/`.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Model training runs on Kaggle with `ml/notebooks/kaggle_retrain_tomato.ipynb`. The ML workspace instructions, including how to ship a new model to the app, are in [`ml/README.md`](ml/README.md).

## Project structure

```text
app/                  Next.js pages, layout, manifest, service-worker registration
components/           Reusable UI, navigation, image picker, install prompt
lib/ml/               Model loading, preprocessing, inference, labels, postprocessing, unsure rule
lib/history/          IndexedDB diagnosis history
lib/image/            Shared image validation rules
lib/localization/     Kinyarwanda and English disease information and "ask an agent" guidance
lib/recommendations/  Offline agricultural guidance
public/models/        ONNX model and metadata
public/onnxruntime/   Local ONNX Runtime Web assets
ml/                   Dataset preparation, training, calibration, evaluation, and export scripts
ml/notebooks/         Kaggle training notebook
tests/                Critical application behavior tests
```

## Limitations

- Tomato only. The model diagnoses tomato early blight, late blight and healthy leaves; everything else should go to an agent, but not always: a few potato photos may still get a tomato result (6% of potato field test photos), and it can confidently misclassify tomato diseases it has never seen (a leaf that looks like powdery mildew was called late blight).
- On real tomato field photos it often says "not sure" rather than diagnosing (about a third get a correct direct answer). Early blight is the weakest class on field photos. It needs labelled tomato photos from Rwandan farms to do better.
- Photos without leaves (people, documents, fruit) are trained into "other" from PlantVillage's background folder and usually go to an agent, but this is not guaranteed.
- Field accuracy is measured on PlantDoc web photos, not Rwandan farms. Independent Rwanda field validation is required before any field-accuracy claim.
- The new "ask an agent" texts and the testing notice in Kinyarwanda need review by a native speaker or agronomist.
- Browser inference depends on WebAssembly support, available memory, device speed, and storage quota. Universal device compatibility is not claimed.
- The PWA shell and model are designed for offline use after caching, but offline behavior still varies by browser and phone.
- Recommendations are general knowledge-base guidance, not a confirmed diagnosis or a substitute for an agricultural extension worker. No pesticide dosage or chemical application rate is provided.
- History is local to the browser/device. There is no account, cloud backup, synchronization, or backend.
- The optional local LLM layer is not enabled; it is not required for disease results or recommendations.
