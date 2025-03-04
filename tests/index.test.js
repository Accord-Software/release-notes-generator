jest.mock("@actions/core")
jest.mock("@actions/github")
jest.mock("openai")

const core = require("@actions/core")
const github = require("@actions/github")
const { OpenAIApi } = require("openai")

// Import all exported functions
const {
  fetchReleaseData,
  generateReleaseNotes,
  parseReleaseNotes,
  generateAppStoreReleaseNotes,
  runAsGitHubAction,
} = require("../index")

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
<en_release_notes>
• Added dark mode for better nighttime viewing
• Improved app performance for a smoother experience
• Fixed image loading and login issues
</en_release_notes>

<sv_release_notes>
• Lagt till mörkt läge för bättre visning på natten
• Förbättrad appprestanda för en smidigare upplevelse
• Fixat problem med bildladdning och inloggning
</sv_release_notes>

<fr_release_notes>
• Ajout du mode sombre pour une meilleure visualisation nocturne
• Amélioration des performances de l'application pour une expérience plus fluide
• Correction des problèmes de chargement d'images et de connexion
</fr_release_notes>

<de_release_notes>
• Dunkelmodus für bessere Sichtbarkeit in der Nacht hinzugefügt
• Verbesserte App-Leistung für ein reibungsloseres Erlebnis
• Behobene Probleme beim Bildladen und bei der Anmeldung
</de_release_notes>
          `,
        },
      },
    ],
  },
}

describe("fetchReleaseData function", () => {
  let mockOctokit

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getLatestRelease: jest.fn().mockResolvedValue({ data: mockRelease }),
          getReleaseByTag: jest.fn().mockResolvedValue({ data: mockRelease }),
        },
      },
    }
  })

  test('fetches latest release when tag is "latest"', async () => {
    await fetchReleaseData(mockOctokit, "testOwner", "testRepo", "latest")

    expect(mockOctokit.rest.repos.getLatestRelease).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
    })
    expect(mockOctokit.rest.repos.getReleaseByTag).not.toHaveBeenCalled()
  })

  test("fetches specific release when tag is provided", async () => {
    await fetchReleaseData(mockOctokit, "testOwner", "testRepo", "v1.0.0")

    expect(mockOctokit.rest.repos.getReleaseByTag).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
      tag: "v1.0.0",
    })
    expect(mockOctokit.rest.repos.getLatestRelease).not.toHaveBeenCalled()
  })
})

describe("generateReleaseNotes function", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    OpenAIApi.prototype.createChatCompletion = jest
      .fn()
      .mockResolvedValue(mockOpenAIResponse)
  })

  test("calls OpenAI with correct parameters", async () => {
    await generateReleaseNotes("Test release notes", 500, "mock-api-key")

    expect(OpenAIApi.prototype.createChatCompletion).toHaveBeenCalled()
    const call = OpenAIApi.prototype.createChatCompletion.mock.calls[0][0]

    expect(call.model).toBe("gpt-4o")
    expect(call.messages[0].role).toBe("system")
    expect(call.messages[1].content).toContain("Test release notes")
    expect(call.messages[1].content).toContain("500")
  })

  test("calls OpenAI with custom languages", async () => {
    await generateReleaseNotes("Test release notes", 500, "mock-api-key", [
      "en",
      "de",
    ])

    expect(OpenAIApi.prototype.createChatCompletion).toHaveBeenCalled()
    const call = OpenAIApi.prototype.createChatCompletion.mock.calls[0][0]

    expect(call.messages[1].content).toContain("English (en), German (de)")
  })

  test("returns OpenAI response content", async () => {
    const result = await generateReleaseNotes(
      "Test release notes",
      500,
      "mock-api-key"
    )

    expect(result).toEqual(mockOpenAIResponse.data.choices[0].message.content)
  })

  test("handles OpenAI API errors", async () => {
    const mockError = new Error("API error")
    OpenAIApi.prototype.createChatCompletion.mockRejectedValueOnce(mockError)

    await expect(generateReleaseNotes("Test", 500, "key")).rejects.toThrow(
      "API error"
    )
  })
})

describe("parseReleaseNotes function", () => {
  test("correctly extracts all language notes", () => {
    const result = parseReleaseNotes(
      mockOpenAIResponse.data.choices[0].message.content
    )

    expect(result).toEqual({
      en: "• Added dark mode for better nighttime viewing\n• Improved app performance for a smoother experience\n• Fixed image loading and login issues",
      sv: "• Lagt till mörkt läge för bättre visning på natten\n• Förbättrad appprestanda för en smidigare upplevelse\n• Fixat problem med bildladdning och inloggning",
      fr: "• Ajout du mode sombre pour une meilleure visualisation nocturne\n• Amélioration des performances de l'application pour une expérience plus fluide\n• Correction des problèmes de chargement d'images et de connexion",
    })
  })

  test("correctly extracts custom language notes", () => {
    const result = parseReleaseNotes(
      mockOpenAIResponse.data.choices[0].message.content,
      ["en", "de"]
    )

    expect(result).toEqual({
      en: "• Added dark mode for better nighttime viewing\n• Improved app performance for a smoother experience\n• Fixed image loading and login issues",
      de: "• Dunkelmodus für bessere Sichtbarkeit in der Nacht hinzugefügt\n• Verbesserte App-Leistung für ein reibungsloseres Erlebnis\n• Behobene Probleme beim Bildladen und bei der Anmeldung",
    })
  })

  test("returns empty strings for missing language notes", () => {
    const incompleteResponse = `
