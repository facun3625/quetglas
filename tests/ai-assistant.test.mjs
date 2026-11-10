import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { loader } from "./helpers/loader.mjs";

function load(relativePath) {
  const source = readFileSync(relativePath, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(module, exports) {${code}\n})`)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

// availability importa el nombre de la tienda: se carga con el cargador compartido, que resuelve "@/..."
const availability = loader()("@/lib/ai/availability");
const validation = load("src/lib/ai/validation.ts");
const prompt = load("src/lib/ai/prompt.ts");

const baseSchedule = {
  aiHumanHandoffEnabled: true,
  aiHumanDays: [1, 2, 3, 4, 5, 6],
  aiHumanStartTime: "09:00",
  aiHumanEndTime: "18:00",
  whatsappPhone: "+54 9 342 123-4567",
};

test("human handoff is offered only during configured local hours", () => {
  const mondayNoon = new Date("2026-09-28T15:00:00.000Z");
  const mondayEvening = new Date("2026-09-28T22:00:00.000Z");
  const open = availability.getHumanSellerAvailability(baseSchedule, mondayNoon);
  const closed = availability.getHumanSellerAvailability(baseSchedule, mondayEvening);
  assert.equal(open.available, true);
  assert.match(open.whatsappUrl, /^https:\/\/wa\.me\/5493421234567/);
  assert.equal(closed.available, false);
  assert.equal(closed.whatsappUrl, null);
});

test("overnight handoff uses the prior configured day after midnight", () => {
  const schedule = {
    ...baseSchedule,
    aiHumanDays: [1],
    aiHumanStartTime: "20:00",
    aiHumanEndTime: "02:00",
  };
  assert.equal(
    availability.getHumanSellerAvailability(schedule, new Date("2026-09-29T04:00:00.000Z")).available,
    true,
  );
  assert.equal(
    availability.getHumanSellerAvailability(schedule, new Date("2026-09-29T06:00:00.000Z")).available,
    false,
  );
});

test("human handoff stays disabled without a WhatsApp number", () => {
  const result = availability.getHumanSellerAvailability(
    { ...baseSchedule, whatsappPhone: null },
    new Date("2026-09-28T15:00:00.000Z"),
  );
  assert.equal(result.enabled, false);
  assert.equal(result.available, false);
  assert.equal(result.whatsappUrl, null);
});

test("older cached settings fall back safely when schedule fields are missing", () => {
  const result = availability.getHumanSellerAvailability(
    { whatsappPhone: "5493421234567" },
    new Date("2026-09-28T15:00:00.000Z"),
  );
  assert.equal(result.enabled, true);
  assert.equal(result.available, true);
  assert.match(result.scheduleText, /09:00 a 18:00/);
});

test("assistant request accepts UUID sessions and bounds user messages", () => {
  const valid = validation.parseAssistantRequest({
    sessionId: "00000000-0000-4000-8000-000000000001",
    message: "  Busco un vestido negro  ",
  });
  assert.equal(valid.message, "Busco un vestido negro");
  assert.equal(
    validation.parseAssistantSessionId("00000000-0000-4000-8000-000000000001"),
    "00000000-0000-4000-8000-000000000001",
  );
  assert.throws(() => validation.parseAssistantRequest({ sessionId: "bad", message: "hola" }), /Sesión/);
  assert.throws(
    () => validation.parseAssistantRequest({
      sessionId: "00000000-0000-4000-8000-000000000001",
      message: "x".repeat(601),
    }),
    /demasiado largo/,
  );
});

test("custom sales instructions cannot replace catalog safety rules", () => {
  const result = prompt.buildAssistantInstructions("Priorizá la nueva colección.");
  assert.match(result, /Las herramientas son la única fuente válida/);
  assert.match(result, /Priorizá la nueva colección/);
  assert.match(result, /WhatsApp/);
  assert.match(result, /dirección, contacto, Instagram/);
  assert.match(result, /get_store_options/);
});
