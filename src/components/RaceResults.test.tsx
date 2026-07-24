import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomPlayer } from "../types/multiplayer";
import { RaceResults } from "./RaceResults";

function player(uid: string, nickname: string, score: number): RoomPlayer {
  return {
    uid,
    nickname,
    normalizedNickname: nickname.toLowerCase(),
    score,
    correctCount: 0,
    joinedAt: 1,
    lastAcceptedAt: null,
    online: true,
    ready: true,
  };
}

describe("race results", () => {
  it("renders final standings in competitive rank order", () => {
    const html = renderToStaticMarkup(
      <RaceResults
        role="player"
        code="ABC234"
        players={[
          player("uid-a", "Lower score", 100),
          player("uid-z", "Race winner", 900),
          player("uid-m", "Middle score", 400),
        ]}
        endReason="time"
        onLeave={() => undefined}
      />,
    );

    expect(html.indexOf("Race winner")).toBeLessThan(html.indexOf("Middle score"));
    expect(html.indexOf("Middle score")).toBeLessThan(html.indexOf("Lower score"));
  });

  it("locks destructive host actions while a challenge result is settling", () => {
    const html = renderToStaticMarkup(
      <RaceResults
        role="host"
        code="ABC234"
        players={[player("uid-z", "Race winner", 900)]}
        endReason="time"
        challengeSettlementPending
        onRematch={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain(
      "Saving the final head-to-head result before the room can change.",
    );
    expect(html).toContain("Saving result…");
    expect(html).toContain("Waiting to close…");
    expect(html.match(/disabled=\"\"/g)).toHaveLength(2);
  });
});
