vim.pack.add({ { src = "https://github.com/yousefakbar/notmuch.nvim" } })

require("notmuch").setup({
	notmuch_db_path = "/home/toms/.local/share/notmuch/default/",
})
