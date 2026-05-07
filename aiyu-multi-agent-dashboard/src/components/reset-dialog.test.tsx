import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResetDialog } from "@/components/reset-dialog";

describe("ResetDialog", () => {
  it("renders when open", () => {
    render(<ResetDialog open={true} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Reset Dashboard")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ResetDialog open={false} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<ResetDialog open={true} onClose={onClose} onConfirm={jest.fn()} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Reset is clicked", () => {
    const onConfirm = jest.fn();
    render(<ResetDialog open={true} onClose={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Reset"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = jest.fn();
    render(<ResetDialog open={true} onClose={onClose} onConfirm={jest.fn()} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has aria-modal attribute", () => {
    render(<ResetDialog open={true} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
