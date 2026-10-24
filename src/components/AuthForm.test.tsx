import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

// The tab strip and the submit button share labels ("Sign in" /
// "Create account"); scope to the actual form submit button.
const submitButton = () =>
  document.querySelector("button[type='submit']") as HTMLButtonElement;

function createAuthMock() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

let mock: ReturnType<typeof createAuthMock>;

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mock,
}));

describe("<AuthForm />", () => {
  beforeEach(() => {
    mock = createAuthMock();
  });

  it("submits valid credentials to signInWithPassword and fires onSuccess", async () => {
    const onSuccess = vi.fn();
    render(<AuthForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/university email/i), "student@u.edu.ly");
    await userEvent.type(screen.getByLabelText(/^password/i), "supersecret");
    await userEvent.click(submitButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "student@u.edu.ly",
      password: "supersecret",
    });
  });

  it("blocks submission and shows validation messages for bad input", async () => {
    render(<AuthForm />);

    await userEvent.type(screen.getByLabelText(/university email/i), "bad-email");
    await userEvent.type(screen.getByLabelText(/^password/i), "short");
    await userEvent.click(submitButton());

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("uses the sign-up flow with username metadata in create mode", async () => {
    render(<AuthForm initialMode="signup" />);

    await userEvent.type(screen.getByLabelText(/username/i), "champ.99");
    await userEvent.type(screen.getByLabelText(/university email/i), "new@u.edu.ly");
    await userEvent.type(screen.getByLabelText(/^password/i), "longpassword1");
    await userEvent.click(submitButton());

    await waitFor(() => expect(mock.auth.signUp).toHaveBeenCalledTimes(1));
    expect(mock.auth.signUp).toHaveBeenCalledWith({
      email: "new@u.edu.ly",
      password: "longpassword1",
      options: { data: { username: "champ.99" } },
    });
  });

  it("renders a friendly error when the RPC rejects the credentials", async () => {
    mock.auth.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    render(<AuthForm />);

    await userEvent.type(screen.getByLabelText(/university email/i), "x@u.edu.ly");
    await userEvent.type(screen.getByLabelText(/^password/i), "password123");
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /incorrect email or password/i,
    );
  });
});
