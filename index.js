const core = require("@actions/core")
const github = require("@actions/github")
const { Configuration, OpenAIApi } = require("openai")

async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput("github_token", { required: true })
    const releaseTag = core.getInput("release_tag")
    const openaiApiKey = core.getInput("openai_api_key", { required: true })
    const maxLength = parseInt(core.getInput("max_length"))

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken)
    const context = github.context

    // Get release info
    let releaseData
    if (releaseTag === "latest") {
      // Get latest release
      const { data: latestRelease } = await octokit.rest.repos.getLatestRelease(
        {
          owner: context.repo.owner,
          repo: context.repo.repo,
        }
      )
      releaseData = latestRelease
    } else {
      // Get specific release
      const { data: specificRelease } =
        await octokit.rest.repos.getReleaseByTag({
          owner: context.repo.owner,
          repo: context.repo.repo,
          tag: releaseTag,
        })
      releaseData = specificRelease
    }

    // Extract original release notes
    const originalReleaseNotes = releaseData.body || ""

    // Initialize OpenAI
    const configuration = new Configuration({
      apiKey: openaiApiKey,
    })
    const openai = new OpenAIApi(configuration)

    // New prompt template
    const promptTemplate = `
You are an AI assistant specialized in creating user-friendly release notes for mobile apps. Your task is to convert technical GitHub release notes into consumer-friendly descriptions suitable for app stores, and then translate them into multiple languages.

First, here are the original GitHub release notes:

<original_release_notes>
{{ORIGINALRELEASENOTES}}
</original_release_notes>

And here is the maximum character length for the final release notes:

<max_length>
{{MAXLENGTH}}
</max_length>

Please follow these steps to create the release notes:

1. Read through the original release notes carefully.

2. Inside <release_notes_planning> tags, analyze the notes and plan your approach:
   a. List key features, improvements, and bug fixes that will be most relevant to end-users.
   b. Brainstorm user-friendly phrasing for each item.
   c. Plan the structure (bullet points vs. paragraph).
   d. Consider idiomatic expressions or culture-specific phrases for each language (English, Swedish, French).
   e. Draft a sample English version and count its characters to ensure it's within the limit.

3. Create the English version of the release notes, following these guidelines:
   - Remove any technical details or implementation specifics.
   - Omit very minor changes that users won't notice.
   - Focus on new features, improvements, and bug fixes that impact the user experience.
   - Keep it concise but informative.
   - Use bullet points if there are multiple changes.
   - Ensure a friendly and enthusiastic tone.
   - Stay within the specified character limit.

4. Translate the release notes into Swedish and French. When translating:
   - Ensure the translations feel native and idiomatic to each language.
   - Be cautious with technical terms - use the accepted term in each language rather than a literal translation.
   - Maintain the friendly and enthusiastic tone in each language.

5. Present your final output in the following format:

<english_release_notes>
[English version here]
</english_release_notes>

<swedish_release_notes>
[Swedish version here]
</swedish_release_notes>

<french_release_notes>
[French version here]
</french_release_notes>

Remember to check that each language version adheres to the character limit and captures the essence of the updates in a user-friendly manner.
`

    // Replace placeholders in the template
    const prompt = promptTemplate
      .replace("{{ORIGINALRELEASENOTES}}", originalReleaseNotes)
      .replace("{{MAXLENGTH}}", maxLength.toString())

    // Call OpenAI API
    const response = await openai.createChatCompletion({
      model: "gpt-4",
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

    // Extract response content
    const assistantResponse = response.data.choices[0].message.content

    // Parse out the language-specific notes using regex with the new tags
    const enMatch = assistantResponse.match(
      /<english_release_notes>([\s\S]*?)<\/english_release_notes>/
    )
    const svMatch = assistantResponse.match(
      /<swedish_release_notes>([\s\S]*?)<\/swedish_release_notes>/
    )
    const frMatch = assistantResponse.match(
      /<french_release_notes>([\s\S]*?)<\/french_release_notes>/
    )

    const enReleaseNotes = enMatch ? enMatch[1].trim() : ""
    const svReleaseNotes = svMatch ? svMatch[1].trim() : ""
    const frReleaseNotes = frMatch ? frMatch[1].trim() : ""

    // Set outputs
    core.setOutput("en_release_notes", enReleaseNotes)
    core.setOutput("sv_release_notes", svReleaseNotes)
    core.setOutput("fr_release_notes", frReleaseNotes)

    // Log success
    console.log(
      "Successfully generated app store release notes in three languages"
    )
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

// Run the action
run()

module.exports = run
