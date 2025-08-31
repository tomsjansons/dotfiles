local f = io.open(os.getenv("HOME") .. "/.theme-light", "r")
if f ~= nil then
	io.close(f)
	vim.opt.background = "light"
else
	vim.opt.background = "dark"
end

require("config")
require("keymaps")
require("plugins/plenary")
require("plugins/mini-icons")
require("plugins/oil")
require("plugins/lsp")
require("plugins/mini-completions")
require("plugins/mini-pairs")
require("plugins/formatter")
require("plugins/diagnostics")
require("plugins/nvim-surround")
require("plugins/mini-pick")
require("plugins/which-key")
require("plugins/tiny-code-action")
require("plugins/mini-notify")
require("plugins/codecompanion")
require("plugins/treesitter")
require("plugins/flash")
require("plugins/grug-far")
require("plugins/messages")
