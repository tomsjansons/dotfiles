vim.pack.add({
	{ src = "https://github.com/nvim-mini/mini.pick" },
	{ src = "https://github.com/nvim-mini/mini.extra" },
})

require("mini.pick").setup({})

local pick = require("mini.pick")
local extra = require("mini.extra")
vim.ui.select = pick.ui_select

local function open_buffers()
	local wipeout_cur = function()
		vim.api.nvim_buf_delete(MiniPick.get_picker_matches().current.bufnr, {})
		MiniPick.stop()
		open_buffers()
	end
	local buffer_mappings = { wipeout = { char = "<C-d>", func = wipeout_cur } }
	MiniPick.builtin.buffers({}, { mappings = buffer_mappings })
end

vim.keymap.set("n", "<leader>b", open_buffers, { desc = "Buffers" })

vim.keymap.set("n", "gr", function()
	extra.pickers.lsp({ scope = "references" })
end, { desc = "Pick references" })

vim.keymap.set("n", "gd", function()
	extra.pickers.lsp({ scope = "definition" })
end, { desc = "Go to definition" })

vim.keymap.set("n", "<leader>cs", function()
	extra.pickers.lsp({ scope = "document_symbol" })
end, { desc = "Pick symbols" })

vim.keymap.set("n", "<leader>cD", function()
	extra.pickers.diagnostic({
		scope = "current",
	})
end, { desc = "Pick diagnostic" })

-- vim.keymap.set("n", "<leader>cD", function()
-- 	extra.pickers.diagnostic({
-- 		scope = "all",
-- 	})
-- end, { desc = "Pick diagnostic all" })

vim.keymap.set("n", "<leader>sg", "<cmd>Pick grep_live<cr>")
-- vim.keymap.set("n", "<leader>o", function()
-- 	extra.pickers.visit_paths({})
-- end, { desc = "Treesitter nodes" })
