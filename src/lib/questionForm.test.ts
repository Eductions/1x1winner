import { describe, expect, it } from "vitest";
import {
  formToQuestionInput,
  hasErrors,
  initialQuestionForm,
  validateQuestionForm,
  type QuestionFormState,
} from "./questionForm";

function validForm(overrides: Partial<QuestionFormState> = {}): QuestionFormState {
  return {
    ...initialQuestionForm,
    prompt: "Choose the grammatically correct sentence.",
    optionA: "He plays football",
    optionB: "He play football",
    optionC: "He playing football",
    optionD: "He played football now",
    correct_key: "A",
    ...overrides,
  };
}

describe("validateQuestionForm", () => {
  it("accepts a complete, valid form", () => {
    expect(hasErrors(validateQuestionForm(validForm()))).toBe(false);
  });

  it("rejects floors outside 1–10", () => {
    expect(validateQuestionForm(validForm({ floor_level: "0" })).floor_level).toBeTruthy();
    expect(validateQuestionForm(validForm({ floor_level: "11" })).floor_level).toBeTruthy();
    expect(validateQuestionForm(validForm({ floor_level: "abc" })).floor_level).toBeTruthy();
  });

  it("rejects short prompts", () => {
    expect(validateQuestionForm(validForm({ prompt: "Short" })).prompt).toBeTruthy();
  });

  it("requires all four options", () => {
    const errors = validateQuestionForm(validForm({ optionC: "  " }));
    expect(errors.options).toMatch(/all four/i);
  });

  it("rejects duplicate options", () => {
    const errors = validateQuestionForm(
      validForm({ optionB: "He plays football" }),
    );
    expect(errors.options).toMatch(/unique/i);
  });
});

describe("formToQuestionInput", () => {
  it("maps the form to the RPC payload with trimmed values and 4 options", () => {
    const input = formToQuestionInput(
      validForm({
        floor_level: "7",
        category: "writing",
        optionA: "  Dear Dr. Ali,  ",
        explanation: " Formal salutation ",
      }),
    );

    expect(input).toEqual({
      floor_level: 7,
      category: "writing",
      prompt: "Choose the grammatically correct sentence.",
      options: [
        { key: "A", text: "Dear Dr. Ali," },
        { key: "B", text: "He play football" },
        { key: "C", text: "He playing football" },
        { key: "D", text: "He played football now" },
      ],
      correct_key: "A",
      explanation: "Formal salutation",
    });
  });
});
