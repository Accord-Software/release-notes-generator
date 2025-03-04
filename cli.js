#!/usr/bin/env node

const { generateReleaseNotes, parseReleaseNotes } = require("./index")
const readline = require("readline")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

async function promptForInput() {
  return new Promise((resolve) => {
    console.log("\n--- Release Notes Generator CLI ---")

    console.log("\nEnter release notes (type 'EOF' on a new line when done):")
    let releaseNotesInput = ""

    const collectReleaseNotes = (line) => {
      if (line === "EOF") {
        rl.removeListener("line", collectReleaseNotes)

        rl.question("Max Length (default: 500): ", (maxLengthInput) => {
          const maxLength = maxLengthInput ? parseInt(maxLengthInput) : 500

          // Check for OpenAI API key in environment
          const openaiApiKey = process.env.OPENAI_API_KEY
          if (!openaiApiKey) {
            console.error(
              "Error: OPENAI_API_KEY environment variable is not set"
            )
            process.exit(1)
          }

          resolve({
            originalReleaseNotes: releaseNotesInput,
            maxLength,
            openaiApiKey,
          })
        })
      } else {
        releaseNotesInput += line + "\n"
      }
    }

    rl.on("line", collectReleaseNotes)
  })
}

async function run() {
  try {
    const input = await promptForInput()
    console.log("\nGenerating release notes...")

    // Generate release notes directly
    const assistantResponse = await generateReleaseNotes(
      input.originalReleaseNotes,
      input.maxLength,
      input.openaiApiKey
    )

    // Parse the response
    const releaseNotes = parseReleaseNotes(assistantResponse)

    console.log("\n=== English Release Notes ===")
    console.log(releaseNotes.en)

    console.log("\n=== Swedish Release Notes ===")
    console.log(releaseNotes.sv)

    console.log("\n=== French Release Notes ===")
    console.log(releaseNotes.fr)
  } catch (error) {
    console.error("Unexpected error:", error)
  } finally {
    rl.close()
  }
}

run()
