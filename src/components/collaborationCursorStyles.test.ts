import { describe, expect, it } from "vitest";
import { collaborationCursorStyles } from "./collaborationCursorStyles";

describe("collaboration cursor styles", () => {
  it("hides the bridged local cursor and labels remote cursors", () => {
    const styles = collaborationCursorStyles(7, [
      { clientId: 7, nickname: "Me", color: "#34d399", local: true },
      { clientId: 12, nickname: "Alice", color: "#fb7185", local: false },
    ]);

    expect(styles).toContain(".yRemoteSelection-7{background:transparent!important}");
    expect(styles).toContain(
      ".yRemoteSelectionHead-7{border-left-color:transparent!important;display:none!important}",
    );
    expect(styles).toContain(
      ".yRemoteSelectionHead-7::after{content:none!important;display:none!important}",
    );
    expect(styles).toContain(".yRemoteSelectionHead-12{border-left-color:#fb7185;");
    expect(styles).toContain('--collaboration-cursor-name:"\\41 \\6c \\69 \\63 \\65 "');
    expect(styles).not.toContain("\\4d \\65 ");
  });

  it("keeps untrusted nickname and color values inside valid declarations", () => {
    const styles = collaborationCursorStyles(null, [
      {
        clientId: 42,
        nickname: '"</style><script>alert(1)</script>',
        color: "red;}body{display:none",
        local: false,
      },
    ]);

    expect(styles).toContain("--collaboration-cursor-color:#38bdf8");
    expect(styles).not.toContain("</style>");
    expect(styles).not.toContain("body{display:none");
    expect(styles).not.toContain("<script>");
  });

  it("ignores invalid client identifiers", () => {
    const styles = collaborationCursorStyles(null, [
      { clientId: -1, nickname: "Invalid", color: "#38bdf8", local: false },
      { clientId: Number.NaN, nickname: "Invalid", color: "#38bdf8", local: false },
    ]);

    expect(styles).toBe("");
  });

  it("labels every remote cursor when one collaborator has multiple tabs", () => {
    const styles = collaborationCursorStyles(7, [
      { clientId: 7, nickname: "Me", color: "#34d399", local: true },
      { clientId: 12, nickname: "Alice", color: "#fb7185", local: false },
      { clientId: 19, nickname: "Alice", color: "#fb7185", local: false },
    ]);

    expect(styles).toContain(".yRemoteSelectionHead-12{");
    expect(styles).toContain(".yRemoteSelectionHead-19{");
    expect(styles.match(/--collaboration-cursor-name:"\\41 \\6c \\69 \\63 \\65 "/g)).toHaveLength(2);
  });
});
