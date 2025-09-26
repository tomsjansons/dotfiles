vim.pack.add({ { src = "https://github.com/rachartier/tiny-inline-diagnostic.nvim" } })

require("tiny-inline-diagnostic").setup()
vim.diagnostic.config({ virtual_text = false }) -- Disable default virtual text
