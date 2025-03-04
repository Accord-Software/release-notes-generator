# Release Notes Generator

![GitHub release (latest by date)](https://img.shields.io/github/v/release/Accord-Software/release-notes-generator)
![License](https://img.shields.io/github/license/Accord-Software/release-notes-generator)

A GitHub Action to generate user-friendly release notes for app stores in multiple languages (English, Swedish, and French) using OpenAI.

## Overview

This action automatically transforms technical GitHub release notes into consumer-friendly descriptions suitable for app stores. It uses OpenAI's GPT models to:

1. Extract key features, improvements, and bug fixes from your technical release notes
2. Rewrite them in a user-friendly, concise format
3. Translate them into multiple languages (currently English, Swedish, and French)
4. Ensure they stay within character limits required by app stores

## Usage

### Basic Workflow

Add this to your GitHub workflow file:

```yaml
name: Generate App Store Release Notes

on:
  release:
    types: [published]

jobs:
  generate-release-notes:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v3

      - name: Generate App Store Release Notes
        id: release_notes
        uses: Accord-Software/release-notes-generator@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}

      - name: Display Generated Release Notes
        run: |
          echo "English Release Notes:"
          echo "${{ steps.release_notes.outputs.en_release_notes }}"
```

### Inputs

| Input            | Description                                    | Required | Default  |
| ---------------- | ---------------------------------------------- | -------- | -------- |
| `github_token`   | GitHub token for accessing release information | Yes      | N/A      |
| `openai_api_key` | OpenAI API key                                 | Yes      | N/A      |
| `release_tag`    | The tag of the release to generate notes for   | No       | `latest` |
| `max_length`     | Maximum character length for release notes     | No       | `500`    |

### Outputs

| Output             | Description              |
| ------------------ | ------------------------ |
| `en_release_notes` | Release notes in English |
| `sv_release_notes` | Release notes in Swedish |
| `fr_release_notes` | Release notes in French  |

## Example Workflows

For complete workflow examples, check the workflow file in this repository:
[.github/workflows/release-notes.yml](.github/workflows/release-notes.yml)

This workflow includes:

- Automatic generation of release notes when a release is published
- Manual triggering with a specific release tag
- Saving the generated notes as release assets
- Uploading the notes as artifacts

You can use this workflow as a template for your own projects.

## How It Works

1. The action fetches release information from GitHub using the specified release tag
2. It extracts the release notes from the release body
3. The notes are sent to OpenAI's API to generate user-friendly versions
4. The AI rewrites the technical notes in a friendly, concise format suitable for end users
5. The notes are also translated into Swedish and French
6. The results are provided as outputs that can be used in your workflow

## CLI Usage

You can also use the release notes generator directly from the command line:

```bash
# Set your OpenAI API key as an environment variable
export OPENAI_API_KEY=your-api-key-here

# Run the CLI
node cli.js
```

Then follow the prompts to enter your release notes and specify the maximum length.

## Requirements

- An OpenAI API key is required. You can obtain one from [OpenAI's platform](https://platform.openai.com/).
- Store your OpenAI API key as a secret in your GitHub repository.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
