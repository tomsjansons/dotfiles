vim.pack.add({ { src = "https://github.com/mhartington/formatter.nvim" } })

require("formatter").setup({
	logging = true,
	log_level = vim.log.levels.WARN,
	filetype = {
		lua = {
			require("formatter.filetypes.lua").stylua,
		},
		typescript = {
			require("formatter.filetypes.typescript"),
		},
		typescriptreact = {
			require("formatter.filetypes.typescriptreact"),
		},
		javascript = {
			require("formatter.filetypes.javascript"),
		},
		javascriptreact = {
			require("formatter.filetypes.javascriptreact"),
			rust = {
				require("formatter.filetypes.rust"),
			},
			go = {
				require("formatter.filetypes.go"),
			},
			html = {
				require("formatter.filetypes.html"),
			},
		},
	},
})

vim.api.nvim_create_augroup("__formatter__", { clear = true })
vim.api.nvim_create_autocmd("BufWritePost", {
	group = "__formatter__",
	command = ":FormatWrite",
})
