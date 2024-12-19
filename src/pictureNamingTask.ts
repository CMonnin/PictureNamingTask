import type { Language } from "@opendatacapture/runtime-v1/@opendatacapture/runtime-core/index.js";

import { transformAndDownload, transformAndExportJson } from "./dataMunger.ts";
import { experimentSettingsJson } from "./experimentSettings.ts";
import { experimentSettingsCSV, imageDbCSV } from "./fetchAndParse.ts";
import { useJsonState } from "./globalState.ts";
import i18n from "./i18n.ts";
import {
  $ExperimentImage,
  $Settings,
  type ExperimentImage,
  type LoggingTrial,
  type ParticipantResponse,
  type RepeatTrial,
  type Settings,
} from "./schemas.ts";
import { stimuliPaths } from "./stimuliPaths.ts";

import "./instructions.css";

import { HtmlButtonResponsePlugin } from "/runtime/v1/@jspsych/plugin-html-button-response@2.x";
import { HtmlKeyboardResponsePlugin } from "/runtime/v1/@jspsych/plugin-html-keyboard-response@2.x";
import { ImageKeyboardResponsePlugin } from "/runtime/v1/@jspsych/plugin-image-keyboard-response@2.x";
import { PreloadPlugin } from "/runtime/v1/@jspsych/plugin-preload@2.x";
import { SurveyHtmlFormPlugin } from "/runtime/v1/@jspsych/plugin-survey-html-form@2.x";
import { SurveyTextPlugin } from "/runtime/v1/@jspsych/plugin-survey-text@2.x";
import { DOMPurify } from "/runtime/v1/dompurify@3.x";
import { initJsPsych } from "/runtime/v1/jspsych@8.x";
import { JsPsych } from "/runtime/v1/jspsych@8.x";
import PureRand, {
  uniformIntDistribution,
  xoroshiro128plus,
} from "/runtime/v1/pure-rand@6.x";

