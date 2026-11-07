import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnouncementBanner } from "./announcement-banner";

describe("AnnouncementBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER;
    delete process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_LINK;
    delete process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_LINK_TEXT;
    delete process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_DISMISSIBLE;
    delete process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_VARIANT;
  });

  it("renders nothing when no message is provided", () => {
    const { container } = render(<AnnouncementBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders message from props", () => {
    render(<AnnouncementBanner message="Scheduled maintenance on Sunday" />);
    expect(
      screen.getByText("Scheduled maintenance on Sunday"),
    ).toBeInTheDocument();
  });

  it("renders message from environment variable", () => {
    process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER = "System update in progress";
    render(<AnnouncementBanner />);
    expect(screen.getByText("System update in progress")).toBeInTheDocument();
  });

  it("renders link when provided", () => {
    render(
      <AnnouncementBanner
        message="Important announcement"
        link="https://example.com/info"
        linkText="Read details"
      />,
    );
    const link = screen.getByRole("link", { name: "Read details" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/info");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("dismisses the banner when dismiss button is clicked and remembers in sessionStorage", () => {
    const { container } = render(
      <AnnouncementBanner message="Important announcement" dismissible={true} />,
    );
    expect(screen.getByText("Important announcement")).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", {
      name: "Dismiss banner",
    });
    fireEvent.click(dismissButton);

    expect(container.firstChild).toBeNull();
  });

  it("does not render dismiss button when dismissible is false", () => {
    render(
      <AnnouncementBanner
        message="Non-dismissible notice"
        dismissible={false}
      />,
    );
    expect(screen.getByText("Non-dismissible notice")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss banner" }),
    ).not.toBeInTheDocument();
  });
});
