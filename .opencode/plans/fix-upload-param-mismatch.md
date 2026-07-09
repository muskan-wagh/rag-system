# Fix: Upload route param `:uuid` mismatch with validation schema

## Root Cause

Route `POST /upload/:uuid` uses param name `:uuid`, but `idParamSchema` expects field `id`. Zod validates `req.params.id` which is `undefined` → "expected string, received undefined".

## Changes Required

### 1. `backend/src/routes/uploadRoutes.ts:23`

Change route param from `:uuid` to `:id`:

```diff
-router.post('/upload/:uuid', validate(idParamSchema, 'params'), upload.single('resume'), uploadResumeHandler);
+router.post('/upload/:id', validate(idParamSchema, 'params'), upload.single('resume'), uploadResumeHandler);
```

### 2. `backend/src/controllers/uploadController.ts:12`

Update param read to match new route param name:

```diff
-  const uuid = req.params.uuid as string;
+  const uuid = req.params.id as string;
```

The internal variable remains named `uuid` — only the source changes.
