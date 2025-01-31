import { experimentSettingsJson } from "./experimentSettings.ts";
import { useJsonState } from "./globalState.ts";
import { pictureNamingTask } from "./pictureNamingTask.ts";
import { $ExperimentResults, $Settings } from "./schemas.ts";
import { translator } from "./translator.ts";

import type { Language } from "/runtime/v1/@opendatacapture/runtime-core";

import "/runtime/v1/jspsych@8.x/css/jspsych.css";

import { z } from "/runtime/v1/zod@3.23.x";

const { defineInstrument } = await import(
  "/runtime/v1/@opendatacapture/runtime-core/index.js"
);
// the ODC playground uses the index.ts file while deploying locally used main.ts
// this next block allows the program to read from the json rather than the csv files
if (!useJsonState.value) {
  useJsonState.set = true;
}

export default defineInstrument({
  kind: "INTERACTIVE",
  language: experimentSettingsJson.language as Language,
  internal: {
    edition: 1,
    name: "PictureNamingTask",
  },
  tags: ["interactive", "jsPysch", "PictureNamingTask"],
  content: {
    async render(done) {
      const settingsParseResult = $Settings.safeParse(experimentSettingsJson);

      // parse settings
      if (!settingsParseResult.success) {
        throw new Error("validation error, check experiment settings", {
          cause: settingsParseResult.error,
        });
      }

      translator.init();
      translator.changeLanguage(settingsParseResult.data.language as Language);
      await pictureNamingTask(done);
    },
  },
  details: {
    description: "A jsPysch implementation of the Boston Naming Task",
    estimatedDuration: 1,
    instructions: ["<PLACEHOLDER>"],
    license: "Apache-2.0",
    title: "Picture Naming Task",
  },
  measures: {},
  validationSchema: z.object({
    version: z.string(),
    timestamp: z.string(),
    experimentResults: z.array($ExperimentResults),
  }),
});
