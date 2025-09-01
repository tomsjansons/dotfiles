vim.pack.add({
	{ src = "https://github.com/nvim-mini/mini.pick" },
	{ src = "https://github.com/nvim-mini/mini.extra" },
})

require("mini.pick").setup({})

local pick = require("mini.pick")
local extra = require("mini.extra")
vim.ui.select = pick.ui_select

vim.keymap.set("n", "<leader>b", "<cmd>Pick buffers<cr>")
vim.keymap.set("n", "gr", function()
	extra.pickers.lsp({ scope = "references" })
end, { desc = "Pick references" })
vim.keymap.set("n", "gs", function()
	extra.pickers.lsp({ scope = "document_symbol" })
end, { desc = "Pick symbols" })
vim.keymap.set("n", "<leader>cd", function()
	extra.pickers.diagnostic({
		scope = "current",
	})
end, { desc = "Pick diagnostic" })
vim.keymap.set("n", "<leader>cD", function()
	extra.pickers.diagnostic({
		scope = "all",
	})
end, { desc = "Pick diagnostic all" })
vim.keymap.set("n", "<leader>g", "<cmd>Pick grep_live<cr>")
vim.keymap.set("n", "<leader>o", function()
	extra.pickers.visit_paths({})
end, { desc = "Treesitter nodes" })
