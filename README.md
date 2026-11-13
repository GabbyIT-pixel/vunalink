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

The browser model is `public/models/vunalink-mobilenet-v2.onnx`, version `0.4.0` (8.9 MB). It is a MobileNetV2 classifier fine-tuned on PlantVillage images (tomato, plus potato and other crops as "other") and PlantDoc field photos, and executed with `onnxruntime-web`.

- Input: `224 × 224 × 3`, RGB, `float32`, NHWC.
- Output: four `float32` temperature-calibrated softmax probabilities.
- Classes (in output order): tomato early blight, tomato late blight, tomato healthy, and "other": anything the app doesn't diagnose (the seven other PlantVillage tomato diseases, potato, other crops, photos without leaves). "Other" has no treatment guidance; it always routes to an agent. The class is still named `Tomato___other`.
- Unsure rule: if the top class is "other", or its probability is below **0.95**, the app shows "Ask an extension agent" instead of a diagnosis. The threshold is in `lib/ml/model.ts` and must match `public/models/model_metadata.json`; a test checks this.
- Browser preprocessing: resize to 224 × 224, read RGB pixels, and pass raw values in NHWC order. The MobileNetV2 formula `(pixel / 127.5) - 1` is embedded in the graph and must not be applied again.
- Runtime: ONNX Runtime Web using local WebAssembly assets.
- Metadata and mapping: `public/models/model_metadata.json` and `public/models/class_mapping.json`.

### Results

Measured on held-out photos that were never used for training:

| | Lab photos (PlantVillage, 1,149) | Field photos (PlantDoc, 306) |
|---|---|---|
| Accuracy | 94.5% (v0.3.0: 86.0%) | 74.8% (v0.3.0: 74.2%) |
| Potato photos sent to an agent | 98% (v0.3.0: 54%) | 89% (v0.3.0: 59%) |
| Other-crop photos sent to an agent | 99% (v0.3.0: 85%) | 98% (v0.3.0: 89%) |
| Wrong diagnoses shown | 6 (v0.3.0: 69) | 9 (v0.3.0: 32) |
| Answers that are right, at the threshold | 98.9% | 65.4% (26 answered) |

Both models were scored on the same photos. v0.4.0 is much safer than v0.3.0: it sends most potato and other-crop photos to an agent and shows far fewer wrong diagnoses. The cost is that it answers fewer real tomato field photos directly (17 correct direct answers on the 66 supported tomato field photos, against 43 for v0.3.0, which also gave 32 wrong ones). Field photos are from PlantDoc (CC BY 4.0, Singh et al., 2020): web photos, not Rwandan farms, and from the same source as the field training photos, so they are an optimistic proxy. Independent validation on Rwandan farm photos is still required. Full details are in [`ml/README.md`](ml/README.md) and `ml/artifacts/`.

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

- Tomato only. The model diagnoses tomato early blight, late blight and healthy leaves; everything else should go to an agent, but not always: some potato photos still get a tomato result (on a 10-photo team check, a healthy potato leaf was called healthy tomato at 97%), and it can confidently misclassify tomato diseases it has never seen (a leaf that looks like powdery mildew was called late blight).
- On real tomato field photos it often says "not sure" rather than diagnosing (about a quarter get a correct direct answer on PlantDoc). It needs labelled tomato photos from Rwandan farms to do better.
- Photos without leaves (people, documents, fruit) are trained into "other" from PlantVillage's background folder and usually go to an agent, but this is not guaranteed.
- Field accuracy is measured on PlantDoc web photos, not Rwandan farms. Independent Rwanda field validation is required before any field-accuracy claim.
- The new "ask an agent" texts and the testing notice in Kinyarwanda need review by a native speaker or agronomist.
- Browser inference depends on WebAssembly support, available memory, device speed, and storage quota. Universal device compatibility is not claimed.
- The PWA shell and model are designed for offline use after caching, but offline behavior still varies by browser and phone.
- Recommendations are general knowledge-base guidance, not a confirmed diagnosis or a substitute for an agricultural extension worker. No pesticide dosage or chemical application rate is provided.
- History is local to the browser/device. There is no account, cloud backup, synchronization, or backend.
- The optional local LLM layer is not enabled; it is not required for disease results or recommendations.
