vim.pack.add({ { src = "https://github.com/nvim-mini/mini.completion" } })

require("mini.completion").setup({
	window = {
		info = { height = 25, width = 80, border = "single" },
		signature = { height = 25, width = 80, border = "single" },
	},
})
