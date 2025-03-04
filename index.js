const core = require("@actions/core")
const github = require("@actions/github")
const { Configuration, OpenAIApi } = require("openai")

/**
 * Fetches release data from GitHub repository
 */
async function fetchReleaseData(octokit, owner, repo, releaseTag) {
  if (releaseTag === "latest") {
    // Get latest release
    const { data: latestRelease } = await octokit.rest.repos.getLatestRelease({
      owner,
      repo,
    })
    return latestRelease
  } else {
    // Get specific release
    const { data: specificRelease } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: releaseTag,
    })
    return specificRelease
  }
}

/**
 * Generates user-friendly release notes in multiple languages using OpenAI
 */
async function generateReleaseNotes(
  originalReleaseNotes,
  maxLength,
  openaiApiKey,
  languages = ["en", "sv", "fr"]
) {
  // Initialize OpenAI
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  })
  const openai = new OpenAIApi(configuration)

  // Generate language tags for prompt
  const languageTags = languages.map((lang) => {
    const languageNames = {
      en: "English",
      sv: "Swedish",
      fr: "French",
      de: "German",
      es: "Spanish",
      it: "Italian",
      ja: "Japanese",
      ko: "Korean",
      pt: "Portuguese",
      ru: "Russian",
      zh: "Chinese",
      nl: "Dutch",
      pl: "Polish",
      tr: "Turkish",
      ar: "Arabic",
      da: "Danish",
      fi: "Finnish",
      no: "Norwegian",
      cs: "Czech",
      hu: "Hungarian",
      ro: "Romanian",
      sk: "Slovak",
      th: "Thai",
      vi: "Vietnamese",
      id: "Indonesian",
      hi: "Hindi",
      he: "Hebrew",
      bg: "Bulgarian",
      el: "Greek",
      hr: "Croatian",
      lt: "Lithuanian",
      sl: "Slovenian",
      et: "Estonian",
      lv: "Latvian",
      ms: "Malay",
      sw: "Swahili",
      tl: "Tagalog",
      uk: "Ukrainian",
      bg: "Bulgarian",
      is: "Icelandic",
      sk: "Slovak",
      sr: "Serbian",
      cy: "Welsh",
      ca: "Catalan",
      bn: "Bengali",
      sw: "Swahili",
    }

    return {
      code: lang,
      name: languageNames[lang] || lang.toUpperCase(),
      outputTag: `<${lang}_release_notes>`,
    }
  })

  // Language description for prompt
  const languageDescription = languageTags
    .map((lang) => `${lang.name} (${lang.code})`)
    .join(", ")

  // Output format instructions for prompt
  const outputFormatInstructions = languageTags
    .map(
      (lang) =>
        `<${lang.code}_release_notes>\n[${lang.name} version here]\n</${lang.code}_release_notes>`
    )
    .join("\n\n")

  // New prompt template
  const promptTemplate = `
You are an AI assistant specialized in creating user-friendly release notes for mobile apps. Your task is to convert technical GitHub release notes into consumer-friendly descriptions suitable for app stores, and then translate them into multiple languages.

First, here are the original GitHub release notes:

<original_release_notes>
{{ORIGINAL_RELEASE_NOTES}}
</original_release_notes>

And here is the maximum character length for the final release notes:

<max_length>
{{MAX_LENGTH}}
</max_length>

Please follow these steps to create the release notes in the following languages: {{LANGUAGES}}

1. Read through the original release notes carefully.

2. Inside <release_notes_planning> tags, analyze the notes and plan your approach:
   a. List key features, improvements, and bug fixes that will be most relevant to end-users.
   b. Brainstorm user-friendly phrasing for each item.
   c. Plan the structure (bullet points vs. paragraph).
   d. Consider idiomatic expressions or culture-specific phrases for each language.
   e. Draft a sample English version and count its characters to ensure it's within the limit.

3. Create versions of the release notes for each requested language, following these guidelines:
   - Remove any technical details or implementation specifics.
   - Omit very minor changes that users won't notice.
   - Focus on new features, improvements, and bug fixes that impact the user experience.
   - Keep it concise but informative.
   - Use bullet points if there are multiple changes.
   - Ensure a friendly and enthusiastic tone.
   - Stay within the specified character limit.
   - Ensure the translations feel native and idiomatic to each language.
   - Be cautious with technical terms - use the accepted term in each language rather than a literal translation.
   - Maintain the friendly and enthusiastic tone in each language.

4. Present your final output in the following format:

{{OUTPUT_FORMAT}}

Remember to check that each language version adheres to the character limit and captures the essence of the updates in a user-friendly manner.
`

  // Replace placeholders in the template
  const prompt = promptTemplate
    .replace("{{ORIGINAL_RELEASE_NOTES}}", originalReleaseNotes)
    .replace("{{MAX_LENGTH}}", maxLength.toString())
    .replace("{{LANGUAGES}}", languageDescription)
    .replace("{{OUTPUT_FORMAT}}", outputFormatInstructions)

  // Call OpenAI API
  const response = await openai.createChatCompletion({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that transforms technical release notes into user-friendly app store release notes in multiple languages.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 3000,
    temperature: 0.7,
  })

  return response.data.choices[0].message.content
}

