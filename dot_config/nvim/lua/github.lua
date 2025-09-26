vim.pack.add({
	{ src = "https://github.com/ldelossa/litee.nvim" },
	{ src = "https://github.com/ldelossa/gh.nvim" },
})

require("litee.lib").setup()
require("litee.gh").setup()