<en_release_notes>
English notes
</en_release_notes>
`
    const result = parseReleaseNotes(incompleteResponse, ["en", "sv", "fr"])

    expect(result).toEqual({
      en: "English notes",
      sv: "",
      fr: "",
    })
  })

  test("handles empty input", () => {
    const result = parseReleaseNotes("")

    expect(result).toEqual({
      en: "",
      sv: "",
      fr: "",
    })
  })
})

describe("generateAppStoreReleaseNotes function", () => {
  let mockOctokit

  beforeEach(() => {
    jest.resetAllMocks()

    mockOctokit = {
      rest: {
        repos: {
          getLatestRelease: jest.fn().mockResolvedValue({ data: mockRelease }),
          getReleaseByTag: jest.fn().mockResolvedValue({ data: mockRelease }),
        },
      },
    }

    github.getOctokit = jest.fn().mockReturnValue(mockOctokit)

    OpenAIApi.prototype.createChatCompletion = jest
      .fn()
      .mockResolvedValue(mockOpenAIResponse)
  })

  test("successfully generates release notes", async () => {
    const result = await generateAppStoreReleaseNotes({
      githubToken: "mock-token",
      owner: "testOwner",
      repo: "testRepo",
      releaseTag: "latest",
      openaiApiKey: "mock-api-key",
      maxLength: 500,
    })

    expect(result.success).toBe(true)
    expect(result.releaseNotes).toHaveProperty("en")
    expect(result.releaseNotes).toHaveProperty("sv")
    expect(result.releaseNotes).toHaveProperty("fr")
    expect(result.originalReleaseNotes).toBe(mockRelease.body)
  })

  test("handles errors gracefully", async () => {
    mockOctokit.rest.repos.getLatestRelease.mockRejectedValueOnce(
      new Error("GitHub API error")
    )

    const result = await generateAppStoreReleaseNotes({
      githubToken: "mock-token",
      owner: "testOwner",
      repo: "testRepo",
      releaseTag: "latest",
      openaiApiKey: "mock-api-key",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("GitHub API error")
  })
})

describe("runAsGitHubAction function", () => {
  beforeEach(() => {
    jest.resetAllMocks()

    // Mock core functions
    core.getInput = jest.fn((input) => {
      if (input === "github_token") return "mock_token"
      if (input === "release_tag") return "latest"
      if (input === "openai_api_key") return "mock_openai_key"
      if (input === "max_length") return "450"
      if (input === "languages") return "en,fr,de"
      return ""
    })
    core.setOutput = jest.fn()
    core.setFailed = jest.fn()

    // Mock GitHub context
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

  test("sets action outputs correctly", async () => {
    await runAsGitHubAction()

    // Check JSON output
    expect(core.setOutput).toHaveBeenCalledWith(
      "release_notes",
      expect.any(String)
    )

    // Check individual outputs for backward compatibility
    expect(core.setOutput).toHaveBeenCalledWith(
      "en_release_notes",
      expect.stringContaining("Added dark mode")
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      "fr_release_notes",
      expect.stringContaining("Ajout du mode sombre")
    )
  })

  test("handles custom languages", async () => {
    await runAsGitHubAction()

    // Check language codes output
    expect(core.setOutput).toHaveBeenCalledWith("language_codes", "en,fr,de")
  })

  test("handles errors correctly", async () => {
    OpenAIApi.prototype.createChatCompletion.mockRejectedValueOnce(
      new Error("API error")
    )

    await runAsGitHubAction()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("API error")
    )
  })
})
