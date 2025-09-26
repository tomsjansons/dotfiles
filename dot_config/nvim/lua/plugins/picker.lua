vim.pack.add({ { src = "https://github.com/nvim-telescope/telescope.nvim" } })

local function delete_selected_buffer(prompt_bufnr)
	local actions = require("telescope.actions")
	local action_state = require("telescope.actions.state")

	local selection = action_state.get_selected_entry()
	local open_buffers = vim.api.nvim_list_bufs()

	if selection then
		local bufnr = selection.bufnr
		if bufnr then
			actions.close(prompt_bufnr)
			StepBackJumplist(bufnr)
			vim.api.nvim_buf_delete(bufnr, { force = true })
			require("telescope.builtin").buffers()
		end
	end
end

require("telescope").setup({
	defaults = {
		mappings = {
			i = {
				["<C-d>"] = delete_selected_buffer,
			},
			n = {
				["<C-d>"] = delete_selected_buffer,
			},
		},
	},
})

-- vim.keymap.set("n", "<leader>b", open_buffers, { desc = "Buffers" })
vim.keymap.set("n", "<leader>b", function()
	require("telescope.builtin").buffers()
end, { desc = "Buffers" })

vim.keymap.set("n", "<leader>f", function()
	require("telescope.builtin").find_files()
end, { desc = "Files" })
