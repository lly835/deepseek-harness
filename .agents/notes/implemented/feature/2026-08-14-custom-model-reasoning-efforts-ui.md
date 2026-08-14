# Agent Note: Custom model rows edit reasoning efforts

Status: implemented

English | [中文](2026-08-14-custom-model-reasoning-efforts-ui.zh.md)

## Problem

`llm-pi-ai` already lets each configured model declare `reasoningEfforts`, and the composer renders a reasoning-effort selector from the exact model capability returned by the adapter. A hand-declared model has no installed catalog entry to inherit that capability from, so omitting `reasoningEfforts` makes the model non-reasoning from the Harness point of view and the composer has no effort control to show.

The Models settings page could edit a pi-ai model's id, name, context window, and maximum output tokens, but not its reasoning declaration. Users adding a reasoning model such as a newer model behind an OpenAI-compatible gateway therefore had to leave the UI and edit `settings.yaml` by hand even though the backend schema and dispatch path already supported the field.

A provider-level effort control is not the solution: models under one provider may support different levels and wire spellings. The declaration belongs on the model row that owns the capability.

## Decision

The pi-ai model-list editor exposes `reasoningEfforts` inside each model row's advanced disclosure. It offers pi-ai's provider-neutral level vocabulary in escalation order: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`.

Selecting a non-off level adds it to the model's declaration and initially uses the level name as its wire spelling. The adjacent wire-value field can then be changed for gateways whose protocol uses another spelling. `off` becomes selectable only after at least one thinking level exists; its wire value may be left empty, which stores `null` and preserves the adapter's existing "supported, send no effort value" semantics. Removing the last non-off level removes the whole declaration, including `off`, and returns the row to the inherited/undeclared state instead of materializing an invalid off-only map.

The editor preserves model fields it does not own. Existing `reasoningEfforts: false` and hand-written declarations remain untouched until the user edits the reasoning controls; beginning an explicit level declaration replaces the non-reasoning flag with that declaration. Empty non-off wire values are not committed because the adapter rejects them.

This change does not add provider-specific GLM, DeepSeek, or OpenAI behavior and does not change `dsh-llm` or `llm-pi-ai` dispatch. The user declares what the actual endpoint supports. Provider/model compatibility switches such as `compat.thinkingFormat` remain separate configuration because they describe how a protocol transports reasoning rather than which effort choices a model offers.

## Verification

A focused jsdom test renders the real `ModelListEditor` and pins declaration creation, unrelated-field preservation, custom wire spellings, the nullable `off` value, rejection of empty non-off wire edits, and returning to inheritance when the last thinking level is removed. Existing `llm-pi-ai` catalog tests continue to own schema and dispatch validation for `reasoningEfforts`.

## Alternatives considered

**Add one provider-level reasoning dropdown.** Rejected because a route can contain models with different supported levels and different wire maps; one value would be valid for some models and invalid for others.

**Automatically mark every custom model as reasoning-capable.** Rejected because model-list discovery does not report a portable reasoning contract. Guessing capabilities would expose controls that can make requests fail at the provider.

**Hard-code GLM reasoning levels.** Rejected because the page configures arbitrary pi-ai routes and gateways, and GLM deployments themselves may use different compatibility layers. The existing per-model declaration is the correct source of truth.

## Consequences

A hand-declared reasoning model can now be fully declared from the Models page, after which the existing composer selector can expose its configured effort choices. Users no longer need to edit `settings.yaml` merely to add or rename per-model effort levels. The UI remains declarative: it does not probe or certify that an endpoint truly accepts the levels or wire values the user enters.
