vim.g.mapleader = " "

vim.keymap.set("n", "<c-h>", "<C-w>h")
vim.keymap.set("n", "<c-l>", "<C-w>l")
vim.keymap.set("n", "<c-j>", "<C-w>j")
vim.keymap.set("n", "<c-k>", "<C-w>k")

vim.api.nvim_create_user_command("W", "w", {})
vim.api.nvim_create_user_command("Wa", "wa", {})
vim.api.nvim_create_user_command("WA", "wa", {})
vim.api.nvim_create_user_command("Q", "q", {})
vim.api.nvim_create_user_command("Qa", "qa", {})
vim.api.nvim_create_user_command("QA", "qa", {})

-- vim.keymap.set("n", "<leader>e", "<cmd>Explore<cr>")
vim.keymap.set("n", "<leader>d", "<cmd>bdelete<cr>")
