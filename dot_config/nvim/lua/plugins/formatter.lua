vim.pack.add({ { src = "https://github.com/mhartington/formatter.nvim" } })

require("formatter").setup({
	logging = true,
	log_level = vim.log.levels.WARN,
	filetype = {
		lua = {
			require("formatter.filetypes.lua").stylua,
		},
		go = {
			require("formatter.filetypes.go").gofumpt,
		},
		rust = {
			require("formatter.filetypes.rust").rustfmt,
		},
		typescript = {
			require("formatter.filetypes.typescript").eslint_d,
			require("formatter.filetypes.typescript").biome,
		},
		typescriptreact = {
			require("formatter.filetypes.typescript").eslint_d,
			require("formatter.filetypes.typescript").biome,
		},
		javascript = {
			require("formatter.filetypes.typescript").eslint_d,
			require("formatter.filetypes.typescript").biome,
		},
		javascriptreact = {
			require("formatter.filetypes.typescript").eslint_d,
			require("formatter.filetypes.typescript").biome,
		},
		html = {
			require("formatter.filetypes.html").prettierd,
		},
	},
})

vim.api.nvim_create_augroup("__formatter__", { clear = true })
vim.api.nvim_create_autocmd("BufWritePost", {
	group = "__formatter__",
	command = ":FormatWrite",
})
