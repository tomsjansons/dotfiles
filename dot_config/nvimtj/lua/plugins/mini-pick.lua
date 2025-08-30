vim.pack.add({
	{ src = "https://github.com/nvim-mini/mini.pick" },
	{ src = "https://github.com/nvim-mini/mini.extra" },
})

require("mini.pick").setup({})
local extra = require("mini.extra")

vim.keymap.set("n", "<leader>f", "<cmd>Pick files<cr>")
vim.keymap.set("n", "<leader>b", "<cmd>Pick buffers<cr>")
vim.keymap.set("n", "gr", function()
	extra.pickers.lsp({ scope = "references" })
end)
vim.keymap.set("n", "<leader>cd", function()
	extra.pickers.diagnostic({
		scope = "current",
	})
end)
vim.keymap.set("n", "<leader>cD", function()
	extra.pickers.diagnostic({
		scope = "all",
	})
end)
vim.keymap.set("n", "<leader>g", "<cmd>Pick grep_live<cr>")
