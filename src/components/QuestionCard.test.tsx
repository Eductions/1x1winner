import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { initialQuizState, type QuizState } from "@/lib/quiz";
import { QuestionCard } from "./QuestionCard";

function makeQuestionState(overrides: Partial<QuizState> = {}): QuizState {
  return {
    ...initialQuizState,
    phase: "active",
    questionId: "q-1",
    question: {
      id: "q-1",
      floor_level: 3,
      category: "grammar",
      prompt: "Choose the correct form",
      options: [
        { key: "A", text: "She go" },
        { key: "B", text: "She goes" },
        { key: "C", text: "She going" },
        { key: "D", text: "She gone" },
      ],
    },
    ...overrides,
  };
}

describe("<QuestionCard />", () => {
  it("shows a loading state before the question arrives", () => {
    render(
      <QuestionCard
        state={{ ...initialQuizState, phase: "loading", questionId: "q-1" }}
        remaining={20}
        activeTeam="A"
        canAnswer
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByTestId("question-loading")).toBeInTheDocument();
  });

  it("renders the prompt, four options and the live countdown", () => {
    render(
      <QuestionCard
        state={makeQuestionState()}
        remaining={17}
        activeTeam="A"
        canAnswer
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Choose the correct form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A She go" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "B She goes" })).toBeEnabled();
    expect(screen.getByTestId("countdown")).toHaveTextContent("00:17");
  });

  it("calls onSelect with the option key and disables when it is not your turn", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <QuestionCard
        state={makeQuestionState()}
        remaining={20}
        activeTeam="A"
        canAnswer
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "B She goes" }));
    expect(onSelect).toHaveBeenCalledWith("B");

    rerender(
      <QuestionCard
        state={makeQuestionState()}
        remaining={20}
        activeTeam="B"
        canAnswer={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("button", { name: "A She go" })).toBeDisabled();
  });

  it("reveals the correct option in green and the wrong pick in red after submit", () => {
    const submitted = makeQuestionState({
      phase: "submitted",
      selectedKey: "A",
      isCorrect: false,
      correctKey: "B",
      explanation: "Third-person singular takes -es.",
    });

    render(
      <QuestionCard
        state={submitted}
        remaining={0}
        activeTeam="B"
        canAnswer={false}
        onSelect={() => undefined}
      />,
    );

    const wrongPick = screen.getByRole("button", { name: "A She go" });
    const correctOption = screen.getByRole("button", { name: "B She goes" });
    expect(wrongPick.className).toContain("border-rose-500");
    expect(correctOption.className).toContain("border-emerald-500");
    expect(screen.getByText(/third-person singular/i)).toBeInTheDocument();
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });

  it("announces the timeout and the next team", () => {
    render(
      <QuestionCard
        state={{ ...initialQuizState, phase: "timeout" }}
        remaining={0}
        activeTeam="B"
        canAnswer={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/time's up/i)).toBeInTheDocument();
    expect(screen.getByText(/team a/i)).toBeInTheDocument();
  });
});
