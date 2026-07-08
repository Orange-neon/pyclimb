import type { ProblemBank } from "../../problemTypes";
import { easyProblems } from "./easy";
import { hardProblems } from "./hard";
import { mediumProblems } from "./medium";

export const problemBank: ProblemBank = {
  version: "v4",
  problems: [...easyProblems, ...mediumProblems, ...hardProblems],
};
