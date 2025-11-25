vim.pack.add({ { src = "https://github.com/olimorris/codecompanion.nvim" } })

require("codecompanion").setup({
	opts = {
		log_level = "TRACE",
	},
	strategies = {
		chat = {
			adapter = "or_qwen",
			opts = {
				completion_provider = "blink", -- blink|cmp|coc|default
			},
		},
		inline = {
			adapter = "or_qwen",
		},
		cmd = {
			adapter = "or_qwen",
		},
	},
	adapters = {
		http = {
			opts = {
				show_model_choices = false,
				show_defaults = false,
			},
			or_qwen = function()
				return require("codecompanion.adapters").extend("openai_compatible", {
					env = {
						url = "https://openrouter.ai/api",
						api_key = "OPENROUTER_API_KEY",
						chat_url = "/v1/chat/completions",
					},
					schema = {
						model = {
							default = "@preset/qwen3-coder",
						},
					},
				})
			end,
			or_gemini = function()
				return require("codecompanion.adapters").extend("openai_compatible", {
					env = {
						url = "https://openrouter.ai/api",
						api_key = "OPENROUTER_API_KEY",
						chat_url = "/v1/chat/completions",
					},
					schema = {
						model = {
							default = "@preset/gemini-2-5-pro",
						},
					},
				})
			end,
			or_gemini3 = function()
				return require("codecompanion.adapters").extend("openai_compatible", {
					env = {
						url = "https://openrouter.ai/api",
						api_key = "OPENROUTER_API_KEY",
						chat_url = "/v1/chat/completions",
					},
					schema = {
						model = {
							default = "@preset/gemini-3-pro",
						},
					},
				})
			end,
			or_gpt = function()
				return require("codecompanion.adapters").extend("openai_compatible", {
					env = {
						url = "https://openrouter.ai/api",
						api_key = "OPENROUTER_API_KEY",
						chat_url = "/v1/chat/completions",
					},
					schema = {
						model = {
							default = "@preset/gpt-5-1-codex",
						},
					},
				})
			end,
		},
	},
})

vim.keymap.set({ "n", "v" }, "<leader>aa", "<cmd>CodeCompanionChat<cr>", { desc = "CodeCompanionChat" })
