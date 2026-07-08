import type { Problem } from "../../problemTypes";

export const hardProblems: Problem[] = [
  {
    id: "fibonacci-term",
    title: "Fibonacci Climb",
    difficulty: "hard",
    tags: ["loops", "sequences", "variables"],
    description: `# Fibonacci Climb

The Fibonacci sequence begins \`0, 1, 1, 2, 3, 5...\`. Each new term is the sum of the previous two.

## Input
One integer \`n\` between 1 and 30.

## Output
Print the nth Fibonacci term. The 1st term is 0 and the 2nd term is 1.

### Example
Input: \`7\`
Output: \`8\``,
    starterCode: `n = int(input())
first = 0
second = 1

# Move through the sequence to term n
`,
    solutionCode: `n = int(input())
first = 0
second = 1
for step in range(n - 1):
    first, second = second, first + second
print(first)`,
    testCases: [
      { input: "1", expectedOutput: "0" },
      { input: "7", expectedOutput: "8" },
      { input: "15", expectedOutput: "377" },
    ],
  },
  {
    id: "longest-word",
    title: "Longest Word",
    difficulty: "hard",
    tags: ["strings", "lists", "loops"],
    description: `# Longest Word

Find the longest word in a sentence. If several words tie, choose the first one.

## Input
One line containing words separated by spaces.

## Output
Print the longest word followed by its length, separated by one space.

### Example
Input: \`we love learning python\`
Output: \`learning 8\``,
    starterCode: `words = input().split()
longest = ""

# Find the first longest word

print(longest, len(longest))
`,
    solutionCode: `words = input().split()
longest = ""
for word in words:
    if len(word) > len(longest):
        longest = word
print(longest, len(longest))`,
    testCases: [
      { input: "we love learning python", expectedOutput: "learning 8" },
      { input: "red blue gold", expectedOutput: "blue 4" },
      { input: "extraordinary", expectedOutput: "extraordinary 13" },
    ],
  },
  {
    id: "phrase-palindrome",
    title: "Phrase Palindrome",
    difficulty: "hard",
    tags: ["strings", "loops", "slicing"],
    description: `# Phrase Palindrome

A palindrome reads the same forward and backward. Check a phrase while ignoring spaces and capital letters.

## Input
One line containing letters and spaces.

## Output
Print \`palindrome\` or \`not palindrome\`.

### Example
Input: \`Never odd or even\`
Output: \`palindrome\``,
    starterCode: `text = input().lower()
cleaned = ""

# Remove spaces, then compare both directions
`,
    solutionCode: `text = input().lower()
cleaned = ""
for character in text:
    if character != " ":
        cleaned += character
if cleaned == cleaned[::-1]:
    print("palindrome")
else:
    print("not palindrome")`,
    testCases: [
      { input: "Never odd or even", expectedOutput: "palindrome" },
      { input: "python", expectedOutput: "not palindrome" },
      { input: "Level", expectedOutput: "palindrome" },
    ],
  },
  {
    id: "second-largest",
    title: "Second Largest",
    difficulty: "hard",
    tags: ["lists", "sorting", "duplicates"],
    description: `# Second Largest

Find the second-largest different value in a list. Repeated copies count as one value.

## Input
One line containing at least two different whole numbers.

## Output
Print the second-largest different number.

### Example
Input: \`5 1 5 3\`
Output: \`3\``,
    starterCode: `numbers = [int(value) for value in input().split()]
unique = []

# Keep different values and sort them
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
unique = []
for number in numbers:
    if number not in unique:
        unique.append(number)
unique.sort(reverse=True)
print(unique[1])`,
    testCases: [
      { input: "5 1 5 3", expectedOutput: "3" },
      { input: "-1 -7 -3", expectedOutput: "-3" },
      { input: "4 2", expectedOutput: "2" },
    ],
  },
  {
    id: "most-frequent-number",
    title: "Most Frequent Number",
    difficulty: "hard",
    tags: ["lists", "nested-loops", "counting"],
    description: `# Most Frequent Number

Find the number that appears most often. If values tie, choose the one that appeared first.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the winning number and its count, separated by one space.

### Example
Input: \`4 2 4 3 4 2\`
Output: \`4 3\``,
    starterCode: `numbers = [int(value) for value in input().split()]
winner = numbers[0]
best_count = 0

# Count each number and keep the first best result
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
winner = numbers[0]
best_count = 0
for number in numbers:
    count = 0
    for candidate in numbers:
        if candidate == number:
            count += 1
    if count > best_count:
        winner = number
        best_count = count
print(winner, best_count)`,
    testCases: [
      { input: "4 2 4 3 4 2", expectedOutput: "4 3" },
      { input: "7 8 8 7", expectedOutput: "7 2" },
      { input: "5", expectedOutput: "5 1" },
    ],
  },
  {
    id: "letter-shift",
    title: "Letter Shift",
    difficulty: "hard",
    tags: ["strings", "loops", "character-codes"],
    description: `# Letter Shift

Shift every lowercase letter forward by one place in the alphabet. The letter z wraps around to a. Spaces stay unchanged.

## Input
One line containing lowercase letters and spaces.

## Output
Print the shifted text.

### Example
Input: \`abc xyz\`
Output: \`bcd yza\``,
    starterCode: `text = input()
shifted = ""

# Shift each letter, remembering that z becomes a
`,
    solutionCode: `text = input()
shifted = ""
for character in text:
    if character == " ":
        shifted += " "
    elif character == "z":
        shifted += "a"
    else:
        shifted += chr(ord(character) + 1)
print(shifted)`,
    testCases: [
      { input: "abc xyz", expectedOutput: "bcd yza" },
      { input: "zoo", expectedOutput: "app" },
      { input: "camp", expectedOutput: "dbnq" },
    ],
  },
  {
    id: "triangle-pattern",
    title: "Star Triangle",
    difficulty: "hard",
    tags: ["loops", "strings", "patterns"],
    description: `# Star Triangle

Build a growing triangle from star characters.

## Input
One whole number between 1 and 10.

## Output
Print that many rows. Row 1 has one star, row 2 has two stars, and so on.

### Example
Input: \`3\`
Output: \`*\`, then \`**\`, then \`***\``,
    starterCode: `height = int(input())

# Print one row for each size
`,
    solutionCode: `height = int(input())
for size in range(1, height + 1):
    print("*" * size)`,
    testCases: [
      { input: "3", expectedOutput: "*\n**\n***" },
      { input: "1", expectedOutput: "*" },
      { input: "5", expectedOutput: "*\n**\n***\n****\n*****" },
    ],
  },
  {
    id: "collatz-steps",
    title: "Collatz Steps",
    difficulty: "hard",
    tags: ["while-loops", "conditionals", "counting"],
    description: `# Collatz Steps

Starting with a positive number: divide it by 2 when it is even, or multiply by 3 and add 1 when it is odd. Count how many steps it takes to reach 1.

## Input
One positive whole number.

## Output
Print the number of steps needed to reach 1.

### Example
Input: \`6\`
Output: \`8\``,
    starterCode: `number = int(input())
steps = 0

# Change number until it reaches 1

print(steps)
`,
    solutionCode: `number = int(input())
steps = 0
while number != 1:
    if number % 2 == 0:
        number = number // 2
    else:
        number = number * 3 + 1
    steps += 1
print(steps)`,
    testCases: [
      { input: "6", expectedOutput: "8" },
      { input: "1", expectedOutput: "0" },
      { input: "3", expectedOutput: "7" },
    ],
  },
  {
    id: "matrix-row-sums",
    title: "Row Sums",
    difficulty: "hard",
    tags: ["nested-lists", "loops", "input"],
    description: `# Row Sums

Read several rows of numbers and calculate the total of each row.

## Input
The first line is the number of rows. Each following line contains one row of whole numbers.

## Output
Print all row totals on one line, separated by spaces.

### Example
Input rows: \`1 2 3\` and \`4 5 6\`
Output: \`6 15\``,
    starterCode: `row_count = int(input())
row_totals = []

# Read each row and calculate its total

print(*row_totals)
`,
    solutionCode: `row_count = int(input())
row_totals = []
for row_number in range(row_count):
    row = [int(value) for value in input().split()]
    total = 0
    for number in row:
        total += number
    row_totals.append(total)
print(*row_totals)`,
    testCases: [
      { input: "2\n1 2 3\n4 5 6", expectedOutput: "6 15" },
      { input: "3\n5\n1 1\n2 3 4", expectedOutput: "5 2 9" },
      { input: "1\n-2 7 0", expectedOutput: "5" },
    ],
  },
  {
    id: "balanced-parentheses",
    title: "Balanced Parentheses",
    difficulty: "hard",
    tags: ["strings", "loops", "state"],
    description: `# Balanced Parentheses

Check whether every opening parenthesis has a later closing parenthesis. A closing parenthesis may never appear before its matching opening one.

## Input
One non-empty string containing only \`(\` and \`)\` characters.

## Output
Print \`balanced\` or \`not balanced\`.

### Example
Input: \`(()())\`
Output: \`balanced\``,
    starterCode: `text = input()
open_count = 0
is_balanced = True

# Track open parentheses and watch for early closing ones
`,
    solutionCode: `text = input()
open_count = 0
is_balanced = True
for character in text:
    if character == "(":
        open_count += 1
    else:
        open_count -= 1
    if open_count < 0:
        is_balanced = False
if open_count != 0:
    is_balanced = False
if is_balanced:
    print("balanced")
else:
    print("not balanced")`,
    testCases: [
      { input: "(()())", expectedOutput: "balanced" },
      { input: ")(", expectedOutput: "not balanced" },
      { input: "((())", expectedOutput: "not balanced" },
    ],
  },
  {
    id: "decimal-to-binary",
    title: "Decimal to Binary",
    difficulty: "hard",
    tags: ["number-systems", "while-loops", "strings"],
    description: `# Decimal to Binary

Convert a non-negative decimal number into binary using repeated division by 2.

## Input
One non-negative whole number.

## Output
Print its binary representation with no leading zeroes.

### Example
Input: \`10\`
Output: \`1010\``,
    starterCode: `number = int(input())
binary = ""

# Build binary digits from right to left
`,
    solutionCode: `number = int(input())
if number == 0:
    print(0)
else:
    binary = ""
    while number > 0:
        binary = str(number % 2) + binary
        number = number // 2
    print(binary)`,
    testCases: [
      { input: "10", expectedOutput: "1010" },
      { input: "1", expectedOutput: "1" },
      { input: "0", expectedOutput: "0" },
      { input: "42", expectedOutput: "101010" },
    ],
  },
  {
    id: "greatest-common-divisor",
    title: "Greatest Common Divisor",
    difficulty: "hard",
    tags: ["number-theory", "while-loops", "euclidean-algorithm"],
    description: `# Greatest Common Divisor

Find the largest positive number that divides two numbers with no remainder.

## Input
Two positive whole numbers, one per line.

## Output
Print their greatest common divisor.

### Example
Input: \`18\` and \`24\`
Output: \`6\``,
    starterCode: `first = int(input())
second = int(input())

# Replace the pair using division remainders
`,
    solutionCode: `first = int(input())
second = int(input())
while second != 0:
    remainder = first % second
    first = second
    second = remainder
print(first)`,
    testCases: [
      { input: "18\n24", expectedOutput: "6" },
      { input: "17\n5", expectedOutput: "1" },
      { input: "48\n16", expectedOutput: "16" },
    ],
  },
  {
    id: "anagram-phrases",
    title: "Anagram Phrases",
    difficulty: "hard",
    tags: ["strings", "sorting", "normalization"],
    description: `# Anagram Phrases

Two phrases are anagrams when they contain the same letters in a different order. Ignore spaces and capital letters.

## Input
Two phrases, one per line.

## Output
Print \`anagrams\` or \`not anagrams\`.

### Example
Input: \`Dormitory\` and \`Dirty room\`
Output: \`anagrams\``,
    starterCode: `first = input().lower().replace(" ", "")
second = input().lower().replace(" ", "")

# Compare the sorted letters
`,
    solutionCode: `first = input().lower().replace(" ", "")
second = input().lower().replace(" ", "")
if sorted(first) == sorted(second):
    print("anagrams")
else:
    print("not anagrams")`,
    testCases: [
      { input: "Dormitory\nDirty room", expectedOutput: "anagrams" },
      { input: "listen\nsilent", expectedOutput: "anagrams" },
      { input: "python\ntyphoon", expectedOutput: "not anagrams" },
    ],
  },
  {
    id: "longest-equal-streak",
    title: "Longest Equal Streak",
    difficulty: "hard",
    tags: ["lists", "state", "sequences"],
    description: `# Longest Equal Streak

Find the longest run of the same number appearing consecutively.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the repeated number followed by the streak length. If streaks tie, keep the first one.

### Example
Input: \`1 2 2 2 3 3\`
Output: \`2 3\``,
    starterCode: `numbers = [int(value) for value in input().split()]
best_number = numbers[0]
best_length = 1
current_length = 1

# Compare each number with the one before it
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
best_number = numbers[0]
best_length = 1
current_length = 1
for index in range(1, len(numbers)):
    if numbers[index] == numbers[index - 1]:
        current_length += 1
    else:
        current_length = 1
    if current_length > best_length:
        best_length = current_length
        best_number = numbers[index]
print(best_number, best_length)`,
    testCases: [
      { input: "1 2 2 2 3 3", expectedOutput: "2 3" },
      { input: "5 5 4 4", expectedOutput: "5 2" },
      { input: "9", expectedOutput: "9 1" },
    ],
  },
  {
    id: "transpose-grid",
    title: "Transpose a Grid",
    difficulty: "hard",
    tags: ["grids", "nested-loops", "lists"],
    description: `# Transpose a Grid

Turn every column of a number grid into a row.

## Input
The first line contains the row count and column count. The remaining lines contain the grid rows.

## Output
Print the transposed grid with one row per line.

### Example
Input grid: \`1 2 3\` and \`4 5 6\`
Output rows: \`1 4\`, \`2 5\`, and \`3 6\``,
    starterCode: `rows, columns = [int(value) for value in input().split()]
grid = []
for row_number in range(rows):
    grid.append([int(value) for value in input().split()])

# Read each column from top to bottom
`,
    solutionCode: `rows, columns = [int(value) for value in input().split()]
grid = []
for row_number in range(rows):
    grid.append([int(value) for value in input().split()])
for column in range(columns):
    new_row = []
    for row in range(rows):
        new_row.append(grid[row][column])
    print(*new_row)`,
    testCases: [
      { input: "2 3\n1 2 3\n4 5 6", expectedOutput: "1 4\n2 5\n3 6" },
      { input: "3 1\n7\n8\n9", expectedOutput: "7 8 9" },
      { input: "2 2\n1 0\n0 1", expectedOutput: "1 0\n0 1" },
    ],
  },
  {
    id: "run-length-encoding",
    title: "Run-Length Encoding",
    difficulty: "hard",
    tags: ["compression", "strings", "state"],
    description: `# Run-Length Encoding

Compress a string by recording each consecutive character and how many times it repeats.

## Input
One non-empty lowercase word.

## Output
Print character-count groups separated by spaces.

### Example
Input: \`aaabbc\`
Output: \`a3 b2 c1\``,
    starterCode: `text = input()
groups = []
current = text[0]
count = 1

# Finish a group whenever the character changes
`,
    solutionCode: `text = input()
groups = []
current = text[0]
count = 1
for character in text[1:]:
    if character == current:
        count += 1
    else:
        groups.append(current + str(count))
        current = character
        count = 1
groups.append(current + str(count))
print(*groups)`,
    testCases: [
      { input: "aaabbc", expectedOutput: "a3 b2 c1" },
      { input: "abcd", expectedOutput: "a1 b1 c1 d1" },
      { input: "zzzzz", expectedOutput: "z5" },
    ],
  },
  {
    id: "bubble-sort",
    title: "Bubble Sort",
    difficulty: "hard",
    tags: ["sorting", "nested-loops", "swapping"],
    description: `# Bubble Sort

Sort numbers from smallest to largest by repeatedly swapping neighboring values that are out of order.

## Input
One line of whole numbers separated by spaces.

## Output
Print the sorted numbers.

### Example
Input: \`4 1 3 2\`
Output: \`1 2 3 4\``,
    starterCode: `numbers = [int(value) for value in input().split()]

# Make several passes and swap neighboring values

print(*numbers)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
for pass_number in range(len(numbers)):
    for index in range(len(numbers) - 1):
        if numbers[index] > numbers[index + 1]:
            numbers[index], numbers[index + 1] = numbers[index + 1], numbers[index]
print(*numbers)`,
    testCases: [
      { input: "4 1 3 2", expectedOutput: "1 2 3 4" },
      { input: "5 -1 5 0", expectedOutput: "-1 0 5 5" },
      { input: "1", expectedOutput: "1" },
    ],
  },
  {
    id: "number-pyramid",
    title: "Number Pyramid",
    difficulty: "hard",
    tags: ["patterns", "nested-loops", "lists"],
    description: `# Number Pyramid

Build rows that count upward from 1. Row n contains the numbers from 1 through n.

## Input
One whole-number height.

## Output
Print the pyramid with one row per line and spaces between numbers.

### Example
Input: \`3\`
Output rows: \`1\`, \`1 2\`, and \`1 2 3\``,
    starterCode: `height = int(input())

# Build one list for every row
`,
    solutionCode: `height = int(input())
for row_number in range(1, height + 1):
    row = []
    for number in range(1, row_number + 1):
        row.append(number)
    print(*row)`,
    testCases: [
      { input: "3", expectedOutput: "1\n1 2\n1 2 3" },
      { input: "1", expectedOutput: "1" },
      { input: "4", expectedOutput: "1\n1 2\n1 2 3\n1 2 3 4" },
    ],
  },
  {
    id: "prime-count-up-to",
    title: "Prime Count",
    difficulty: "hard",
    tags: ["primes", "nested-loops", "counting"],
    description: `# Prime Count

Count how many prime numbers are between 2 and n, including n.

## Input
One whole number n that is at least 2.

## Output
Print the number of primes in the range.

### Example
Input: \`10\`
Output: \`4\``,
    starterCode: `n = int(input())
prime_count = 0

# Test every number from 2 through n

print(prime_count)
`,
    solutionCode: `n = int(input())
prime_count = 0
for number in range(2, n + 1):
    is_prime = True
    for divisor in range(2, number):
        if number % divisor == 0:
            is_prime = False
            break
    if is_prime:
        prime_count += 1
print(prime_count)`,
    testCases: [
      { input: "10", expectedOutput: "4" },
      { input: "2", expectedOutput: "1" },
      { input: "20", expectedOutput: "8" },
    ],
  },
  {
    id: "tic-tac-toe-winner",
    title: "Tic-Tac-Toe Winner",
    difficulty: "hard",
    tags: ["games", "grids", "conditionals"],
    description: `# Tic-Tac-Toe Winner

Inspect a completed or partly completed tic-tac-toe board and find a three-in-a-row winner.

## Input
Three lines of three characters. Each character is \`X\`, \`O\`, or \`.\`.

## Output
Print \`X\`, \`O\`, or \`none\`.

### Example
Input rows: \`XXX\`, \`O.O\`, and \`...\`
Output: \`X\``,
    starterCode: `board = []
for row_number in range(3):
    board.append(list(input()))
winner = "none"

# Check rows, columns, and both diagonals
`,
    solutionCode: `board = []
for row_number in range(3):
    board.append(list(input()))
winner = "none"
lines = []
for index in range(3):
    lines.append(board[index])
    lines.append([board[0][index], board[1][index], board[2][index]])
lines.append([board[0][0], board[1][1], board[2][2]])
lines.append([board[0][2], board[1][1], board[2][0]])
for line in lines:
    if line[0] != "." and line[0] == line[1] and line[1] == line[2]:
        winner = line[0]
        break
print(winner)`,
    testCases: [
      { input: "XXX\nO.O\n...", expectedOutput: "X" },
      { input: "XO.\nXO.\n.O.", expectedOutput: "O" },
      { input: "X.O\n.XO\n..X", expectedOutput: "X" },
      { input: "XOX\nOXO\nOXO", expectedOutput: "none" },
    ],
  },
  {
    id: "binary-to-decimal",
    title: "Binary to Decimal",
    difficulty: "hard",
    tags: ["number-systems", "strings", "accumulators"],
    description: `# Binary to Decimal

Convert a binary number into decimal by reading its digits from left to right.

## Input
One string containing only 0 and 1.

## Output
Print its decimal value.

### Example
Input: \`1010\`
Output: \`10\``,
    starterCode: `binary = input()
value = 0

# Double the current value before adding each digit

print(value)
`,
    solutionCode: `binary = input()
value = 0
for digit in binary:
    value = value * 2 + int(digit)
print(value)`,
    testCases: [
      { input: "1010", expectedOutput: "10" },
      { input: "1", expectedOutput: "1" },
      { input: "0", expectedOutput: "0" },
      { input: "111111", expectedOutput: "63" },
    ],
  },
  {
    id: "mixed-brackets",
    title: "Mixed Brackets",
    difficulty: "hard",
    tags: ["stacks", "strings", "validation"],
    description: `# Mixed Brackets

Check whether parentheses, square brackets, and curly braces close in the correct nested order.

## Input
One non-empty string containing only parentheses, square brackets, and curly braces.

## Output
Print \`balanced\` or \`not balanced\`.

### Example
Input: \`{[()]}\`
Output: \`balanced\``,
    starterCode: `text = input()
stack = []
pairs = {")": "(", "]": "[", "}": "{"}
is_balanced = True

# Push openers and match every closer
`,
    solutionCode: `text = input()
stack = []
pairs = {")": "(", "]": "[", "}": "{"}
is_balanced = True
for character in text:
    if character in "([{":
        stack.append(character)
    else:
        if not stack or stack[-1] != pairs[character]:
            is_balanced = False
            break
        stack.pop()
if stack:
    is_balanced = False
if is_balanced:
    print("balanced")
else:
    print("not balanced")`,
    testCases: [
      { input: "{[()]}", expectedOutput: "balanced" },
      { input: "([)]", expectedOutput: "not balanced" },
      { input: "(()", expectedOutput: "not balanced" },
      { input: "[]{}()", expectedOutput: "balanced" },
    ],
  },
  {
    id: "longest-rising-streak",
    title: "Longest Rising Streak",
    difficulty: "hard",
    tags: ["lists", "sequences", "state"],
    description: `# Longest Rising Streak

Find the longest consecutive section where every number is greater than the one before it.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the length of the longest rising streak.

### Example
Input: \`3 5 7 2 4\`
Output: \`3\``,
    starterCode: `numbers = [int(value) for value in input().split()]
best = 1
current = 1

# Extend or restart the streak at each position
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
best = 1
current = 1
for index in range(1, len(numbers)):
    if numbers[index] > numbers[index - 1]:
        current += 1
    else:
        current = 1
    if current > best:
        best = current
print(best)`,
    testCases: [
      { input: "3 5 7 2 4", expectedOutput: "3" },
      { input: "1 2 3 4 5", expectedOutput: "5" },
      { input: "9 8 7", expectedOutput: "1" },
    ],
  },
  {
    id: "coin-change",
    title: "Coin Change",
    difficulty: "hard",
    tags: ["greedy", "money", "division"],
    description: `# Coin Change

Make an amount using the fewest US coins: quarters, dimes, nickels, then pennies.

## Input
One non-negative whole number of cents.

## Output
Print the counts of quarters, dimes, nickels, and pennies in that order.

### Example
Input: \`87\`
Output: \`3 1 0 2\``,
    starterCode: `cents = int(input())

# Take the largest possible coins first
`,
    solutionCode: `cents = int(input())
quarters = cents // 25
cents = cents % 25
dimes = cents // 10
cents = cents % 10
nickels = cents // 5
pennies = cents % 5
print(quarters, dimes, nickels, pennies)`,
    testCases: [
      { input: "87", expectedOutput: "3 1 0 2" },
      { input: "41", expectedOutput: "1 1 1 1" },
      { input: "4", expectedOutput: "0 0 0 4" },
    ],
  },
  {
    id: "selection-sort",
    title: "Selection Sort",
    difficulty: "hard",
    tags: ["sorting", "nested-loops", "swapping"],
    description: `# Selection Sort

Sort a list by finding the smallest remaining value and swapping it into the next position.

## Input
One line of whole numbers separated by spaces.

## Output
Print the numbers from smallest to largest.

### Example
Input: \`8 3 5 1\`
Output: \`1 3 5 8\``,
    starterCode: `numbers = [int(value) for value in input().split()]

# Choose the smallest remaining item for each position

print(*numbers)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
for start in range(len(numbers)):
    smallest_index = start
    for index in range(start + 1, len(numbers)):
        if numbers[index] < numbers[smallest_index]:
            smallest_index = index
    numbers[start], numbers[smallest_index] = numbers[smallest_index], numbers[start]
print(*numbers)`,
    testCases: [
      { input: "8 3 5 1", expectedOutput: "1 3 5 8" },
      { input: "-2 7 0 -2", expectedOutput: "-2 -2 0 7" },
      { input: "4", expectedOutput: "4" },
    ],
  },
  {
    id: "rotate-grid-clockwise",
    title: "Rotate a Grid",
    difficulty: "hard",
    tags: ["grids", "nested-loops", "transformations"],
    description: `# Rotate a Grid

Rotate a rectangular number grid 90 degrees clockwise.

## Input
The first line contains row and column counts. The remaining lines contain the grid.

## Output
Print the rotated grid with one row per line.

### Example
Input grid: \`1 2 3\` and \`4 5 6\`
Output rows: \`4 1\`, \`5 2\`, and \`6 3\``,
    starterCode: `rows, columns = [int(value) for value in input().split()]
grid = []
for row_number in range(rows):
    grid.append([int(value) for value in input().split()])

# Read each column from bottom to top
`,
    solutionCode: `rows, columns = [int(value) for value in input().split()]
grid = []
for row_number in range(rows):
    grid.append([int(value) for value in input().split()])
for column in range(columns):
    rotated_row = []
    for row in range(rows - 1, -1, -1):
        rotated_row.append(grid[row][column])
    print(*rotated_row)`,
    testCases: [
      { input: "2 3\n1 2 3\n4 5 6", expectedOutput: "4 1\n5 2\n6 3" },
      { input: "2 2\n1 0\n0 1", expectedOutput: "0 1\n1 0" },
      { input: "1 3\n7 8 9", expectedOutput: "7\n8\n9" },
    ],
  },
  {
    id: "first-target-pair",
    title: "First Target Pair",
    difficulty: "hard",
    tags: ["lists", "nested-loops", "searching"],
    description: `# First Target Pair

Find the first pair of values whose sum equals a target. Search from left to right.

## Input
The first line contains whole numbers. The second line contains the target. A matching pair always exists.

## Output
Print the two values in their original order.

### Example
Input list: \`2 7 11 4\`, target: \`9\`
Output: \`2 7\``,
    starterCode: `numbers = [int(value) for value in input().split()]
target = int(input())
found = False

# Try every pair until one reaches target
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
target = int(input())
found = False
for first_index in range(len(numbers)):
    for second_index in range(first_index + 1, len(numbers)):
        if numbers[first_index] + numbers[second_index] == target:
            print(numbers[first_index], numbers[second_index])
            found = True
            break
    if found:
        break`,
    testCases: [
      { input: "2 7 11 4\n9", expectedOutput: "2 7" },
      { input: "5 1 4 2\n6", expectedOutput: "5 1" },
      { input: "-3 8 2 6\n5", expectedOutput: "-3 8" },
    ],
  },
  {
    id: "roman-numeral-value",
    title: "Roman Numeral Value",
    difficulty: "hard",
    tags: ["dictionaries", "strings", "number-systems"],
    description: `# Roman Numeral Value

Convert a Roman numeral using I, V, X, L, and C. A smaller value before a larger value is subtracted.

## Input
One valid Roman numeral.

## Output
Print its whole-number value.

### Example
Input: \`XIV\`
Output: \`14\``,
    starterCode: `roman = input()
values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
total = 0

# Add values, subtracting when a larger symbol follows
`,
    solutionCode: `roman = input()
values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
total = 0
for index in range(len(roman)):
    value = values[roman[index]]
    if index + 1 < len(roman) and value < values[roman[index + 1]]:
        total -= value
    else:
        total += value
print(total)`,
    testCases: [
      { input: "XIV", expectedOutput: "14" },
      { input: "XL", expectedOutput: "40" },
      { input: "VIII", expectedOutput: "8" },
      { input: "XCIX", expectedOutput: "99" },
    ],
  },
  {
    id: "pascal-row",
    title: "Pascal Row",
    difficulty: "hard",
    tags: ["sequences", "lists", "nested-loops"],
    description: `# Pascal Row

Build row n of Pascal's triangle. Row 0 is \`1\`. Every inside value is the sum of the two values above it.

## Input
One non-negative row number n.

## Output
Print the values in row n separated by spaces.

### Example
Input: \`4\`
Output: \`1 4 6 4 1\``,
    starterCode: `row_number = int(input())
row = [1]

# Build the next row repeatedly

print(*row)
`,
    solutionCode: `row_number = int(input())
row = [1]
for step in range(row_number):
    next_row = [1]
    for index in range(len(row) - 1):
        next_row.append(row[index] + row[index + 1])
    next_row.append(1)
    row = next_row
print(*row)`,
    testCases: [
      { input: "4", expectedOutput: "1 4 6 4 1" },
      { input: "0", expectedOutput: "1" },
      { input: "5", expectedOutput: "1 5 10 10 5 1" },
    ],
  },
  {
    id: "inventory-ledger",
    title: "Inventory Ledger",
    difficulty: "hard",
    tags: ["dictionaries", "aggregation", "input"],
    description: `# Inventory Ledger

Combine repeated inventory updates for each item while keeping items in first-seen order.

## Input
The first line is the update count. Each remaining line contains an item name and a whole-number change.

## Output
Print \`item:total\` entries separated by spaces.

### Example
Input updates: \`apple 3\`, \`pear 2\`, \`apple -1\`
Output: \`apple:2 pear:2\``,
    starterCode: `update_count = int(input())
inventory = {}

# Add every change to the matching item
`,
    solutionCode: `update_count = int(input())
inventory = {}
for update_number in range(update_count):
    item, change = input().split()
    if item not in inventory:
        inventory[item] = 0
    inventory[item] += int(change)
results = []
for item in inventory:
    results.append(item + ":" + str(inventory[item]))
print(*results)`,
    testCases: [
      { input: "3\napple 3\npear 2\napple -1", expectedOutput: "apple:2 pear:2" },
      { input: "2\nbook 5\nbook 4", expectedOutput: "book:9" },
      { input: "4\na 1\nb 2\nc 3\nb -1", expectedOutput: "a:1 b:1 c:3" },
    ],
  },
];
