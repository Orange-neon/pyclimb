import type { Problem } from "../../problemTypes";

export const easyProblems: Problem[] = [
  {
    id: "friendly-greeting",
    title: "Friendly Greeting",
    difficulty: "easy",
    tags: ["input", "print", "strings"],
    description: `# Friendly Greeting

Read a person's name and greet them.

## Input
One line containing a name.

## Output
Print \`Hello, NAME!\` using the name from the input.

### Example
Input: \`Ada\`
Output: \`Hello, Ada!\``,
    starterCode: `name = input()

# Print the greeting here
`,
    solutionCode: `name = input()
print(f"Hello, {name}!")`,
    testCases: [
      { input: "Ada", expectedOutput: "Hello, Ada!" },
      { input: "Guido", expectedOutput: "Hello, Guido!" },
      { input: "Python Camper", expectedOutput: "Hello, Python Camper!" },
    ],
  },
  {
    id: "snack-total",
    title: "Snack Total",
    difficulty: "easy",
    tags: ["input", "integers", "arithmetic"],
    description: `# Snack Total

The camp store sells snacks at the same price each.

## Input
The first line is the number of snacks. The second line is the price of one snack.

## Output
Print the total cost.

### Example
Input: \`3\` and \`4\`
Output: \`12\``,
    starterCode: `snacks = int(input())
price = int(input())

# Calculate and print the total
`,
    solutionCode: `snacks = int(input())
price = int(input())
print(snacks * price)`,
    testCases: [
      { input: "3\n4", expectedOutput: "12" },
      { input: "10\n2", expectedOutput: "20" },
      { input: "0\n7", expectedOutput: "0" },
    ],
  },
  {
    id: "double-number",
    title: "Double It",
    difficulty: "easy",
    tags: ["input", "integers", "arithmetic"],
    description: `# Double It

Read one whole number and double it.

## Input
One whole number.

## Output
Print the number multiplied by 2.

### Example
Input: \`6\`
Output: \`12\``,
    starterCode: `number = int(input())

# Print twice the number
`,
    solutionCode: `number = int(input())
print(number * 2)`,
    testCases: [
      { input: "6", expectedOutput: "12" },
      { input: "0", expectedOutput: "0" },
      { input: "-7", expectedOutput: "-14" },
    ],
  },
  {
    id: "next-birthday",
    title: "Next Birthday",
    difficulty: "easy",
    tags: ["input", "integers", "arithmetic"],
    description: `# Next Birthday

Tell a camper how old they will be next year.

## Input
One whole number containing the camper's current age.

## Output
Print \`Next year: AGE\` with their age next year.

### Example
Input: \`12\`
Output: \`Next year: 13\``,
    starterCode: `age = int(input())

# Print next year's age
`,
    solutionCode: `age = int(input())
print("Next year:", age + 1)`,
    testCases: [
      { input: "12", expectedOutput: "Next year: 13" },
      { input: "8", expectedOutput: "Next year: 9" },
      { input: "99", expectedOutput: "Next year: 100" },
    ],
  },
  {
    id: "rectangle-area",
    title: "Rectangle Area",
    difficulty: "easy",
    tags: ["input", "arithmetic", "geometry"],
    description: `# Rectangle Area

Calculate the area of a rectangle.

## Input
The first line is the width. The second line is the height.

## Output
Print the area, which is width multiplied by height.

### Example
Input: \`5\` and \`3\`
Output: \`15\``,
    starterCode: `width = int(input())
height = int(input())

# Calculate the area
`,
    solutionCode: `width = int(input())
height = int(input())
print(width * height)`,
    testCases: [
      { input: "5\n3", expectedOutput: "15" },
      { input: "9\n2", expectedOutput: "18" },
      { input: "1\n12", expectedOutput: "12" },
    ],
  },
  {
    id: "even-or-odd",
    title: "Even or Odd",
    difficulty: "easy",
    tags: ["conditionals", "integers", "modulo"],
    description: `# Even or Odd

Decide whether a whole number is even or odd.

## Input
One whole number.

## Output
Print \`even\` or \`odd\`.

### Example
Input: \`14\`
Output: \`even\``,
    starterCode: `number = int(input())

# Check the remainder after dividing by 2
`,
    solutionCode: `number = int(input())
if number % 2 == 0:
    print("even")
else:
    print("odd")`,
    testCases: [
      { input: "14", expectedOutput: "even" },
      { input: "7", expectedOutput: "odd" },
      { input: "0", expectedOutput: "even" },
    ],
  },
  {
    id: "temperature-label",
    title: "Hot or Cool",
    difficulty: "easy",
    tags: ["conditionals", "integers"],
    description: `# Hot or Cool

Label a temperature as hot or cool. A temperature of 30 or higher is hot.

## Input
One whole-number temperature.

## Output
Print \`hot\` when the temperature is at least 30. Otherwise print \`cool\`.

### Example
Input: \`32\`
Output: \`hot\``,
    starterCode: `temperature = int(input())

# Print the correct label
`,
    solutionCode: `temperature = int(input())
if temperature >= 30:
    print("hot")
else:
    print("cool")`,
    testCases: [
      { input: "32", expectedOutput: "hot" },
      { input: "30", expectedOutput: "hot" },
      { input: "18", expectedOutput: "cool" },
    ],
  },
  {
    id: "name-initials",
    title: "Name Initials",
    difficulty: "easy",
    tags: ["strings", "input", "indexing"],
    description: `# Name Initials

Turn a first and last name into two capital initials.

## Input
The first line is a first name. The second line is a last name.

## Output
Print the two first letters in uppercase with periods after them.

### Example
Input: \`ada\` and \`lovelace\`
Output: \`A.L.\``,
    starterCode: `first_name = input()
last_name = input()

# Build the initials
`,
    solutionCode: `first_name = input()
last_name = input()
print(first_name[0].upper() + "." + last_name[0].upper() + ".")`,
    testCases: [
      { input: "ada\nlovelace", expectedOutput: "A.L." },
      { input: "Grace\nHopper", expectedOutput: "G.H." },
      { input: "monty\npython", expectedOutput: "M.P." },
    ],
  },
  {
    id: "countdown-launch",
    title: "Countdown Launch",
    difficulty: "easy",
    tags: ["loops", "range", "print"],
    description: `# Countdown Launch

Count backward from a number to 1, then launch.

## Input
One whole number between 1 and 10.

## Output
Print each number on its own line, followed by \`Go!\`.

### Example
Input: \`3\`
Output: \`3\`, \`2\`, \`1\`, then \`Go!\``,
    starterCode: `number = int(input())

# Count backward, then print Go!
`,
    solutionCode: `number = int(input())
for value in range(number, 0, -1):
    print(value)
print("Go!")`,
    testCases: [
      { input: "3", expectedOutput: "3\n2\n1\nGo!" },
      { input: "1", expectedOutput: "1\nGo!" },
      { input: "5", expectedOutput: "5\n4\n3\n2\n1\nGo!" },
    ],
  },
  {
    id: "word-length",
    title: "Word Length",
    difficulty: "easy",
    tags: ["strings", "len", "input"],
    description: `# Word Length

Measure how many characters are in a word.

## Input
One word with no spaces.

## Output
Print the word followed by its length, separated by one space.

### Example
Input: \`python\`
Output: \`python 6\``,
    starterCode: `word = input()

# Print the word and its length
`,
    solutionCode: `word = input()
print(word, len(word))`,
    testCases: [
      { input: "python", expectedOutput: "python 6" },
      { input: "camp", expectedOutput: "camp 4" },
      { input: "a", expectedOutput: "a 1" },
    ],
  },
  {
    id: "minutes-to-seconds",
    title: "Minutes to Seconds",
    difficulty: "easy",
    tags: ["arithmetic", "time", "input"],
    description: `# Minutes to Seconds

Convert a number of minutes into seconds.

## Input
One whole number of minutes.

## Output
Print the equivalent number of seconds.

### Example
Input: \`3\`
Output: \`180\``,
    starterCode: `minutes = int(input())

# Convert minutes to seconds
`,
    solutionCode: `minutes = int(input())
print(minutes * 60)`,
    testCases: [
      { input: "3", expectedOutput: "180" },
      { input: "0", expectedOutput: "0" },
      { input: "15", expectedOutput: "900" },
    ],
  },
  {
    id: "square-perimeter",
    title: "Square Perimeter",
    difficulty: "easy",
    tags: ["geometry", "arithmetic", "input"],
    description: `# Square Perimeter

Find the distance around a square.

## Input
One whole number containing the length of a side.

## Output
Print the perimeter of the square.

### Example
Input: \`6\`
Output: \`24\``,
    starterCode: `side = int(input())

# A square has four equal sides
`,
    solutionCode: `side = int(input())
print(side * 4)`,
    testCases: [
      { input: "6", expectedOutput: "24" },
      { input: "1", expectedOutput: "4" },
      { input: "25", expectedOutput: "100" },
    ],
  },
  {
    id: "number-sign",
    title: "Number Sign",
    difficulty: "easy",
    tags: ["conditionals", "numbers", "comparisons"],
    description: `# Number Sign

Label a number as positive, negative, or zero.

## Input
One whole number.

## Output
Print \`positive\`, \`negative\`, or \`zero\`.

### Example
Input: \`-4\`
Output: \`negative\``,
    starterCode: `number = int(input())

# Compare number with zero
`,
    solutionCode: `number = int(input())
if number > 0:
    print("positive")
elif number < 0:
    print("negative")
else:
    print("zero")`,
    testCases: [
      { input: "-4", expectedOutput: "negative" },
      { input: "12", expectedOutput: "positive" },
      { input: "0", expectedOutput: "zero" },
    ],
  },
  {
    id: "grade-band",
    title: "Grade Band",
    difficulty: "easy",
    tags: ["conditionals", "comparisons", "school"],
    description: `# Grade Band

Turn a score into a grade band: A is 90 or above, B is 80 or above, and C is 70 or above.

## Input
One whole-number score from 0 to 100.

## Output
Print \`A\`, \`B\`, \`C\`, or \`keep practicing\`.

### Example
Input: \`84\`
Output: \`B\``,
    starterCode: `score = int(input())

# Check the highest grade band first
`,
    solutionCode: `score = int(input())
if score >= 90:
    print("A")
elif score >= 80:
    print("B")
elif score >= 70:
    print("C")
else:
    print("keep practicing")`,
    testCases: [
      { input: "95", expectedOutput: "A" },
      { input: "84", expectedOutput: "B" },
      { input: "70", expectedOutput: "C" },
      { input: "61", expectedOutput: "keep practicing" },
    ],
  },
  {
    id: "repeat-word",
    title: "Repeat a Word",
    difficulty: "easy",
    tags: ["loops", "strings", "lists"],
    description: `# Repeat a Word

Repeat a word a requested number of times.

## Input
The first line is a word. The second line is a whole number.

## Output
Print the repeated words on one line with spaces between them.

### Example
Input: \`go\` and \`3\`
Output: \`go go go\``,
    starterCode: `word = input()
count = int(input())
words = []

# Add word count times

print(*words)
`,
    solutionCode: `word = input()
count = int(input())
words = []
for repeat in range(count):
    words.append(word)
print(*words)`,
    testCases: [
      { input: "go\n3", expectedOutput: "go go go" },
      { input: "python\n1", expectedOutput: "python" },
      { input: "up\n5", expectedOutput: "up up up up up" },
    ],
  },
  {
    id: "first-and-last",
    title: "First and Last",
    difficulty: "easy",
    tags: ["strings", "indexing", "input"],
    description: `# First and Last

Pick out the first and last characters of a word.

## Input
One non-empty word.

## Output
Print the first and last characters separated by one space.

### Example
Input: \`climb\`
Output: \`c b\``,
    starterCode: `word = input()

# Use indexes for the first and last characters
`,
    solutionCode: `word = input()
print(word[0], word[-1])`,
    testCases: [
      { input: "climb", expectedOutput: "c b" },
      { input: "python", expectedOutput: "p n" },
      { input: "A", expectedOutput: "A A" },
    ],
  },
  {
    id: "dice-total",
    title: "Dice Total",
    difficulty: "easy",
    tags: ["games", "arithmetic", "input"],
    description: `# Dice Total

Add the results of two dice rolls.

## Input
The first line is one die value. The second line is the other die value.

## Output
Print \`total: N\` using their sum.

### Example
Input: \`4\` and \`6\`
Output: \`total: 10\``,
    starterCode: `first_die = int(input())
second_die = int(input())

# Add the dice
`,
    solutionCode: `first_die = int(input())
second_die = int(input())
print("total:", first_die + second_die)`,
    testCases: [
      { input: "4\n6", expectedOutput: "total: 10" },
      { input: "1\n1", expectedOutput: "total: 2" },
      { input: "3\n5", expectedOutput: "total: 8" },
    ],
  },
  {
    id: "kilometers-to-meters",
    title: "Kilometers to Meters",
    difficulty: "easy",
    tags: ["measurement", "arithmetic", "input"],
    description: `# Kilometers to Meters

Convert kilometers into meters.

## Input
One whole number of kilometers.

## Output
Print the equivalent number of meters.

### Example
Input: \`7\`
Output: \`7000\``,
    starterCode: `kilometers = int(input())

# One kilometer has 1000 meters
`,
    solutionCode: `kilometers = int(input())
print(kilometers * 1000)`,
    testCases: [
      { input: "7", expectedOutput: "7000" },
      { input: "1", expectedOutput: "1000" },
      { input: "42", expectedOutput: "42000" },
    ],
  },
  {
    id: "uppercase-message",
    title: "Make It Loud",
    difficulty: "easy",
    tags: ["strings", "methods", "formatting"],
    description: `# Make It Loud

Turn a message into uppercase letters and add an exclamation mark.

## Input
One line of text.

## Output
Print the uppercase message followed immediately by \`!\`.

### Example
Input: \`great job\`
Output: \`GREAT JOB!\``,
    starterCode: `message = input()

# Make the message loud
`,
    solutionCode: `message = input()
print(message.upper() + "!")`,
    testCases: [
      { input: "great job", expectedOutput: "GREAT JOB!" },
      { input: "Python", expectedOutput: "PYTHON!" },
      { input: "go", expectedOutput: "GO!" },
    ],
  },
  {
    id: "ticket-price",
    title: "Ticket Price",
    difficulty: "easy",
    tags: ["conditionals", "real-world", "comparisons"],
    description: `# Ticket Price

A child ticket costs 5 dollars for ages 12 and under. A senior ticket costs 6 dollars for ages 65 and over. Every other ticket costs 10 dollars.

## Input
One whole-number age.

## Output
Print the ticket price as a whole number.

### Example
Input: \`10\`
Output: \`5\``,
    starterCode: `age = int(input())

# Choose the correct ticket price
`,
    solutionCode: `age = int(input())
if age <= 12:
    print(5)
elif age >= 65:
    print(6)
else:
    print(10)`,
    testCases: [
      { input: "10", expectedOutput: "5" },
      { input: "30", expectedOutput: "10" },
      { input: "70", expectedOutput: "6" },
      { input: "12", expectedOutput: "5" },
    ],
  },
  {
    id: "circle-diameter",
    title: "Circle Diameter",
    difficulty: "easy",
    tags: ["geometry", "arithmetic", "input"],
    description: `# Circle Diameter

The diameter of a circle is twice its radius.

## Input
One whole-number radius.

## Output
Print the circle's diameter.

### Example
Input: \`7\`
Output: \`14\``,
    starterCode: `radius = int(input())

# Calculate the diameter
`,
    solutionCode: `radius = int(input())
print(radius * 2)`,
    testCases: [
      { input: "7", expectedOutput: "14" },
      { input: "1", expectedOutput: "2" },
      { input: "25", expectedOutput: "50" },
    ],
  },
  {
    id: "swap-values",
    title: "Swap Values",
    difficulty: "easy",
    tags: ["variables", "strings", "assignment"],
    description: `# Swap Values

Read two words and print them in the opposite order.

## Input
Two words, one per line.

## Output
Print the second word followed by the first word.

### Example
Input: \`up\` and \`down\`
Output: \`down up\``,
    starterCode: `first = input()
second = input()

# Swap the values before printing
`,
    solutionCode: `first = input()
second = input()
first, second = second, first
print(first, second)`,
    testCases: [
      { input: "up\ndown", expectedOutput: "down up" },
      { input: "red\nblue", expectedOutput: "blue red" },
      { input: "hello\nworld", expectedOutput: "world hello" },
    ],
  },
  {
    id: "divisible-by-five",
    title: "Divisible by Five",
    difficulty: "easy",
    tags: ["conditionals", "modulo", "numbers"],
    description: `# Divisible by Five

Check whether a number divides evenly by 5.

## Input
One whole number.

## Output
Print \`yes\` when it is divisible by 5, otherwise print \`no\`.

### Example
Input: \`35\`
Output: \`yes\``,
    starterCode: `number = int(input())

# Check the remainder after division by 5
`,
    solutionCode: `number = int(input())
if number % 5 == 0:
    print("yes")
else:
    print("no")`,
    testCases: [
      { input: "35", expectedOutput: "yes" },
      { input: "12", expectedOutput: "no" },
      { input: "0", expectedOutput: "yes" },
    ],
  },
  {
    id: "longer-word",
    title: "Longer Word",
    difficulty: "easy",
    tags: ["strings", "comparisons", "conditionals"],
    description: `# Longer Word

Compare the lengths of two words. If they tie, choose the first word.

## Input
Two words, one per line.

## Output
Print the chosen word.

### Example
Input: \`cat\` and \`python\`
Output: \`python\``,
    starterCode: `first = input()
second = input()

# Compare the word lengths
`,
    solutionCode: `first = input()
second = input()
if len(first) >= len(second):
    print(first)
else:
    print(second)`,
    testCases: [
      { input: "cat\npython", expectedOutput: "python" },
      { input: "blue\ngold", expectedOutput: "blue" },
      { input: "mountain\nhill", expectedOutput: "mountain" },
    ],
  },
  {
    id: "weekday-or-weekend",
    title: "Weekday or Weekend",
    difficulty: "easy",
    tags: ["conditionals", "strings", "calendar"],
    description: `# Weekday or Weekend

Saturday and Sunday are weekend days. Every other named day is a weekday.

## Input
One lowercase day name.

## Output
Print \`weekend\` or \`weekday\`.

### Example
Input: \`saturday\`
Output: \`weekend\``,
    starterCode: `day = input()

# Check for the two weekend days
`,
    solutionCode: `day = input()
if day == "saturday" or day == "sunday":
    print("weekend")
else:
    print("weekday")`,
    testCases: [
      { input: "saturday", expectedOutput: "weekend" },
      { input: "monday", expectedOutput: "weekday" },
      { input: "sunday", expectedOutput: "weekend" },
    ],
  },
  {
    id: "coin-jar-value",
    title: "Coin Jar Value",
    difficulty: "easy",
    tags: ["money", "arithmetic", "input"],
    description: `# Coin Jar Value

Find the value of a jar containing quarters, dimes, and nickels.

## Input
The numbers of quarters, dimes, and nickels, one per line.

## Output
Print the total value in cents.

### Example
Input: \`2\`, \`1\`, and \`3\`
Output: \`75\``,
    starterCode: `quarters = int(input())
dimes = int(input())
nickels = int(input())

# Add the values in cents
`,
    solutionCode: `quarters = int(input())
dimes = int(input())
nickels = int(input())
print(quarters * 25 + dimes * 10 + nickels * 5)`,
    testCases: [
      { input: "2\n1\n3", expectedOutput: "75" },
      { input: "0\n4\n2", expectedOutput: "50" },
      { input: "1\n0\n0", expectedOutput: "25" },
    ],
  },
  {
    id: "count-up",
    title: "Count Up",
    difficulty: "easy",
    tags: ["loops", "range", "lists"],
    description: `# Count Up

List every whole number from 1 through a finishing number.

## Input
One positive whole number.

## Output
Print the numbers on one line separated by spaces.

### Example
Input: \`4\`
Output: \`1 2 3 4\``,
    starterCode: `finish = int(input())
numbers = []

# Add every number from 1 through finish

print(*numbers)
`,
    solutionCode: `finish = int(input())
numbers = []
for number in range(1, finish + 1):
    numbers.append(number)
print(*numbers)`,
    testCases: [
      { input: "4", expectedOutput: "1 2 3 4" },
      { input: "1", expectedOutput: "1" },
      { input: "7", expectedOutput: "1 2 3 4 5 6 7" },
    ],
  },
  {
    id: "masked-word",
    title: "Mask a Word",
    difficulty: "easy",
    tags: ["strings", "length", "multiplication"],
    description: `# Mask a Word

Keep the first letter of a word visible and replace every later letter with a star.

## Input
One non-empty word.

## Output
Print the masked word.

### Example
Input: \`python\`
Output: \`p*****\``,
    starterCode: `word = input()

# Keep the first character and make the stars
`,
    solutionCode: `word = input()
print(word[0] + "*" * (len(word) - 1))`,
    testCases: [
      { input: "python", expectedOutput: "p*****" },
      { input: "cat", expectedOutput: "c**" },
      { input: "A", expectedOutput: "A" },
    ],
  },
  {
    id: "maximum-of-two",
    title: "Maximum of Two",
    difficulty: "easy",
    tags: ["conditionals", "comparisons", "numbers"],
    description: `# Maximum of Two

Choose the larger of two whole numbers. If they are equal, print that shared value.

## Input
Two whole numbers, one per line.

## Output
Print the larger value.

### Example
Input: \`8\` and \`3\`
Output: \`8\``,
    starterCode: `first = int(input())
second = int(input())

# Compare the two values
`,
    solutionCode: `first = int(input())
second = int(input())
if first >= second:
    print(first)
else:
    print(second)`,
    testCases: [
      { input: "8\n3", expectedOutput: "8" },
      { input: "-5\n-2", expectedOutput: "-2" },
      { input: "7\n7", expectedOutput: "7" },
    ],
  },
  {
    id: "dog-years",
    title: "Dog Years",
    difficulty: "easy",
    tags: ["arithmetic", "animals", "input"],
    description: `# Dog Years

For this activity, one human year equals seven dog years.

## Input
One whole number of human years.

## Output
Print the equivalent dog years.

### Example
Input: \`4\`
Output: \`28\``,
    starterCode: `human_years = int(input())

# Convert to dog years
`,
    solutionCode: `human_years = int(input())
print(human_years * 7)`,
    testCases: [
      { input: "4", expectedOutput: "28" },
      { input: "1", expectedOutput: "7" },
      { input: "12", expectedOutput: "84" },
    ],
  },
];
