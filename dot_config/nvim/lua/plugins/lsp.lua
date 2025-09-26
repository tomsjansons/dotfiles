vim.pack.add({
	{ src = "https://github.com/neovim/nvim-lspconfig" },
	{ src = "https://github.com/mason-org/mason.nvim" },
	{ src = "https://github.com/mason-org/mason-lspconfig.nvim" },
	{ src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
})

require("mason").setup()
require("mason-lspconfig").setup()
require("mason-tool-installer").setup({
	ensure_installed = {
		"lua_ls",
		"stylua",
		"eslint_d",
		"prettierd",
		"vtsls",
		"gopls",
		"gofumpt",
		"rust_analyzer",
		"kotlin_lsp",
		"ktlint",
		-- "bacon_ls",
	},
})

local nvim_lsp = require("lspconfig")

vim.lsp.config("denols", {
	filetypes = { "typescript", "typescriptreact" },
	root_dir = function(...)
		return nvim_lsp.util.root_pattern("deno.jsonc", "deno.json")(...)
	end,
})

vim.lsp.config("lua_ls", {
	settings = {
		Lua = {
			runtime = {
				version = "LuaJIT",
			},
			diagnostics = {
				globals = {
					"vim",
					"require",
				},
			},
			workspace = {
				library = vim.api.nvim_get_runtime_file("", true),
			},
			telemetry = {
				enable = false,
			},
		},
	},
})

vim.lsp.config("zls", {
	settings = {
		zls = {
			enable_build_on_save = true,
			semantic_tokens = "partial",
		},
	},
})

vim.keymap.set("n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" })
