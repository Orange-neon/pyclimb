import type { Problem } from "../../problemTypes";
import { easyProblems as v2EasyProblems } from "../v2/easy";
import { foundationEasyProblems } from "./foundationEasy";

const simplerSolutions: Record<string, Pick<Problem, "starterCode" | "solutionCode">> = {
  "friendly-greeting": {
    starterCode: "name = input()\n\n# Build the greeting, then print it\n",
    solutionCode: "name = input()\ngreeting = \"Hello, \" + name + \"!\"\nprint(greeting)",
  },
  "repeat-word": {
    starterCode: "word = input()\ncount = int(input())\nline = \"\"\n\n# Add each copy to line\n",
    solutionCode: "word = input()\ncount = int(input())\nline = word\nfor repeat in range(count - 1):\n    line += \" \" + word\nprint(line)",
  },
  "swap-values": {
    starterCode: "first = input()\nsecond = input()\n\n# Use a temporary variable to swap them\n",
    solutionCode: "first = input()\nsecond = input()\ntemporary = first\nfirst = second\nsecond = temporary\nprint(first, second)",
  },
  "count-up": {
    starterCode: "finish = int(input())\nline = \"\"\n\n# Add each number to line\n",
    solutionCode: "finish = int(input())\nline = \"\"\nfor number in range(1, finish + 1):\n    if line != \"\":\n        line += \" \"\n    line += str(number)\nprint(line)",
  },
  "fn-double-value": {
    starterCode: "def double_value(number):\n    # Return twice number\n    pass\n\nnumber = int(input())\n",
    solutionCode: "def double_value(number):\n    return number * 2\n\nnumber = int(input())\nanswer = double_value(number)\nprint(answer)",
  },
  "fn-personal-greeting": {
    starterCode: "def greet(name):\n    # Build and return the greeting\n    pass\n\nname = input()\n",
    solutionCode: "def greet(name):\n    return \"Welcome, \" + name + \"!\"\n\nname = input()\nmessage = greet(name)\nprint(message)",
  },
  "fn-rectangle-area": {
    starterCode: "def rectangle_area(width, height):\n    # Return the area\n    pass\n\nparts = input().split()\nwidth = int(parts[0])\nheight = int(parts[1])\n",
    solutionCode: "def rectangle_area(width, height):\n    return width * height\n\nparts = input().split()\nwidth = int(parts[0])\nheight = int(parts[1])\narea = rectangle_area(width, height)\nprint(area)",
  },
  "fn-even-check": {
    starterCode: "def is_even(number):\n    # Return True when number is even\n    pass\n\nnumber = int(input())\n",
    solutionCode: "def is_even(number):\n    return number % 2 == 0\n\nnumber = int(input())\nif is_even(number):\n    print(\"yes\")\nelse:\n    print(\"no\")",
  },
  "module-leap-year": {
    starterCode: "import calendar\n\nyear = int(input())\n\n# Use calendar.isleap(year)\n",
    solutionCode: "import calendar\n\nyear = int(input())\nif calendar.isleap(year):\n    print(\"leap\")\nelse:\n    print(\"common\")",
  },
  "module-punctuation-count": {
    starterCode: "import string\n\ntext = input()\ncount = 0\n\n# Check each character\n",
    solutionCode: "import string\n\ntext = input()\ncount = 0\nfor character in text:\n    if character in string.punctuation:\n        count += 1\nprint(count)",
  },
  "core-phrase-acronym": {
    starterCode: "words = input().split()\nacronym = \"\"\n\n# Add the first letter of each word\n",
    solutionCode: "words = input().split()\nacronym = \"\"\nfor word in words:\n    acronym += word[0].upper()\nprint(acronym)",
  },
  "core-even-sum": {
    starterCode: "parts = input().split()\ntotal = 0\n\n# Convert and check each value\n",
    solutionCode: "parts = input().split()\ntotal = 0\nfor part in parts:\n    value = int(part)\n    if value % 2 == 0:\n        total += value\nprint(total)",
  },
  "core-stock-updates": {
    starterCode: "update_count = int(input())\ninventory = {}\n\n# Read each update and change its item total\n",
    solutionCode: "update_count = int(input())\ninventory = {}\nfor update in range(update_count):\n    parts = input().split()\n    item = parts[0]\n    change = int(parts[1])\n    if item not in inventory:\n        inventory[item] = 0\n    inventory[item] += change\n\nanswer = \"\"\nfor item in inventory:\n    if answer != \"\":\n        answer += \" \"\n    answer += item + \":\" + str(inventory[item])\nprint(answer)",
  },
  "core-safe-second": {
    starterCode: "words = input().split()\n\n# Check the list length before using position 1\n",
    solutionCode: "words = input().split()\nif len(words) >= 2:\n    print(words[1])\nelse:\n    print(\"missing\")",
  },
  "core-mask-vowels": {
    starterCode: "text = input()\nresult = \"\"\n\n# Add one output character at a time\n",
    solutionCode: "text = input()\nresult = \"\"\nfor character in text:\n    if character.lower() in \"aeiou\":\n        result += \"*\"\n    else:\n        result += character\nprint(result)",
  },
  "class-student-result": {
    starterCode: "class Student:\n    def __init__(self, name, score):\n        self.name = name\n        self.score = score\n\n    def result(self):\n        # Return the student's result\n        pass\n\nname = input()\nscore = int(input())\n",
    solutionCode: "class Student:\n    def __init__(self, name, score):\n        self.name = name\n        self.score = score\n\n    def result(self):\n        if self.score >= 60:\n            return self.name + \": pass\"\n        else:\n            return self.name + \": retry\"\n\nname = input()\nscore = int(input())\nstudent = Student(name, score)\nprint(student.result())",
  },
  "class-point-quadrant": {
    starterCode: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n    def quadrant(self):\n        # Return the quadrant or axis\n        pass\n\nparts = input().split()\nx = int(parts[0])\ny = int(parts[1])\n",
    solutionCode: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n    def quadrant(self):\n        if self.x == 0 or self.y == 0:\n            return \"axis\"\n        if self.x > 0 and self.y > 0:\n            return \"I\"\n        if self.x < 0 and self.y > 0:\n            return \"II\"\n        if self.x < 0 and self.y < 0:\n            return \"III\"\n        return \"IV\"\n\nparts = input().split()\nx = int(parts[0])\ny = int(parts[1])\npoint = Point(x, y)\nprint(point.quadrant())",
  },
};

const revisedEasyProblems = v2EasyProblems.map((problem) => {
  const replacement = simplerSolutions[problem.id];
  return replacement ? { ...problem, ...replacement } : problem;
});

export const easyProblems: Problem[] = [...revisedEasyProblems, ...foundationEasyProblems];
