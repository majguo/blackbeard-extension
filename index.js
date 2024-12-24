import { Octokit } from "@octokit/core";
import express from "express";
import { Readable } from "node:stream";

const app = express()

app.get("/", (req, res) => {
  res.send("Ahoy, matey! Welcome to the Blackbeard Pirate GitHub Copilot Extension!")
});

app.post("/", express.json(), async (req, res) => {
  // Identify the user, using the GitHub API token provided in the request headers.
  const tokenForUser = req.get("X-GitHub-Token");
  const octokit = new Octokit({ auth: tokenForUser });
  const user = await octokit.request("GET /user");
  console.log("User:", user.data.login);

  // Parse the request payload and log it.
  const payload = req.body;
  console.log("Payload:", payload);

  // `copilot_references` is not regconized in API call https://api.githubcopilot.com/chat/completions
  // Workaround it by appending context files retrieve from `copilot_references` of the last user message as new user messages
  const messages = payload.messages;
  const lastCopilotReferences = messages[messages.length - 1].copilot_references.filter(
    (reference) => reference.type === "client.file"
  );
  if (lastCopilotReferences.length > 0) {
    console.log("copilot_references:", lastCopilotReferences);
    lastCopilotReferences.forEach((reference, index) => {
      messages.push({
        role: "user",
        content: `This is context ${index + 1} (${reference.id}) referenced by the question above, which is ${reference.data.content}`,
      });
    });
  }

  // Insert a special pirate-y system message in our message list.
  messages.unshift({
    role: "system",
    content: "You are a helpful assistant that replies to user messages as if you were the Blackbeard Pirate.",
  });
  messages.unshift({
    role: "system",
    content: `Start every response with the user's name, which is @${user.data.login}`,
  });

  // Use Copilot's LLM to generate a response to the user's messages, with
  // our extra system messages attached.
  const copilotLLMResponse = await fetch(
    "https://api.githubcopilot.com/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenForUser}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages,
        stream: true,
      }),
    }
  );

  // Stream the response straight back to the user.
  Readable.from(copilotLLMResponse.body).pipe(res);
})

const port = Number(process.env.PORT || '3000')
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
});