export async function pictureNamingTask(onFinish?: (data: any) => void) {
  //****************************
  //****EXPERIMENT_SETTINGS*****
  //****************************
  // variables for controlling advancementSchedule, regressionSchedule, and when the experiment is finished
  //
  // can be read from either the csv files in public/ or via json if using the instrument playground
  let shouldRepeatTrial = false;
  let numberOfCorrectAnswers = 0;
  let numberOfTrialsRun = 1;
  let settingsParseResult;
  let imageDBParseResult;
  let includeParticipantID = false;
  if (useJsonState.value) {
    settingsParseResult = $Settings.safeParse(experimentSettingsJson);
    imageDBParseResult = $ExperimentImage.array().safeParse(stimuliPaths);
  } else {
    settingsParseResult = $Settings.safeParse(experimentSettingsCSV);
    imageDBParseResult = $ExperimentImage.array().safeParse(imageDbCSV);
    includeParticipantID = true;
  }

  if (!settingsParseResult.success) {
    throw new Error("validation error, check experiment settings", {
      cause: settingsParseResult.error,
    });
  }
  if (!imageDBParseResult.success) {
    throw new Error("validation error, check imageDB", {
      cause: imageDBParseResult.error,
    });
  }
  const imageDB = imageDBParseResult.data;
  const {
    totalNumberOfTrialsToRun,
    advancementSchedule,
    regressionSchedule,
    language,
    numberOfLevels,
    downloadOnFinish,
    initialDifficulty,
  } = settingsParseResult.data;
  let seed: number | undefined;
  if (typeof settingsParseResult.data.seed === "number") {
    seed = settingsParseResult.data.seed;
  }

  // small hack to get around i18n issues with wait for changeLanguage
  i18n.changeLanguage(language as Language);
  await new Promise(function(resolve) {
    i18n.onLanguageChange = resolve;
  });

  /*
functions for generating
experimentStimuli
*/

  const indiciesSelected = new Set();
  let rng: PureRand.RandomGenerator;
  if (seed) {
    rng = xoroshiro128plus(seed);
  } else {
    seed = Date.now() ^ (Math.random() * 0x100000000);
    rng = xoroshiro128plus(seed);
  }

  // closure
  function getRandomElementWithSeed(
    array: ExperimentImage[],
  ): ExperimentImage[] {
    let randomIndex: number;
    let foundUnique = false;

    // if all images have been shown clear the set
    if (indiciesSelected.size === array.length) {
      indiciesSelected.clear();
    }

    do {
      const [newRandomIndex, newRng] = uniformIntDistribution(
        0,
        array.length - 1,
        rng,
      );
      rng = newRng;
      randomIndex = newRandomIndex;

      if (!indiciesSelected.has(randomIndex)) {
        indiciesSelected.add(randomIndex);
        foundUnique = true;
      }
    } while (!foundUnique);

    const result = [array[randomIndex]!];
    return result;
  }

  // draw an image at random from the bank depending on the difficulty_level selected
  // closure
  function createStimuli(
    difficultyLevel: number,
    language: string,
    clearSet: boolean,
  ): ExperimentImage[] {
    if (clearSet === true) {
      indiciesSelected.clear();
    }
    let imgList: ExperimentImage[] = imageDB.filter(
      (image) =>
        image.difficultyLevel === difficultyLevel &&
        image.language === language,
    );
    let result = getRandomElementWithSeed(imgList);
    return result;
  }

  // to handle clicks on a touchscreen as a keyboard response

  function simulateKeyPress(jsPsych: JsPsych, key: string) {
    jsPsych.pluginAPI.keyDown(key);
    jsPsych.pluginAPI.keyUp(key);
  }

  //****************************
  //********EXPERIMENT**********
  //****************************
  // a timeline is a set of trials
  // a trial is a single object eg htmlKeyboardResponse etc ...
  const timeline: any[] = [];

  (function() {
    let experimentStimuli = createStimuli(initialDifficulty, language, false);
    let currentDifficultyLevel = initialDifficulty;
    const jsPsych = initJsPsych({
      on_finish: function() {
        const data = jsPsych.data.get();
        const settings: Settings = {
          totalNumberOfTrialsToRun,
          advancementSchedule,
          regressionSchedule,
          language,
          numberOfLevels,
          downloadOnFinish,
          initialDifficulty,
          seed,
        };
        if (downloadOnFinish) {
          transformAndDownload(data, settings);
        }
        if (onFinish) {
          onFinish(transformAndExportJson(data, settings));
        }
      },
    });

    const welcome = {
      on_start: function() {
        const handleClick = () => simulateKeyPress(jsPsych, "a");
        document.addEventListener("click", handleClick, { once: true });
      },
      on_finish: function() {
        const handleClick = () => simulateKeyPress(jsPsych, "a");
        document.removeEventListener("click", handleClick);
      },
      stimulus: i18n.t("welcome"),
      type: HtmlKeyboardResponsePlugin,
    };

    const particpantIDPage = {
      questions: [
        {
          prompt: i18n.t("enterID"),
        },
      ],
      button_label: i18n.t("continue"),
      type: SurveyTextPlugin,
    };

    const instructions = {
      stimulus: function() {
        const html = `
          <div class="instructions-container">
           <div class="instructions-content">
            <h1>${i18n.t("task.title")}</h1>
             <div class="instructions-intro">
              <p>${i18n.t("task.intro")}</p>
             </div>
            <ul class="instructions-steps">
              <li class="instructions-step">${i18n.t("task.step1")}</li>
              <li class="instructions-step">${i18n.t("task.step2")}</li>
              <li class="instructions-step">${i18n.t("task.step3")}</li>
              <li class="instructions-step">${i18n.t("task.step4")}</li>
              <li class="instructions-step">${i18n.t("task.step5")}</li>
              <li class="instructions-step">${i18n.t("task.step6")}</li>
              <li class="instructions-step">${i18n.t("task.step7")}</li>
            </ul>
            <div class="instructions-completion">
              <p>${i18n.t("task.completion")}</p>
            </div>
          </div>
        </div>
        `;
        return html;
      },
      choices: [i18n.t("continue")],
      type: HtmlButtonResponsePlugin,
    };
    const preload = {
      auto_preload: true,
      message: `<p>loading stimulus</p>`,
      show_progress_bar: true,
      type: PreloadPlugin,
    };
    const pageBeforeImage = {
      stimulus: i18n.t("continueToShowImage"),
      choices: [i18n.t("continue")],
      type: HtmlButtonResponsePlugin,
    };
    const pageAfterImage = {
      stimulus: i18n.t("passToTA"),
      choices: [i18n.t("continue")],
      type: HtmlButtonResponsePlugin,
    };

    const blankPage = {
      stimulus: "",
      choices: "NO_KEYS",
      trial_duration: 500,
      type: HtmlKeyboardResponsePlugin,
    };
    const showImg = {
      on_start: function() {
        const handleClick = () => simulateKeyPress(jsPsych, "a");
        document.addEventListener("click", handleClick, { once: true });
      },
      on_finish: function() {
        const handleClick = () => simulateKeyPress(jsPsych, "a");
        document.removeEventListener("click", handleClick);
      },
      stimulus: jsPsych.timelineVariable("stimulus"),
      stimulus_height: 600,
      type: ImageKeyboardResponsePlugin,
    };

    const logging = {
      autofocus: "textBox",
      button_label: i18n.t("submit"),
      data: function() {
        const rt = jsPsych.data
          .get()
          .filter({ trial_type: "image-keyboard-response" })
          .last()
          .select("rt").values[0] as string;

        return {
          stimulus: jsPsych.timelineVariable("stimulus"),
          correctResponse: jsPsych.timelineVariable("correctResponse"),
          difficultyLevel: jsPsych.timelineVariable("difficultyLevel"),
          language: jsPsych.timelineVariable("language"),
          participantResponseTime: rt,
        };
      },
      html: function() {
        const valueIfCorrect = 1;
        const valueIfIncorrect = 0;
        const html = `
          <input type="hidden" id="resultAsNumber" name="resultAsNumber" value=''>
          <h3>${i18n.t("logResponse")}</h3>
          <input type="button" value="${i18n.t("correct")}" 
           onclick="
             document.getElementById('result').value='${i18n.t("correct")}';
             document.getElementById('resultAsNumber').value='${valueIfCorrect}';
             document.getElementById('result').style.color='green'
           ">
          <input type="button" value="${i18n.t("incorrect")}" 
           onclick="
             document.getElementById('result').value='${i18n.t("incorrect")}';
             document.getElementById('resultAsNumber').value='${valueIfIncorrect}';
             document.getElementById('result').style.color='red'
           ">
          <br>
          <label for="result">${i18n.t("responseWas")}</label>
          <output  id="result" name="result" ></output>
          <hr>
          <h4>${i18n.t("logNotes")}</h4>
          <textarea id="textBox" name="notes" placeholder="${i18n.t("logResponse")}"></textarea>
          <p>${i18n.t("logResponseToContinue")}</p>`;
        return html;
      },
      on_load: function() {
        if (shouldRepeatTrial) {
          const trialData = {
            rt: 1,
            response: {
              notes: "Trial repeated",
              result: "Incorrect",
              resultAsNumber: "0",
            },
          };
          jsPsych.finishTrial(trialData);
        }
        const submitButton = document.getElementById(
          "jspsych-survey-html-form-next",
        ) as HTMLButtonElement;
        const resultOutput = document.getElementById(
          "result",
        ) as HTMLOutputElement;
        submitButton.disabled = true;
        document.querySelectorAll('input[type="button"]').forEach((button) => {
          button.addEventListener("click", () => {
            if (resultOutput.value) {
              submitButton.disabled = false;
            }
          });
        });
      },
      preamble: function() {
        const html = `<h3>${i18n.t("correctResponse")}</h3>
                    <p>${jsPsych.evaluateTimelineVariable("correctResponse")}</p>
                    <img src="${jsPsych.evaluateTimelineVariable("stimulus")}" width="300" height="300">`;
        return DOMPurify.sanitize(html);
      },
      type: SurveyHtmlFormPlugin,
    };

    const repeatButtonTrial = {
      type: HtmlButtonResponsePlugin,
      stimulus: i18n.t("repeat"),
      choices: [i18n.t("yes"), i18n.t("no")],
      on_finish: function(data: RepeatTrial) {
        if (data.response === 0) {
          shouldRepeatTrial = true;
        } else {
          shouldRepeatTrial = false;
        }
      },
    };

    const testProcedure = {
      on_timeline_start: function() {
        // If not repeating, load new stimuli
        // If repeating, keep the current timeline_variables
        if (!shouldRepeatTrial) {
          this.timeline_variables = experimentStimuli;
        }
      },
      timeline: [
        preload,
        pageBeforeImage,
        blankPage,
        showImg,
        pageAfterImage,
        repeatButtonTrial,
        logging,
      ],
      timeline_variables: experimentStimuli,
    };

    timeline.push(testProcedure);

    const loop_node = {
      loop_function: function() {
        if (shouldRepeatTrial) {
          return true;
        }

        let clearSet = false;
        if (numberOfTrialsRun === totalNumberOfTrialsToRun) {
          return false;
        }

        // getting the most recent logged result
        const loggingResponseArray = jsPsych.data
          .get()
          .filter({ trial_type: "survey-html-form" })
          .values() as LoggingTrial[];
        const lastTrialIndex = loggingResponseArray.length - 1;
        const lastTrialResults: ParticipantResponse =
          loggingResponseArray[lastTrialIndex]!.response;

        if (lastTrialResults.result === "Correct") {
          numberOfCorrectAnswers++;
          clearSet = false;
        } else if (lastTrialResults.result === "Incorrect") {
          numberOfCorrectAnswers = 0;
        }

        // difficulty level logic
        if (numberOfCorrectAnswers === advancementSchedule) {
          if (numberOfCorrectAnswers <= numberOfLevels) {
            currentDifficultyLevel++;
            numberOfCorrectAnswers = 0;
            clearSet = true;
          }
        } else if (numberOfCorrectAnswers === regressionSchedule) {
          if (currentDifficultyLevel > 1) {
            currentDifficultyLevel--;
          }
        }

        experimentStimuli = createStimuli(
          currentDifficultyLevel,
          language,
          clearSet,
        );

        numberOfTrialsRun++;
        return true;
      },
      timeline,
    };

    if (includeParticipantID) {
      void jsPsych.run([welcome, instructions, particpantIDPage, loop_node]);
    } else {
      void jsPsych.run([welcome, instructions, loop_node]);
    }
  })();
}
