vim.pack.add({ { src = "https://github.com/rachartier/tiny-code-action.nvim" } })

require("tiny-code-action").setup({
	backend = "delta",
	picker = {
		"buffer",
		opts = {
			hotkeys = true, -- Enable hotkeys for quick selection of actions
			auto_preview = true, -- Enable or disable automatic preview
		},
	},
})

vim.keymap.set({ "n", "x" }, "<leader>ca", function()
	require("tiny-code-action").code_action()
end, {
	desc = "Action",
	noremap = true,
	silent = true,
})
-- vim.keymap.set({ "n", "x" }, "<leader>ca", function()
-- 	vim.lsp.buf.code_action()
-- end, {
-- 	desc = "Action",
-- 	noremap = true,
-- 	silent = true,
-- })
