import {
  FLOOR_COUNT,
  type AnswerKey,
  type QuestionCategory,
  type QuestionInput,
  type QuestionOption,
} from "./types";

export type QuestionFormErrors = Partial<
  Record<"floor_level" | "category" | "prompt" | "options" | `option_${AnswerKey}` | "correct_key", string>
>;

export interface QuestionFormState {
  floor_level: string;
  category: QuestionCategory;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct_key: AnswerKey;
  explanation: string;
}

export const initialQuestionForm: QuestionFormState = {
  floor_level: "1",
  category: "grammar",
  prompt: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correct_key: "A",
  explanation: "",
};

/** Validates the teacher question form; an empty object means it is submittable. */
export function validateQuestionForm(form: QuestionFormState): QuestionFormErrors {
  const errors: QuestionFormErrors = {};
  const floor = Number(form.floor_level);

  if (!Number.isInteger(floor) || floor < 1 || floor > FLOOR_COUNT) {
    errors.floor_level = `Floor must be a whole number between 1 and ${FLOOR_COUNT}.`;
  }
  if (form.prompt.trim().length < 10) {
    errors.prompt = "The question prompt must be at least 10 characters.";
  }

  const rawOptions: Array<[AnswerKey, string]> = [
    ["A", form.optionA],
    ["B", form.optionB],
    ["C", form.optionC],
    ["D", form.optionD],
  ];

  const filled = rawOptions.filter(([, text]) => text.trim().length > 0);
  if (filled.length !== 4) {
    errors.options = "All four answer options are required.";
  } else {
    const unique = new Set(filled.map(([, text]) => text.trim().toLowerCase()));
    if (unique.size !== 4) {
      errors.options = "Answer options must be unique.";
    }
  }

  if (!["A", "B", "C", "D"].includes(form.correct_key)) {
    errors.correct_key = "Pick the correct option.";
  }

  return errors;
}

/** Converts a validated form into the JSON payload expected by create_question. */
export function formToQuestionInput(form: QuestionFormState): QuestionInput {
  const options: QuestionOption[] = (
    [
      ["A", form.optionA],
      ["B", form.optionB],
      ["C", form.optionC],
      ["D", form.optionD],
    ] as Array<[AnswerKey, string]>
  ).map(([key, text]) => ({ key, text: text.trim() }));

  return {
    floor_level: Number(form.floor_level),
    category: form.category,
    prompt: form.prompt.trim(),
    options,
    correct_key: form.correct_key,
    explanation: form.explanation.trim(),
  };
}

export function hasErrors(errors: QuestionFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
