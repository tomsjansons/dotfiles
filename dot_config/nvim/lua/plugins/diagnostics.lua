-- vim.pack.add({ { src = "https://github.com/folke/trouble.nvim" } })
-- vim.pack.add({ { src = "https://github.com/rachartier/tiny-inline-diagnostic.nvim" } })

-- require("trouble").setup()
-- vim.diagnostic.config({
-- 	float = function(namespace, bufnr)
-- 		print(vim.inspect(vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)))
-- 		return {
-- 			border = "rounded",
-- 			header = "",
-- 			scope = "cursor",
-- 		}
-- 	end,
-- })
--
-- vim.keymap.set("n", "<leader>xx", "<cmd>Trouble diagnostics toggle<cr>", { desc = "Diagnostics (Trouble)" })
-- vim.keymap.set(
-- 	"n",
-- 	"<leader>xX",
-- 	"<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
-- 	{ desc = "Buffer Diagnostics (Trouble)" }
-- )
-- vim.keymap.set("n", "<leader>cs", "<cmd>Trouble symbols toggle focus=false<cr>", { desc = "Symbols (Trouble)" })
-- vim.keymap.set(
-- 	"n",
-- 	"<leader>cl",
-- 	"<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
-- 	{ desc = "LSP Definitions / references / ... (Trouble)" }
-- )
-- vim.keymap.set("n", "<leader>xL", "<cmd>Trouble loclist toggle<cr>", { desc = "Location List (Trouble)" })
-- vim.keymap.set("n", "<leader>xQ", "<cmd>Trouble qflist toggle<cr>", { desc = "Quickfix List (Trouble)" })
vim.keymap.set("n", "<space>cd", function()
	vim.diagnostic.open_float()
end, { desc = "diagnostic" })
