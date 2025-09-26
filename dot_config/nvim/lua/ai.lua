vim.pack.add({ { src = "https://github.com/olimorris/codecompanion.nvim" } })

require("codecompanion").setup({
	opts = {
		log_level = "TRACE",
	},
	strategies = {
		chat = {
			adapter = "openai",
			opts = {
				completion_provider = "blink", -- blink|cmp|coc|default
			},
		},
		inline = {
			adapter = "openai",
		},
		cmd = {
			adapter = "openai",
		},
	},
	adapters = {
		http = {
			openrouter_qwen = function()
				return require("codecompanion.adapters").extend("openai_compatible", {
					env = {
						url = "https://openrouter.ai/api",
						api_key = "OPENROUTER_API_KEY",
						chat_url = "/v1/chat/completions",
					},
					schema = {
						model = {
							default = "@preset/qwen3-coder-preset",
						},
					},
				})
			end,
			openai = function()
				return require("codecompanion.adapters").extend("openai", {
					schema = {
						model = {
							default = "gpt-5",
						},
					},
				})
			end,
		},
	},
})

vim.keymap.set({ "n", "v" }, "<leader>aa", "<cmd>CodeCompanionChat<cr>", { desc = "CodeCompanionChat" })
