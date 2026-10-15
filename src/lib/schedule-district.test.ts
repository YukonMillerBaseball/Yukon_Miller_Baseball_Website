import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { games, isVarsityDistrictGame } from "@/lib/schedule";

describe("varsity district games", () => {
  it("marks the 2027 varsity district opponents", () => {
    const marked = games
      .filter(isVarsityDistrictGame)
      .map((game) => `${game.date} ${game.opponent}`);

    assert.deepEqual(marked, [
      "2027-03-08 Capital Hill",
      "2027-03-22 Memorial",
      "2027-03-23 Memorial",
      "2027-03-29 Moore",
      "2027-03-30 Moore",
      "2027-04-05 Putnam City North",
      "2027-04-06 Putnam City North",
      "2027-04-12 Westmoore",
      "2027-04-13 Westmoore",
      "2027-04-19 Deer Creek",
      "2027-04-20 Deer Creek",
      "2027-04-26 PCO",
      "2027-04-27 PCO",
    ]);
  });

  it("leaves other teams and similar opponents unmarked", () => {
    const jvDistrictNames = games.filter(
      (game) => game.team !== "varsity" && isVarsityDistrictGame(game),
    );
    assert.deepEqual(jvDistrictNames, []);

    for (const opponent of ["Southmoore", "Edmond North", "Mustang", "Enid"]) {
      const matches = games.filter((game) => game.opponent === opponent);
      assert.ok(matches.length > 0, opponent);
      assert.ok(matches.every((game) => !isVarsityDistrictGame(game)));
    }
  });
});
