#!/usr/bin/env node

const {
  generateReleaseNotes,
  parseReleaseNotes,
  createCombinedReleaseNotes,
} = require("./index")
const readline = require("readline")
const fs = require("fs").promises

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

        rl.question(
          "Languages (comma-separated, default: en,sv,fr): ",
          (languagesInput) => {
            const languages = languagesInput
              ? languagesInput.split(",").map((l) => l.trim().toLowerCase())
              : ["en", "sv", "fr"]

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
                languages,
              })
            })
          }
        )
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
      input.openaiApiKey,
      input.languages
    )

    // Parse the response
    const releaseNotes = parseReleaseNotes(assistantResponse, input.languages)

    // Display results for all languages
    for (const [lang, notes] of Object.entries(releaseNotes)) {
      console.log(`\n=== ${lang.toUpperCase()} Release Notes ===`)
      console.log(notes || "No notes generated for this language.")
    }

    // Create and display combined release notes
    const combinedNotes = createCombinedReleaseNotes(
      releaseNotes,
      input.languages
    )

    console.log("\n=== COMBINED RELEASE NOTES ===")
    console.log(combinedNotes)

    // Ask user if they want to save the output
    rl.question(
      "\nDo you want to save these release notes to a file? (y/n): ",
      async (answer) => {
        if (answer.toLowerCase() === "y") {
          await fs.writeFile("release-notes.md", combinedNotes)
          console.log("Release notes saved to release-notes.md")
        }
        rl.close()
      }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    rl.close()
  }
}

run()
