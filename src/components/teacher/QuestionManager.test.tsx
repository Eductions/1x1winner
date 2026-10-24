import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeacherQuestion } from "@/lib/types";
import { QuestionManager } from "./QuestionManager";

const questions: TeacherQuestion[] = [
  {
    id: "q-1",
    floor_level: 1,
    category: "grammar",
    prompt: "She ___ to campus every morning.",
    options: [
      { key: "A", text: "goes" },
      { key: "B", text: "go" },
      { key: "C", text: "going" },
      { key: "D", text: "gone" },
    ],
    correct_key: "A",
    explanation: null,
    is_active: true,
    created_by: null,
    created_at: new Date(0).toISOString(),
  },
];

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

describe("<QuestionManager />", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (name: string) => {
      if (name === "teacher_list_questions") return { data: questions, error: null };
      return { data: null, error: null };
    });
  });

  it("loads and displays the teacher question bank", async () => {
    render(<QuestionManager />);

    expect(await screen.findByText("She ___ to campus every morning.")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("teacher_list_questions", {
      p_include_inactive: false,
    });
  });

  it("creates a question through the RPC with the validated payload", async () => {
    render(<QuestionManager />);
    await screen.findByTestId("question-table");

    await userEvent.type(
      screen.getByLabelText(/question prompt/i),
      "Choose the correctly punctuated sentence.",
    );
    await userEvent.type(screen.getByLabelText("Option A"), "It's well-known.");
    await userEvent.type(screen.getByLabelText("Option B"), "Its well known.");
    await userEvent.type(screen.getByLabelText("Option C"), "Its' well-known.");
    await userEvent.type(screen.getByLabelText("Option D"), "It well-known.");
    await userEvent.click(screen.getByRole("button", { name: /add question/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_question", {
        p_floor_level: 1,
        p_category: "grammar",
        p_prompt: "Choose the correctly punctuated sentence.",
        p_options: [
          { key: "A", text: "It's well-known." },
          { key: "B", text: "Its well known." },
          { key: "C", text: "Its' well-known." },
          { key: "D", text: "It well-known." },
        ],
        p_correct_key: "A",
        p_explanation: "",
      }),
    );
  });

  it("blocks submission and shows validation errors for a short prompt", async () => {
    render(<QuestionManager />);
    await screen.findByTestId("question-table");

    await userEvent.type(screen.getByLabelText(/question prompt/i), "Short");
    await userEvent.click(screen.getByRole("button", { name: /add question/i }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    const createCalls = rpc.mock.calls.filter(([name]) => name === "create_question");
    expect(createCalls).toHaveLength(0);
  });

  it("archives a question through the RPC", async () => {
    render(<QuestionManager />);
    await screen.findByTestId("question-table");

    await userEvent.click(screen.getByRole("button", { name: /archive question 1/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("archive_question", { p_id: "q-1" }),
    );
  });

  it("surfaces a friendly message when the server rejects a teacher-only action", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "teacher_list_questions") return { data: [], error: null };
      if (name === "create_question")
        return { data: null, error: new Error("TEACHER_ONLY") };
      return { data: null, error: null };
    });

    render(<QuestionManager />);

    await userEvent.type(
      screen.getByLabelText(/question prompt/i),
      "Write a complete and valid question prompt.",
    );
    await userEvent.type(screen.getByLabelText("Option A"), "First option");
    await userEvent.type(screen.getByLabelText("Option B"), "Second option");
    await userEvent.type(screen.getByLabelText("Option C"), "Third option");
    await userEvent.type(screen.getByLabelText("Option D"), "Fourth option");
    await userEvent.click(screen.getByRole("button", { name: /add question/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/only the supervisor/i);
  });
});
