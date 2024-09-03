import { experimentSettingsJson as experimentSettings } from "./experimentSettings.ts";
import { type SupportedLanguage } from "./schemas.ts";

import { createI18Next } from "/runtime/v1/@opendatacapture/runtime-core";

const i18n = createI18Next({
  translations: {
    welcome: {
      en: "Welcome. Press any key to begin",
      fr: "Bienvenue. Appuyez sur n'importe quelle touche pour commencer",
    },
    correctResponse: {
      en: "Correct response:",
      fr: "La réponse correcte est:",
    },
    loadingStimulus: {
      en: "Loading stimulus",
      fr: "Stimulus de chargement",
    },
    logResponse: {
      en: "Log the response",
      fr: "Enregistrer la réponse",
    },
    correct: {
      en: "Correct",
      fr: "Correct",
    },
    incorrect: {
      en: "Incorrect",
      fr: "Incorrect",
    },
    responseWas: {
      en: "The response was:",
      fr: "La réponse a été donnée:",
    },
    logNotes: {
      en: "Log any other notes here",
      fr: "Inscrivez ici toute autre note",
    },
    logResponseToContinue: {
      en: "Log response and press submit to continue",
      fr: "Enregistrez la réponse et appuyez sur 'soumettre' pour continuer",
    },
    submit: {
      en: "Submit",
      fr: "Soumettre",
    },
  },
});

i18n.changeLanguage(experimentSettings.language as SupportedLanguage);
export default i18n;
