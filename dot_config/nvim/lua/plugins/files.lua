vim.pack.add({ { src = "https://github.com/nvim-telescope/telescope-file-browser.nvim" } })

require("telescope").load_extension("file_browser")

vim.keymap.set("n", "<space>e", function()
	require("telescope").extensions.file_browser.file_browser()
end, { desc = "File explorer" })
