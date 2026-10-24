import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tower } from "./Tower";

describe("<Tower /> visual component", () => {
  it("renders all ten floors plus the ground strip", () => {
    render(<Tower teamAPosition={0} teamBPosition={0} />);

    for (let floor = 1; floor <= 10; floor++) {
      expect(screen.getByTestId(`floor-${floor}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ground")).toBeInTheDocument();
  });

  it("exposes each team's current floor through accessible lane labels", () => {
    render(<Tower teamAPosition={4} teamBPosition={7} />);

    expect(screen.getByLabelText(/Team A lane, currently at floor 4/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Team B lane, currently at floor 7/)).toBeInTheDocument();
  });

  it("renders both team tokens", () => {
    render(<Tower teamAPosition={2} teamBPosition={3} />);

    expect(screen.getByLabelText("Team A token")).toBeInTheDocument();
    expect(screen.getByLabelText("Team B token")).toBeInTheDocument();
  });

  it("marks the winning team's token with a crown and winner label", () => {
    render(<Tower teamAPosition={10} teamBPosition={6} winner="A" status="finished" />);

    expect(screen.getByLabelText("Team A token, winner")).toBeInTheDocument();
    expect(screen.getByLabelText("Team B token")).toBeInTheDocument();
  });

  it("summarises the whole board in one accessible description", () => {
    const { container } = render(
      <Tower teamAPosition={5} teamBPosition={8} />,
    );

    const board = container.querySelector('[role="img"]');
    expect(board).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Team A on floor 5"),
    );
    expect(board).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Team B on floor 8"),
    );
  });
});
