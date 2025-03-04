jest.mock("@actions/core")
jest.mock("@actions/github")
jest.mock("openai")

const core = require("@actions/core")
const github = require("@actions/github")
const { Configuration, OpenAIApi } = require("openai")

// Store the original implementation to restore it after test
const originalRun = require("../index")

// Mock data
const mockRelease = {
  body: "## What's Changed\n* Fix crash when loading images\n* Add dark mode support\n* Improve performance\n* Fix login issues",
  tag_name: "v1.2.0",
}

const mockOpenAIResponse = {
  data: {
    choices: [
      {
        message: {
          content: `
<english_release_notes>
• Added dark mode for better nighttime viewing
• Improved app performance for a smoother experience
• Fixed image loading and login issues
</english_release_notes>

<swedish_release_notes>
• Lagt till mörkt läge för bättre visning på natten
• Förbättrad appprestanda för en smidigare upplevelse
• Fixat problem med bildladdning och inloggning
</swedish_release_notes>

<french_release_notes>
• Ajout du mode sombre pour une meilleure visualisation nocturne
• Amélioration des performances de l'application pour une expérience plus fluide
• Correction des problèmes de chargement d'images et de connexion
</french_release_notes>
          `,
        },
      },
    ],
  },
}

describe("Release Notes Generator", () => {
  beforeEach(() => {
    jest.resetAllMocks()

    // Mock core functions
    core.getInput = jest.fn((input) => {
      if (input === "github_token") return "mock_token"
      if (input === "release_tag") return "latest"
      if (input === "openai_api_key") return "mock_openai_key"
      if (input === "max_length") return "450"
      return ""
    })
    core.setOutput = jest.fn()
    core.setFailed = jest.fn()

    // Mock GitHub context and API
    github.context = {
      repo: {
        owner: "testOwner",
        repo: "testRepo",
      },
    }

    const mockOctokit = {
      rest: {
        repos: {
          getLatestRelease: jest.fn().mockResolvedValue({ data: mockRelease }),
          getReleaseByTag: jest.fn().mockResolvedValue({ data: mockRelease }),
        },
      },
    }

    github.getOctokit = jest.fn().mockReturnValue(mockOctokit)

    // Mock OpenAI
    OpenAIApi.prototype.createChatCompletion = jest
      .fn()
      .mockResolvedValue(mockOpenAIResponse)
  })

  test('fetches latest release when tag is "latest"', async () => {
    await originalRun()

    const octokit = github.getOctokit()
    expect(octokit.rest.repos.getLatestRelease).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
    })
    expect(octokit.rest.repos.getReleaseByTag).not.toHaveBeenCalled()
  })

  test("fetches specific release when tag is provided", async () => {
    core.getInput = jest.fn((input) => {
      if (input === "github_token") return "mock_token"
      if (input === "release_tag") return "v1.0.0"
      if (input === "openai_api_key") return "mock_openai_key"
      if (input === "max_length") return "450"
      return ""
    })

    await originalRun()

    const octokit = github.getOctokit()
    expect(octokit.rest.repos.getReleaseByTag).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
      tag: "v1.0.0",
    })
    expect(octokit.rest.repos.getLatestRelease).not.toHaveBeenCalled()
  })

  test("calls OpenAI with the correct prompt", async () => {
    await originalRun()

    expect(OpenAIApi.prototype.createChatCompletion).toHaveBeenCalled()
    const call = OpenAIApi.prototype.createChatCompletion.mock.calls[0][0]
    expect(call.model).toBe("gpt-4")
    expect(call.messages[0].role).toBe("system")
    expect(call.messages[1].content).toContain(mockRelease.body)
  })

  test("extracts and sets release notes correctly", async () => {
    await originalRun()

    expect(core.setOutput).toHaveBeenCalledWith(
      "en_release_notes",
      expect.stringContaining("Added dark mode")
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      "sv_release_notes",
      expect.stringContaining("Lagt till mörkt läge")
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      "fr_release_notes",
      expect.stringContaining("Ajout du mode sombre")
    )
  })

  test("handles errors correctly", async () => {
    const mockError = new Error("Test error")
    OpenAIApi.prototype.createChatCompletion.mockRejectedValueOnce(mockError)

    await originalRun()

    expect(core.setFailed).toHaveBeenCalledWith(
      `Action failed with error: ${mockError}`
    )
  })
})
