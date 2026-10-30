# Third-party notices

## Models.dev provider and model catalog

Atlas bundles a derived copy of provider and model metadata from the [Models.dev API](https://models.dev/api.json), retrieved on 2026-10-30. The upstream repository describes the catalog as community-maintained and publishes it under the MIT License. The catalog sync script is `scripts/sync-provider-catalog.mjs`.

```text
MIT License

Copyright (c) 2025 models.dev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Model prices, endpoints, capabilities and provider availability are reference metadata. They can change, and actual billing and access depend on the provider account and its current terms.

## OpenCode free-model behavior reference

Atlas uses OpenCode as an internal runtime, not as the user-facing provider directory. OpenCode's [model documentation](https://opencode.ai/v2/docs/models/) defines its free OpenCode/OpenCode Go models as those with no input price, notes that `OPENCODE_DISABLE_FREE_MODELS` can hide them, and says the OpenCode provider is unavailable while signed out unless a Console account is connected or `OPENCODE_API_KEY` is configured. Its [provider documentation](https://opencode.ai/v2/docs/providers/) describes its model catalog and provider connection behavior. Atlas therefore prioritizes a runtime-reported OpenCode model only when the provider is connected and its catalog reports zero input price; this does not guarantee eligibility, quota, or continued free availability.
