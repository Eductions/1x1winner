import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupSupervisorForm } from "./SetupSupervisorForm";

const replace = vi.fn();
const refresh = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fillForm() {
  await userEvent.type(
    screen.getByLabelText(/owner setup key/i),
    "owner-secret-123456",
  );
  await userEvent.type(screen.getByLabelText(/supervisor name/i), "Ms Sara");
  await userEvent.type(
    screen.getByLabelText(/^supervisor access code$/i),
    "SUPER1234",
  );
  await userEvent.type(screen.getByLabelText(/repeat access code/i), "SUPER1234");
}

describe("<SetupSupervisorForm />", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 201));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("creates the first supervisor and redirects to login", async () => {
    render(<SetupSupervisorForm />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /create supervisor/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?setup=complete"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/setup/supervisor",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          setupSecret: "owner-secret-123456",
          name: "Ms Sara",
          code: "SUPER1234",
        }),
      }),
    );
  });

  it("blocks mismatched supervisor codes", async () => {
    render(<SetupSupervisorForm />);
    await userEvent.type(screen.getByLabelText(/owner setup key/i), "owner-secret");
    await userEvent.type(screen.getByLabelText(/supervisor name/i), "Ms Sara");
    await userEvent.type(screen.getByLabelText(/^supervisor access code$/i), "SUPER1234");
    await userEvent.type(screen.getByLabelText(/repeat access code/i), "OTHER1234");
    await userEvent.click(screen.getByRole("button", { name: /create supervisor/i }));

    expect(await screen.findByText(/two codes do not match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a clear message when setup is already locked", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "SETUP_ALREADY_COMPLETED" }, 409),
    );
    render(<SetupSupervisorForm />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /create supervisor/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /supervisor setup is already complete/i,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
