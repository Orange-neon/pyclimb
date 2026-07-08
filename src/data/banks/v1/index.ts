import type { ProblemBank } from "../../problemTypes";
import { easyProblems } from "./easy";
import { hardProblems } from "./hard";
import { mediumProblems } from "./medium";

export const problemBank: ProblemBank = {
  version: "v1",
  problems: [...easyProblems, ...mediumProblems, ...hardProblems],
};