/**
 * Parses OpenAI response to extract language-specific release notes
 */
function parseReleaseNotes(assistantResponse, languages = ["en", "sv", "fr"]) {
  const result = {}

  // Parse each language
  for (const lang of languages) {
    const regex = new RegExp(
      `<${lang}_release_notes>([\\s\\S]*?)</${lang}_release_notes>`,
      "i"
    )
    const match = assistantResponse.match(regex)
    result[lang] = match ? match[1].trim() : ""
  }

  return result
}

/**
 * Main function that can be used both in GitHub Actions and standalone
 */
async function generateAppStoreReleaseNotes({
  githubToken,
  owner,
  repo,
  releaseTag = "latest",
  openaiApiKey,
  maxLength = 500,
  languages = ["en", "sv", "fr"],
}) {
  try {
    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken)

    // Get release info
    const releaseData = await fetchReleaseData(octokit, owner, repo, releaseTag)

    // Extract original release notes
    const originalReleaseNotes = releaseData.body || ""

    // Generate release notes
    const assistantResponse = await generateReleaseNotes(
      originalReleaseNotes,
      maxLength,
      openaiApiKey,
      languages
    )

    // Parse the response
    const releaseNotes = parseReleaseNotes(assistantResponse, languages)

    return {
      success: true,
      releaseNotes,
      originalReleaseNotes,
      releaseData,
      languages,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error),
    }
  }
}

/**
 * Function to run as GitHub Action
 */
async function runAsGitHubAction() {
  try {
    // Get inputs from GitHub Actions
    const githubToken = core.getInput("github_token", { required: true })
    const releaseTag = core.getInput("release_tag")
    const openaiApiKey = core.getInput("openai_api_key", { required: true })
    const maxLength = parseInt(core.getInput("max_length"))
    const languagesInput = core.getInput("languages")

    // Parse languages input
    const languages = languagesInput
      ? languagesInput.split(",").map((lang) => lang.trim().toLowerCase())
      : ["en", "sv", "fr"]

    const context = github.context
    const owner = context.repo.owner
    const repo = context.repo.repo

    // Run the main function
    const result = await generateAppStoreReleaseNotes({
      githubToken,
      owner,
      repo,
      releaseTag,
      openaiApiKey,
      maxLength,
      languages,
    })

    if (!result.success) {
      core.setFailed(`Action failed with error: ${result.error}`)
      return
    }

    // Set combined output as JSON for more robust handling
    core.setOutput("release_notes", JSON.stringify(result.releaseNotes))
    core.setOutput("language_codes", languages.join(","))

    // Set individual outputs for backward compatibility
    for (const [lang, notes] of Object.entries(result.releaseNotes)) {
      core.setOutput(`${lang}_release_notes`, notes)
    }

    // Log success
    console.log(
      `Successfully generated app store release notes in ${
        languages.length
      } languages: ${languages.join(", ")}`
    )
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

// Run as GitHub Action if this is the entry point
if (require.main === module) {
  runAsGitHubAction()
}

// Export functions for testing and reuse
module.exports = {
  fetchReleaseData,
  generateReleaseNotes,
  parseReleaseNotes,
  generateAppStoreReleaseNotes,
  runAsGitHubAction,
}
