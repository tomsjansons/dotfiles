require("chatgpt").setup({
  api_key_cmd = "op read op://Personal/OpenAI/credential --no-newline",
  popup_input = {
    submit = "<CR>"
  }
})
