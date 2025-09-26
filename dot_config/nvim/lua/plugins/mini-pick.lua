vim.pack.add({
	{ src = "https://github.com/nvim-mini/mini.pick" },
	{ src = "https://github.com/nvim-mini/mini.extra" },
})

require("mini.pick").setup({})

local pick = require("mini.pick")
local extra = require("mini.extra")
vim.ui.select = pick.ui_select

-- vim.schedule callback: /home/toms/.config/nvim/lua/keymaps.lua:28: Vim:E325: ATTENTION
-- stack traceback:
-- 	[C]: in function 'nvim_win_set_buf'
-- 	/home/toms/.config/nvim/lua/keymaps.lua:28: in function 'StepBackJumplist'
-- 	/home/toms/.config/nvim/lua/plugins/mini-pick.lua:15: in function 'func'
-- 	...hare/nvim/site/pack/core/opt/mini.pick/lua/mini/pick.lua:2206: in function 'start'
-- 	...hare/nvim/site/pack/core/opt/mini.pick/lua/mini/pick.lua:898: in function ''
-- 	vim/_editor.lua: in function ''
-- 	vim/_editor.lua: in function <vim/_editor.lua:0>
-- Client stylua quit with exit code 2 and signal 0. Check log for errors: /home/toms/.local/state/nvim/lsp.log
local function open_buffers()
	local delete_selected_buf = function()
		local buf = MiniPick.get_picker_matches().current.bufnr
		StepBackJumplist(buf)
		vim.api.nvim_buf_delete(buf, { force = true })
		MiniPick.stop()
		open_buffers()
	end
	local buffer_mappings = { wipeout = { char = "<C-d>", func = delete_selected_buf } }
	MiniPick.builtin.buffers({}, { mappings = buffer_mappings })
end

vim.keymap.set("n", "<leader>b", open_buffers, { desc = "Buffers" })

vim.keymap.set("n", "gri", function()
	extra.pickers.lsp({ scope = "implementation" })
end, { desc = "Pick implementation" })

vim.keymap.set("n", "grn", function()
	extra.pickers.lsp({ scope = "references" })
end, { desc = "Pick references" })

vim.keymap.set("n", "grr", function()
	extra.pickers.lsp({ scope = "references" })
end, { desc = "Pick references" })

vim.keymap.set("n", "grt", function()
	extra.pickers.lsp({ scope = "references" })
end, { desc = "Pick references" })

vim.keymap.set("n", "grO", function()
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
