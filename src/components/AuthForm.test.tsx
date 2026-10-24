import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { internalEmailForName } from "@/lib/accessCredentials";
import { AuthForm } from "./AuthForm";

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

const submitButton = () => screen.getByRole("button", { name: /^sign in$/i });

describe("<AuthForm />", () => {
  beforeEach(() => {
    mock = createAuthMock();
  });

  it("shows only a name and access-code login, with no email or self-signup", () => {
    render(<AuthForm />);

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/access code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.getByText(/accounts are created by the supervisor only/i)).toBeInTheDocument();
  });

  it("converts the typed name to the internal identifier and signs in", async () => {
    const onSuccess = vi.fn();
    render(<AuthForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/your name/i), " Sara   Ali ");
    await userEvent.type(screen.getByLabelText(/access code/i), "ABC12345");
    await userEvent.click(submitButton());

    const expectedEmail = await internalEmailForName("sara ali");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: expectedEmail,
      password: "ABC12345",
    });
    expect(mock.auth.signUp).not.toHaveBeenCalled();
  });

  it("accepts an Arabic name exactly as written", async () => {
    render(<AuthForm />);

    await userEvent.type(screen.getByLabelText(/your name/i), "سارة علي");
    await userEvent.type(screen.getByLabelText(/access code/i), "246810");
    await userEvent.click(submitButton());

    await waitFor(() => expect(mock.auth.signInWithPassword).toHaveBeenCalledTimes(1));
    expect(mock.auth.signInWithPassword.mock.calls[0][0].email).toMatch(
      /^p-[a-f0-9]{40}@login\.1x1winner\.local$/,
    );
  });

  it("blocks invalid names and short codes", async () => {
    render(<AuthForm />);

    await userEvent.type(screen.getByLabelText(/your name/i), "Al");
    await userEvent.type(screen.getByLabelText(/access code/i), "123");
    await userEvent.click(submitButton());

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(mock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("renders a friendly error when the name or code is wrong", async () => {
    mock.auth.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    render(<AuthForm />);

    await userEvent.type(screen.getByLabelText(/your name/i), "Sara Ali");
    await userEvent.type(screen.getByLabelText(/access code/i), "wrong-code");
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /incorrect name or access code/i,
    );
  });
});
